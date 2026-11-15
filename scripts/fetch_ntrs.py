#!/usr/bin/env python3
"""Fetch NTRS citation metadata + PDFs into data/raw/ntrs/ (cached, so re-runs are free).

  python scripts/fetch_ntrs.py ids 20040084156 20040084155
  python scripts/fetch_ntrs.py search "Saffire" "BASS-II" --size 30
      -> data/raw/ntrs/search/<slug>.json (metadata only, nothing downloaded)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "ntrs"
API = "https://ntrs.nasa.gov/api"
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "firebreak-research-prototype/0.1 (NASA Space Apps)"


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


def fetch_id(nid: str) -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    meta_path = RAW / f"{nid}.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())
    else:
        meta = _get(f"{API}/citations/{nid}").json()
        meta_path.write_text(json.dumps(meta, indent=1))
    pdf_path = RAW / f"{nid}.pdf"
    status = "cached" if pdf_path.exists() else "no pdf"
    if not pdf_path.exists():
        for d in meta.get("downloads") or []:
            links = d.get("links") or {}
            link = links.get("pdf") or links.get("original")
            if not link:
                continue
            if not (str(d.get("mimetype", "")).endswith("pdf") or link.lower().endswith(".pdf")):
                continue
            url = link if link.startswith("http") else "https://ntrs.nasa.gov" + link
            r = _get(url)
            if r.content[:5] == b"%PDF-":
                pdf_path.write_bytes(r.content)
                status = f"{len(r.content) // 1024} KB"
                break
    return {"id": nid, "title": (meta.get("title") or "")[:90], "pdf": status}


def search(q: str, size: int) -> list[dict]:
    out_dir = RAW / "search"
    out_dir.mkdir(parents=True, exist_ok=True)
    data = _get(f"{API}/citations/search", q=q, **{"page.size": size}).json()
    rows = []
    for c in data.get("results", []):
        pub = (c.get("publications") or [{}])[0]
        rows.append(
            {
                "id": str(c.get("id")),
                "title": c.get("title"),
                "year": (pub.get("publicationDate") or c.get("created") or "")[:4],
                "type": c.get("stiType"),
                "pdf": bool(c.get("downloadsAvailable")),
                "authors": [
                    ((a.get("meta") or {}).get("author") or {}).get("name")
                    for a in (c.get("authorAffiliations") or [])
                ][:4],
            }
        )
    slug = re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-")
    total = (data.get("stats") or {}).get("total")
    (out_dir / f"{slug}.json").write_text(json.dumps({"q": q, "total": total, "results": rows}, indent=1))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("ids")
    a.add_argument("ids", nargs="+")
    s = sub.add_parser("search")
    s.add_argument("queries", nargs="+")
    s.add_argument("--size", type=int, default=25)
    args = ap.parse_args()
    if args.cmd == "ids":
        for nid in args.ids:
            try:
                r = fetch_id(nid)
                print(f"{r['id']}  {r['pdf']:>10}  {r['title']}")
            except Exception as e:  # keep going, report at the end
                print(f"{nid}  ERROR {e}", file=sys.stderr)
    else:
        for q in args.queries:
            rows = search(q, args.size)
            print(f"\n## {q}: {len(rows)} results")
            for r in rows:
                print(f"  {r['id']}  {r['year']}  {'PDF' if r['pdf'] else '   '}  {str(r['title'])[:100]}")


if __name__ == "__main__":
    main()
