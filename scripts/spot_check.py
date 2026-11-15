#!/usr/bin/env python3
"""Independent spot-check: find a stretch of each sampled quote on its cited PDF page using PyMuPDF's own
page search (not the extracted-text files the verifier uses). Prints PASS/FAIL per record.

  python scripts/spot_check.py [n] [seed]
"""
import json, random, re, sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
findings = [f for f in json.loads((ROOT / "public/data/findings.json").read_text())
            if f["source_id"].startswith("NTRS:") and (ROOT / f"data/raw/ntrs/{f['source_id'][5:]}.pdf").exists()]
ok = 0
for f in random.Random(seed).sample(findings, min(n, len(findings))):
    words = re.sub(r"\s+", " ", f["quote"]).split(" ")
    # search a few overlapping 5-word windows; PDF search is line-aware so short windows survive line breaks
    windows = [" ".join(words[i:i + 5]) for i in range(0, max(1, len(words) - 4), 4)]
    with pymupdf.open(ROOT / f"data/raw/ntrs/{f['source_id'][5:]}.pdf") as doc:
        page = doc[f["page"] - 1]
        hits = sum(1 for w in windows if page.search_for(w))
    good = hits >= max(1, len(windows) // 2)
    ok += good
    print(f"{'PASS' if good else 'FAIL'}  {f['id']}  {f['source_id']} p.{f['page']}  {hits}/{len(windows)} windows found  | {f['finding'][:70]}")
print(f"\n{ok}/{min(n, len(findings))} sampled quotes located on their cited PDF page by PyMuPDF search")
