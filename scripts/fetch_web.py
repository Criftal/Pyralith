#!/usr/bin/env python3
"""Cache web pages we cite (challenge brief, NASA incident and context pages) as verifiable text.

Writes data/raw/web/<slug>.html and data/raw/text/WEB_<slug>.json/.txt (the page's visible text as page 1),
and the source registry data/processed/web_sources.json.

  python scripts/fetch_web.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_text import write_pages  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "web"

PAGES = [
    ("brief", "Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data (NASA Space Apps 2026 challenge)",
     "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/", 2026, "Challenge brief"),
    ("apollo-1", "Apollo 1 (NASA Safety & Mission Assurance, Lessons Learned)",
     "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1", None, "Web page"),
    ("apollo-13", "Apollo 13 (NASA Safety & Mission Assurance, Lessons Learned)",
     "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13", None, "Web page"),
    ("mir-fire", "25 Years Ago: Fire Aboard Space Station Mir (NASA History)",
     "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/", 2022, "Web page"),
    ("nasa-combustion-science", "Combustion Science (NASA Glenn Research Center)",
     "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/", None, "Web page"),
    ("researchers-guide", "A Researcher's Guide to: Combustion Science (NASA ISS)",
     "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/", None, "Web page"),
]


def next_payload_text(html: str) -> str:
    """Next.js App Router pages ship their content as escaped strings in self.__next_f.push([1, "..."]) calls."""
    chunks = []
    for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html):
        try:
            chunks.append(json.loads(m.group(1)))
        except json.JSONDecodeError:
            continue
    payload = "".join(chunks)
    fragments = re.findall(r"<(?:p|h[1-6]|li|ul|ol)\b[^>]*>.*?</(?:p|h[1-6]|li|ul|ol)>", payload, flags=re.S)
    if not fragments:
        return ""
    return visible_text("<main>" + "\n".join(fragments) + "</main>")


def visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
        tag.decompose()
    main = soup.find("main") or soup.body or soup
    text = main.get_text("\n")
    lines = [re.sub(r"[ \t ]+", " ", ln).strip() for ln in text.splitlines()]
    return "\n".join(ln for ln in lines if ln)


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    registry = []
    s = requests.Session()
    s.headers["User-Agent"] = "Mozilla/5.0 (compatible; firebreak-research-prototype/0.1)"
    for slug, title, url, year, doc_type in PAGES:
        try:
            r = s.get(url, timeout=60)
            r.raise_for_status()
            html = r.text
        except requests.exceptions.SSLError:
            # some hosts omit an intermediate certificate; the system curl (macOS keychain) copes
            html = subprocess.run(["curl", "-sSL", "-A", "Mozilla/5.0", url], capture_output=True, text=True,
                                  check=True).stdout
        except Exception as e:
            print(f"WEB:{slug}: ERROR {e}")
            continue
        (RAW / f"{slug}.html").write_text(html)
        text = visible_text(html)
        if len(text.split()) < 200 and "__next_f" in html:
            text = (text + "\n" + next_payload_text(html)).strip()
        write_pages(f"WEB:{slug}", [text])
        registry.append({"id": f"WEB:{slug}", "kind": "web", "title": title, "authors": ["NASA"], "year": year,
                         "url": url, "pdf_url": None, "doc_type": doc_type})
        print(f"WEB:{slug}: {len(text.split())} words")
    (ROOT / "data" / "processed" / "web_sources.json").write_text(json.dumps(registry, indent=1))


if __name__ == "__main__":
    main()
