#!/usr/bin/env python3
"""Fetch NASA PSI (Physical Sciences Informatics) investigation records via the JSON API the PSI site uses.

Endpoints (found by watching the psi.nasa.gov/physci/repo pages' network calls):
  GET  /geode-py/ws/repo/search?term=<q>&source=psi&type=investigation      Elasticsearch-style hits
  GET  /geode-py/ws/repo/investigations/<PSI-n>                              full record (+ file list)
  GET  /geode-py/ws/studies/<PSI-n>/download?file=<name>&version=<v>&redirect=false   -> signed S3 URL

Writes:
  data/raw/psi/<PSI-n>.json                     raw record (cached)
  data/raw/psi/<PSI-n>_experimental_table.csv  experiment table, when PSI has one
  data/raw/text/PSI_<PSI-n>.json / .txt         the record's prose as "page 1", for quote verification

  python scripts/fetch_psi.py                   # search terms below, all hits
  python scripts/fetch_psi.py PSI-25 PSI-26     # just these
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_text import write_pages  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "psi"
BASE = "https://psi.nasa.gov/geode-py/ws"
SEARCH_TERMS = ["combustion", "fire", "flame"]
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "firebreak-research-prototype/0.1 (NASA Space Apps)"

# Prose fields rendered into the verification text, in display order.
TEXT_FIELDS = [
    ("Title", "title"),
    ("Acronym", "investigationAcronym"),
    ("Flight program", "flightProgram"),
    ("Experiment hardware", "experimentHardware"),
    ("Research area", "researchArea"),
    ("Sub-research area", "subResearchArea"),
    ("Start date", "investigationStartDate"),
    ("End date", "investigationEndDate"),
    ("Hypothesis", "hypothesis"),
    ("Objective", "objective"),
    ("Approach", "approach"),
    ("Research impacts", "researchImpacts"),
    ("Description", "description"),
]


def _get(url: str, **params) -> requests.Response:
    for attempt in range(5):
        try:
            r = SESSION.get(url, params=params or None, timeout=90)
        except requests.RequestException:
            time.sleep(2**attempt)
            continue
        if r.status_code == 200:
            return r
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(2**attempt)
            continue
        r.raise_for_status()
    raise RuntimeError(f"giving up on {url}")


def search_accessions() -> list[str]:
    seen: dict[str, str] = {}
    for term in SEARCH_TERMS:
        d = _get(f"{BASE}/repo/search", term=term, source="psi", type="investigation").json()
        (RAW / f"search_{term}.json").write_text(json.dumps(d, indent=1))
        for h in d["hits"]["hits"]:
            s = h["_source"]
            seen.setdefault(s["Accession"], s.get("Acronym") or s.get("Title") or "")
    return sorted(seen, key=lambda a: int(a.split("-")[1]))


def record_text(rec: dict) -> str:
    parts = []
    for label, key in TEXT_FIELDS:
        v = rec.get(key)
        if v:
            parts.append(f"{label}: {v}")
    pubs = rec.get("publications") or []
    if pubs:
        parts.append("Publications:")
        for p in pubs:
            bits = [p.get("title"), p.get("authorList"), p.get("doi") and f"doi:{p['doi']}"]
            parts.append("- " + " | ".join(b for b in bits if b))
    return "\n\n".join(parts)


def download_table(acc: str, rec: dict) -> str:
    """Download every experiment table (some investigations, e.g. PSI-10 and PSI-159, have two)."""
    tables = rec.get("experimentalTable") or []
    if not tables:
        return "no table"
    got = []
    for i, t in enumerate(tables):
        out = RAW / (f"{acc}_experimental_table.csv" if i == 0 else f"{acc}_experimental_table_{i + 1}.csv")
        if not out.exists():
            signed = _get(
                f"{BASE}/studies/{acc}/download", file=t["file_name"], version=t.get("version", 1), redirect="false"
            ).text.strip().strip('"')
            if not signed.startswith("http"):
                got.append(f"unexpected download response {signed[:60]!r}")
                continue
            out.write_bytes(_get(signed).content)
        got.append(f"{out.stat().st_size // 1024}KB")
    return "tables " + "+".join(got)


def fetch(acc: str) -> str:
    path = RAW / f"{acc}.json"
    if path.exists():
        rec = json.loads(path.read_text())
    else:
        rec = _get(f"{BASE}/repo/investigations/{acc}").json()
        path.write_text(json.dumps(rec, indent=1))
    write_pages(f"PSI:{acc}", [record_text(rec)])
    try:
        table = download_table(acc, rec)
    except Exception as e:  # keep going; the record itself is what matters most
        table = f"table error {e}"
    n_files = len(rec.get("added") or [])
    return f"{acc:8} {str(rec.get('investigationAcronym') or '-'):26} {table:16} files={n_files:<5} {rec.get('title', '')[:60]}"


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    accs = sys.argv[1:] or search_accessions()
    for acc in accs:
        try:
            print(fetch(acc), flush=True)
        except Exception as e:
            print(f"{acc}: ERROR {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
