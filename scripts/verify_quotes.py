#!/usr/bin/env python3
"""The citation gate. Every candidate record must pass or it is dropped; failures are never hand-fixed.

Checks, in order:
  schema   required fields, enums, limits (finding/claim text <= 30 words; quote 6-40 words; page in range)
  quote    the quote appears verbatim on its cited page after normalising Unicode (NFKC: ligatures,
           sub/superscripts), quote marks, dashes, soft hyphens, line-break hyphenation, whitespace and case
  numbers  every number in `reported` appears somewhere in the cited source's text, and word-only
           conditions (e.g. "microgravity", "quiescent") appear there too

Inputs : data/processed/candidates/*.jsonl, data/processed/missions_src.json (optional)
Outputs: data/processed/findings.jsonl  verified findings, canonical numbers added (ids assigned by export)
         data/processed/claims.jsonl    verified claims
         data/processed/missions.json   verified mission presets
         data/processed/rejected.jsonl  every dropped record with its reason
         data/processed/verification_stats.json

  python scripts/verify_quotes.py                 # everything
  python scripts/verify_quotes.py --only a.jsonl  # dry-run stats for one candidates file (writes nothing)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize as nz  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TEXT = ROOT / "data" / "raw" / "text"
PROC = ROOT / "data" / "processed"
CAND = PROC / "candidates"

PLATFORMS = {"ISS", "Cygnus", "Shuttle", "sounding_rocket", "parabolic", "drop_tower", "1g_lab", "model", "review"}
FINDING_TYPES = {
    "flammability_limit", "spread_rate", "extinction", "ignition", "smoke_toxicity",
    "smoke_detection", "suppression", "test_method", "design_requirement",
}
DIRECTIONS = {"more_flammable_than_1g", "less_flammable_than_1g", "neutral", "n/a"}
SAFETY = {"prevention", "detection", "suppression"}
TOPICS = {
    "test1", "u_shape", "lunar_flammability", "partial_g_gap", "exploration_atmosphere",
    "high_o2", "future_experiment", "platform", "incident", "context",
}
QUALIFIERS = {"stated", "about", "at_least", "at_most", "assumed"}
SOURCE_RE = re.compile(r"^(NTRS:\d+|PSI:PSI-\d+|WEB:[a-z0-9-]+)$")

_PUNCT = str.maketrans(
    {
        "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
        "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"',
        "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
        "­": None, "​": None, "﻿": None,
    }
)


def strip_private_use(s: str) -> str:
    """Symbol-font glyphs that PDFs map to the Unicode private-use area render as boxes; drop them."""
    return "".join(" " if unicodedata.category(ch) == "Co" else ch for ch in s)


def norm(s: str, join_hyphens: bool = False) -> str:
    s = strip_private_use(unicodedata.normalize("NFKC", s)).translate(_PUNCT)
    if join_hyphens:  # "flam-\nmability" -> "flammability"
        s = re.sub(r"(\w)-[ \t]*\n\s*(\w)", r"\1\2", s)
    else:  # "low-\nvelocity" -> "low-velocity"
        s = re.sub(r"-[ \t]*\n\s*", "-", s)
    return re.sub(r"\s+", " ", s).strip().casefold()


def words(s: str) -> int:
    return len(s.split())


@lru_cache(maxsize=None)
def pages(source_id: str) -> tuple[str, ...] | None:
    path = TEXT / f"{source_id.replace(':', '_')}.json"
    if not path.exists():
        return None
    return tuple(json.loads(path.read_text())["pages"])


@lru_cache(maxsize=None)
def page_variants(source_id: str, page: int) -> tuple[str, str]:
    raw = pages(source_id)[page - 1]
    return norm(raw, join_hyphens=True), norm(raw, join_hyphens=False)


@lru_cache(maxsize=None)
def doc_text(source_id: str) -> str:
    return unicodedata.normalize("NFKC", "\n".join(pages(source_id))).translate(_PUNCT).casefold()


def quote_on_page(source_id: str, page: int, quote: str) -> bool:
    q = norm(quote)
    return any(q in v for v in page_variants(source_id, page))


def quote_found_elsewhere(source_id: str, quote: str) -> list[int]:
    q = norm(quote)
    return [i for i in range(1, len(pages(source_id)) + 1) if any(q in v for v in page_variants(source_id, i))]


def number_in_doc(source_id: str, token: str) -> bool:
    text = doc_text(source_id)
    alts = {token}
    if token.startswith("."):
        alts.add("0" + token)
    if token.startswith("0."):
        alts.add(token[1:])
    return any(re.search(rf"(?<![\d.]){re.escape(a)}(?![\d])", text) for a in alts)


def words_in_doc(source_id: str, phrase: str) -> bool:
    keys = [w for w in re.findall(r"[a-zμ]{4,}", nz.clean(phrase))]
    if not keys:
        return True
    text = doc_text(source_id)
    return all(k in text for k in keys)  # every content word of the reported wording must be in the source


def check_reported(source_id: str, reported: dict) -> str | None:
    for dim, value in reported.items():
        if value in (None, ""):
            continue
        toks = nz.numbers_in(value)
        missing = [t for t in toks if not number_in_doc(source_id, t)]
        if missing:
            return f"numbers: {dim}={value!r}: {missing} not in source"
        if not toks and not words_in_doc(source_id, value):
            return f"numbers: {dim}={value!r}: wording not in source"
    return None


def check_quote(rec: dict) -> str | None:
    src, page, quote = rec.get("source_id"), rec.get("page"), rec.get("quote")
    if not isinstance(src, str) or not SOURCE_RE.match(src):
        return f"schema: bad source_id {src!r}"
    if pages(src) is None:
        return f"schema: no text file for {src}"
    if not isinstance(page, int) or not 1 <= page <= len(pages(src)):
        return f"schema: page {page!r} out of range 1-{len(pages(src))}"
    if not isinstance(quote, str) or not 6 <= words(quote) <= 40:
        return f"schema: quote must be 6-40 words (got {words(quote) if isinstance(quote, str) else 'none'})"
    if "..." in quote or "…" in quote:
        return "schema: quote contains an ellipsis"
    if not quote_on_page(src, page, quote):
        elsewhere = quote_found_elsewhere(src, quote)
        return f"quote: not on page {page}" + (f" (found on page {elsewhere})" if elsewhere else " (not in source)")
    return None


def check_finding(rec: dict) -> str | None:
    need = ["source_id", "experiment", "platform", "reported", "finding", "finding_type", "direction",
            "safety_area", "quote", "page", "evidence_tier"]
    missing = [k for k in need if k not in rec]
    if missing:
        return f"schema: missing {missing}"
    if rec["platform"] not in PLATFORMS:
        return f"schema: platform {rec['platform']!r}"
    if rec["finding_type"] not in FINDING_TYPES:
        return f"schema: finding_type {rec['finding_type']!r}"
    if rec["direction"] not in DIRECTIONS:
        return f"schema: direction {rec['direction']!r}"
    if not isinstance(rec["safety_area"], list) or not set(rec["safety_area"]) <= SAFETY:
        return f"schema: safety_area {rec['safety_area']!r}"
    if rec["evidence_tier"] not in (1, 2, 3, 4):
        return f"schema: evidence_tier {rec['evidence_tier']!r}"
    rep = rec["reported"]
    if not isinstance(rep, dict) or set(rep) - set(nz.CONVERTERS):
        return f"schema: reported must have keys {sorted(nz.CONVERTERS)}"
    if not isinstance(rec["finding"], str) or not 3 <= words(rec["finding"]) <= 30:
        return "schema: finding must be 3-30 words"
    psi = rec.get("psi_id")
    if psi is not None and not re.fullmatch(r"PSI-\d+", str(psi)):
        return f"schema: psi_id {psi!r}"
    a = rec.get("analogue_of_g")
    if a is not None and not isinstance(a, (int, float)):
        return f"schema: analogue_of_g {a!r}"
    return check_quote(rec) or check_reported(rec["source_id"], rep)


def check_claim(rec: dict) -> str | None:
    need = ["id", "topic", "text", "source_id", "page", "quote"]
    missing = [k for k in need if k not in rec]
    if missing:
        return f"schema: missing {missing}"
    if rec["topic"] not in TOPICS:
        return f"schema: topic {rec['topic']!r}"
    if not isinstance(rec["text"], str) or not 3 <= words(rec["text"]) <= 30:
        return "schema: claim text must be 3-30 words"
    return check_quote(rec)


def finish_finding(rec: dict) -> dict:
    rep = {k: rec["reported"].get(k) for k in nz.CONVERTERS}
    out = {
        "source_id": rec["source_id"],
        "experiment": rec["experiment"],
        "psi_id": rec.get("psi_id"),
        "platform": rec["platform"],
        "gravity_g": nz.gravity_g(rep["gravity"]),
        "analogue_of_g": rec.get("analogue_of_g"),
        "o2_percent": nz.o2_percent(rep["o2"]),
        "pressure_kpa": nz.pressure_kpa(rep["pressure"]),
        "flow_cm_s": nz.flow_cm_s(rep["flow"]),
        "reported": rep,
        "material": rec.get("material"),
        "finding": rec["finding"],
        "finding_type": rec["finding_type"],
        "direction": rec["direction"],
        "safety_area": rec["safety_area"],
        "quote": re.sub(r"\s+", " ", strip_private_use(rec["quote"])).strip(),
        "page": rec["page"],
        "evidence_tier": rec["evidence_tier"],
        "verified": True,
        "extracted_by": rec.get("extracted_by"),
    }
    return out


def verify_missions(path: Path) -> tuple[list[dict], list[str]]:
    """Mission presets are hand-curated; any failure is an error to fix in the curation, not a silent drop."""
    if not path.exists():
        return [], []
    errors, out = [], []
    units = {"gravity": "g", "o2": "%", "pressure": "kPa", "flow": "cm/s"}
    for m in json.loads(path.read_text()):
        mm = {"id": m["id"], "name": m["name"]}
        for dim in ("gravity", "o2", "pressure", "flow"):
            cv = m.get(dim)
            if cv is None:
                mm[dim] = None
                continue
            err = check_quote(cv)
            if not err:
                toks = nz.numbers_in(cv["reported"])
                if any(not re.search(rf"(?<![\d.]){re.escape(t)}(?![\d])", norm(cv["quote"])) for t in toks):
                    err = f"numbers: {cv['reported']!r} not in the quote"
            if not err and cv.get("qualifier") not in QUALIFIERS:
                err = f"schema: qualifier {cv.get('qualifier')!r}"
            if err:
                errors.append(f"{m['id']}.{dim}: {err}")
                continue
            value = nz.CONVERTERS[dim](cv["reported"])
            shown = cv["reported"]
            if value is not None and dim == "pressure" and "kpa" not in cv["reported"].lower():
                shown = f"{cv['reported']} ({value:.1f} kPa)"
            if value is not None and dim == "gravity" and not nz.numbers_in(cv["reported"]):
                shown = f"{cv['reported']} ({value:g} g)"
            mm[dim] = {
                "value": value, "unit": units[dim], "display": shown, "qualifier": cv["qualifier"],
                "source_id": cv["source_id"], "page": cv["page"], "quote": cv["quote"], "note": cv.get("note"),
            }
        out.append(mm)
    return out, errors


def load_candidates(files: list[Path]) -> list[dict]:
    recs = []
    for f in files:
        for n, line in enumerate(f.read_text().splitlines(), 1):
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError as e:
                recs.append({"_bad": f"{f.name}:{n}: {e}", "_batch": f.stem})
                continue
            r["_batch"] = f.stem
            recs.append(r)
    return recs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="dry run on one candidates file; writes nothing")
    args = ap.parse_args()
    files = [CAND / args.only] if args.only else sorted(CAND.glob("*.jsonl"))
    recs = load_candidates(files)

    seen: set[tuple[str, str]] = set()
    findings, claims, rejected = [], [], []
    reasons: Counter = Counter()
    per_batch: dict[str, Counter] = {}
    duplicates = 0
    for r in recs:
        b = per_batch.setdefault(r.get("_batch", "?"), Counter())
        if "_bad" in r:
            err = f"schema: invalid JSON {r['_bad']}"
        else:
            key = (str(r.get("source_id")), norm(str(r.get("quote", ""))))
            if key in seen and r.get("kind") != "claim":
                duplicates += 1
                continue
            seen.add(key)
            kind = r.get("kind") or ("claim" if "topic" in r else "finding")
            err = check_claim(r) if kind == "claim" else check_finding(r)
        b["candidates"] += 1
        if err:
            cat = err.split(":", 1)[0]
            reasons[cat] += 1
            b[f"dropped_{cat}"] += 1
            rejected.append({"reason": err, "record": {k: v for k, v in r.items() if k != "_bad"}})
        elif kind == "claim":
            b["verified"] += 1
            c = {k: r.get(k) for k in ("id", "topic", "label", "text", "source_id", "page", "quote", "link")}
            c["quote"] = re.sub(r"\s+", " ", strip_private_use(c["quote"])).strip()
            claims.append(c)
        else:
            b["verified"] += 1
            findings.append(finish_finding(r))

    missions, mission_errors = verify_missions(PROC / "missions_src.json")
    total = sum(c["candidates"] for c in per_batch.values())
    verified = len(findings) + len(claims)
    stats = {
        "candidates": total,
        "verified": verified,
        "verified_findings": len(findings),
        "verified_claims": len(claims),
        "dropped_quote": reasons["quote"],
        "dropped_numbers": reasons["numbers"],
        "dropped_schema": reasons["schema"],
        "duplicates_removed": duplicates,
        "per_batch": {k: dict(v) for k, v in sorted(per_batch.items())},
        "mission_errors": mission_errors,
    }
    print(
        f"{total} records -> {verified} verified ({len(findings)} findings, {len(claims)} claims), "
        f"{total - verified} dropped (quote {reasons['quote']}, numbers {reasons['numbers']}, "
        f"schema {reasons['schema']}); {duplicates} duplicates removed"
    )
    for k, v in sorted(per_batch.items()):
        print(f"  {k:28} {dict(v)}")
    if mission_errors:
        print("MISSION ERRORS (fix the curation):", *mission_errors, sep="\n  ")
    if args.only:
        for r in rejected[:40]:
            print("  DROP", r["reason"], "|", str(r["record"].get("quote", ""))[:90])
        return
    claim_ids = Counter(c["id"] for c in claims)
    dup_ids = [i for i, n in claim_ids.items() if n > 1]
    if dup_ids:
        print("WARNING duplicate claim ids:", dup_ids)
    (PROC / "findings.jsonl").write_text("".join(json.dumps(f, ensure_ascii=False) + "\n" for f in findings))
    (PROC / "claims.jsonl").write_text("".join(json.dumps(c, ensure_ascii=False) + "\n" for c in claims))
    (PROC / "rejected.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rejected))
    (PROC / "missions.json").write_text(json.dumps(missions, indent=1, ensure_ascii=False))
    (PROC / "verification_stats.json").write_text(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
