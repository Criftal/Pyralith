#!/usr/bin/env python3
"""Export verified data for the app (public/data/*.json, see src/types.ts) and regenerate REFERENCES.md.

Run after scripts/verify_quotes.py:
  python scripts/verify_quotes.py && python scripts/export.py
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data"

STI = {
    "TECHNICAL_MEMORANDUM": "Technical Memorandum", "TECHNICAL_PUBLICATION": "Technical Publication",
    "CONFERENCE_PAPER": "Conference Paper", "PRESENTATION": "Presentation", "OTHER": "Other",
    "REPRINT": "Reprint (journal article)", "CONTRACTOR_REPORT": "Contractor Report", "ABSTRACT": "Abstract",
    "JOURNAL_ARTICLE": "Journal Article", "POSTER": "Poster",
}

LIBRARIES = [
    # (name, role, licence)
    ("React", "UI", "MIT"), ("Vite", "build tool", "MIT"), ("TypeScript", "language", "Apache-2.0"),
    ("Tailwind CSS", "styling", "MIT"), ("MiniSearch", "client-side search", "MIT"), ("Vitest", "tests", "MIT"),
    ("three.js", "3D condition-space scene on the landing page", "MIT"), ("Lenis", "smooth scrolling", "MIT"),
    ("Anthropic TypeScript SDK", "optional live AI mode (api/ask.ts, model claude-opus-5-5)", "MIT"),
    ("Newsreader, Inter Tight, JetBrains Mono (via @fontsource)", "fonts", "SIL Open Font License 1.1"),
    ("PyMuPDF", "PDF text extraction (offline pipeline only, not shipped in the app)", "AGPL-3.0"),
    ("requests", "HTTP client (pipeline)", "Apache-2.0"), ("Beautiful Soup 4", "HTML text extraction (pipeline)", "MIT"),
    ("pytest", "tests", "MIT"), ("jsonschema", "schema checks", "MIT"),
]


def jl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()] if path.exists() else []


def ntrs_source(nid: str) -> dict:
    meta = json.loads((RAW / "ntrs" / f"{nid}.json").read_text())
    authors = [((a.get("meta") or {}).get("author") or {}).get("name") for a in meta.get("authorAffiliations") or []]
    pub = (meta.get("publications") or [{}])[0]
    year = (pub.get("publicationDate") or meta.get("created") or "")[:4]
    pdf_url = None
    if (RAW / "ntrs" / f"{nid}.pdf").exists():
        for d in meta.get("downloads") or []:
            link = (d.get("links") or {}).get("pdf") or (d.get("links") or {}).get("original")
            if link and link.lower().endswith(".pdf"):
                pdf_url = link if link.startswith("http") else "https://ntrs.nasa.gov" + link
                break
    title = re.sub(r"<[^>]+>", "", meta.get("title") or "").strip()
    return {
        "id": f"NTRS:{nid}", "kind": "ntrs", "title": title, "authors": [a for a in authors if a],
        "year": int(year) if year.isdigit() else None, "url": f"https://ntrs.nasa.gov/citations/{nid}",
        "pdf_url": pdf_url, "doc_type": STI.get(meta.get("stiType") or "", (meta.get("stiType") or "").title() or None),
    }


def psi_source(acc: str) -> dict:
    rec = json.loads((RAW / "psi" / f"{acc}.json").read_text())
    names = [f"{c.get('firstName', '')} {c.get('lastName', '')}".strip() for c in rec.get("contacts") or []]
    m = re.search(r"(\d{4})", rec.get("releaseDate") or "")
    title = rec.get("title") or acc
    if rec.get("investigationAcronym"):
        title = f"{title} ({rec['investigationAcronym']})"
    return {
        "id": f"PSI:{acc}", "kind": "psi", "title": title, "authors": [n for n in names if n],
        "year": int(m.group(1)) if m else None, "url": f"https://psi.nasa.gov/physci/repo/data/investigations/{acc}",
        "pdf_url": None, "doc_type": f"NASA PSI investigation record ({rec.get('licenseIdentifier') or 'licence n/a'})",
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    findings = jl(PROC / "findings.jsonl")
    claims = jl(PROC / "claims.jsonl")
    missions = json.loads((PROC / "missions.json").read_text()) if (PROC / "missions.json").exists() else []
    investigations = json.loads((PROC / "investigations.json").read_text())
    stats = json.loads((PROC / "verification_stats.json").read_text())
    web = {s["id"]: s for s in json.loads((PROC / "web_sources.json").read_text())}

    findings.sort(key=lambda f: (f["source_id"], f["page"], f["quote"]))
    out_findings = []
    for i, f in enumerate(findings, 1):
        f = {k: v for k, v in f.items() if k != "extracted_by"}
        out_findings.append({"id": f"f_{i:04d}", **f})

    cited = {f["source_id"] for f in out_findings} | {c["source_id"] for c in claims}
    for m in missions:
        for dim in ("gravity", "o2", "pressure", "flow"):
            if m.get(dim):
                cited.add(m[dim]["source_id"])
    cited |= {f"PSI:{i['psi_id']}" for i in investigations}

    sources = {}
    for sid in sorted(cited):
        kind, ref = sid.split(":", 1)
        if kind == "NTRS":
            sources[sid] = ntrs_source(ref)
        elif kind == "PSI":
            sources[sid] = psi_source(ref)
        elif sid in web:
            sources[sid] = web[sid]
        else:
            raise SystemExit(f"no metadata for {sid}")

    experiments = {f["experiment"] for f in out_findings if f["experiment"] != "other"}
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "verification": {k: stats[k] for k in ("candidates", "verified", "dropped_quote", "dropped_numbers", "dropped_schema")},
        "counts": {
            "findings": len(out_findings), "investigations": len(investigations), "sources": len(sources),
            "experiments": len(experiments), "claims": len(claims),
        },
    }
    files = {
        "findings.json": out_findings, "investigations.json": investigations, "sources.json": sources,
        "missions.json": missions, "claims.json": claims, "meta.json": meta,
    }
    for name, data in files.items():
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    write_references(sources)
    v = meta["verification"]
    print(f"exported {len(out_findings)} findings, {len(claims)} claims, {len(investigations)} investigations, "
          f"{len(missions)} missions, {len(sources)} sources | verifier: {v['candidates']} -> {v['verified']} verified")


def write_references(sources: dict) -> None:
    def line(s: dict) -> str:
        authors = ", ".join(s["authors"][:4]) + (" et al." if len(s["authors"]) > 4 else "")
        year = f" ({s['year']})" if s.get("year") else ""
        extra = f" · [PDF]({s['pdf_url']})" if s.get("pdf_url") else ""
        return f"- **{s['id']}**: {authors + '. ' if authors else ''}*{s['title']}*{year}. {s.get('doc_type') or ''}. <{s['url']}>{extra}"

    groups = [("NASA Technical Reports Server (NTRS)", "ntrs"), ("NASA PSI investigation records", "psi"),
              ("Web pages (challenge brief, NASA history and context)", "web")]
    lines = [
        "# References",
        "",
        "Generated by `scripts/export.py` from the verified corpus. Every finding, claim and mission value in the app "
        "cites one of these sources with a page number and a verbatim, machine-verified quote.",
        "",
    ]
    for title, kind in groups:
        rows = [line(s) for s in sources.values() if s["kind"] == kind]
        if rows:
            lines += [f"## {title} ({len(rows)})", "", *rows, ""]
    lines += ["## Software", "", *[f"- {n}: {role}. Licence: {lic}." for n, role, lic in LIBRARIES], ""]
    lines += ["PSI data are released by NASA under CC0-1.0. NASA material is not subject to copyright in the US; "
              "short quotations are used for citation."]
    (ROOT / "REFERENCES.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
