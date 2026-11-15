#!/usr/bin/env python3
"""Extract per-page text from cached NTRS PDFs with PyMuPDF.

Writes, per source:
  data/raw/text/<SRC>.json  {"source_id", "n_pages", "pages": [...]}   (read by verify_quotes.py)
  data/raw/text/<SRC>.txt   pages joined with "=== PAGE n ===" markers  (for reading/extraction)

  python scripts/extract_text.py              # every PDF under data/raw/ntrs
  python scripts/extract_text.py 20040084156  # just these
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
NTRS = ROOT / "data" / "raw" / "ntrs"
OUT = ROOT / "data" / "raw" / "text"


def write_pages(source_id: str, pages: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stem = source_id.replace(":", "_")
    (OUT / f"{stem}.json").write_text(
        json.dumps({"source_id": source_id, "n_pages": len(pages), "pages": pages}, ensure_ascii=False)
    )
    (OUT / f"{stem}.txt").write_text("".join(f"\n=== PAGE {i} ===\n{t}" for i, t in enumerate(pages, 1)))


def extract(pdf: Path, source_id: str) -> list[str]:
    with pymupdf.open(pdf) as doc:
        pages = [p.get_text("text") for p in doc]
    write_pages(source_id, pages)
    return pages


def main() -> None:
    ids = sys.argv[1:] or sorted(p.stem for p in NTRS.glob("*.json"))
    for nid in ids:
        pdf = NTRS / f"{nid}.pdf"
        if not pdf.exists():
            # No PDF on NTRS (e.g. a presentation record): the NTRS abstract is the only citable text.
            meta = json.loads((NTRS / f"{nid}.json").read_text())
            abstract = re.sub(r"<[^>]+>", "", meta.get("abstract") or "").strip()  # drop <sub> etc. markup
            if abstract:
                write_pages(f"NTRS:{nid}", [abstract])
                print(f"NTRS:{nid}: no PDF, using NTRS abstract as page 1 ({len(abstract.split())} words)")
            else:
                print(f"NTRS:{nid}: no PDF and no abstract")
            continue
        pages = extract(pdf, f"NTRS:{nid}")
        words = sum(len(t.split()) for t in pages)
        flag = "  <-- little text, maybe scanned" if words < 100 * len(pages) else ""
        print(f"NTRS:{nid}: {len(pages)} pages, {words} words{flag}")


if __name__ == "__main__":
    main()
