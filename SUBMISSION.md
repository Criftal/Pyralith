# Space Apps 2026 submission: paste-ready text

Team **Pyralith** (Aahaan Sharma, Michael Asabere) · Challenge: **Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data**

Field names follow the 2026 Project Submission Guide; check them against the live form. All links are filled in.

---

## Project name

FIREBREAK

## High-level project summary

FIREBREAK asks one question NASA has not yet answered: a material passed NASA's flammability test on Earth, but will it burn on the Moon? It maps 174 verified findings from NASA's PSI combustion investigations and 38 NASA technical reports by gravity, oxygen and pressure, and shows that the conditions Artemis habitats and rovers will run at (lunar gravity, about 34% oxygen, 8.2 psia) have no verified evidence at all. NASA's own research says lunar gravity may sit near the most flammable point, so 0 g and 1 g results cannot simply bound it. FIREBREAK ranks evidence for a chosen mission, exports model-ready data with units, and ranks where NASA should run the next fire experiment. Every number links to a NASA source, page and machine-verified verbatim quote.

## Link to project demo

https://github.com/Criftal/Pyralith/blob/main/docs/FIREBREAK-demo-deck.pdf

## Link to final project

- Live site: https://firebreak-two.vercel.app
- Code: https://github.com/Criftal/Pyralith

## Detailed project description

**What it does.** FIREBREAK is an evidence map for fire safety in crewed spacecraft and Moon and Mars habitats. Pick a mission (ISS, Artemis lunar habitat, pressurized rover, EVA suit, Mars transit, Mars habitat) and every screen re-ranks NASA's combustion evidence for that environment:

- **Condition space (3D):** a scroll-driven fly-through placing every finding by gravity × O₂ × pressure, from the dense microgravity cloud to the empty lunar slab where Artemis will operate.
- **Gap Map:** verified findings binned by gravity and oxygen (or pressure, or flow), weighted by evidence tier. Empty cells are hatched; the mission's cell is outlined. The headline result: PSI holds zero partial-gravity combustion findings, and only 8 of 174 findings come from Artemis-like air.
- **Can we bound the Moon?** For six materials with both 0 g and 1 g data, shows the naive bound beside NASA's evidence that the flammability boundary is U-shaped, with its minimum near lunar gravity. Example: on the ISS, a PMMA rod burned at 13.6% O₂; in Earth gravity it blows off at 16%.
- **Ranked findings:** a transparent decision-value score (relevance to the mission × evidence tier × actionability, with a bonus where the source reports more flammable than at 1 g), adjustable weights, and prevention / detection / suppression filters.
- **Investigation explorer:** all 24 PSI combustion investigations with hardware, fuels, O₂ / pressure / flow ranges, sensors and data files, compared side by side.
- **Model-ready export:** CSV / JSON with explicit units, source, page and quote on every row, plus a data dictionary.
- **Next fire:** ranks under-tested condition cells near the mission, with cited reasons and the platforms that could reach them (FM2, LUCI, parabolic flight, ISS centrifuge).
- **Ask FIREBREAK:** keyword search over the evidence, plus an optional Claude mode that may only cite the records it is given; any sentence without a citation is removed.

**How it works.** A Python pipeline pulls PSI investigation records through the PSI JSON API, NTRS papers through the NTRS API, and cited web pages, then extracts text page by page. Findings and claims are extracted with verbatim quotes and test conditions as worded in the source. A verification gate checks that every quote appears on its cited page and every condition number appears in the source; failures are dropped, never edited. Unit conversion is done in code. 317 of 317 records passed, an independent search re-found 10 of 10 random quotes on their PDF pages, and 183 automated tests run on the pipeline and app. The front end is a static React app; the 3D scene uses three.js.

**Benefits and impact.** It turns decades of microgravity combustion data into decision support for the people designing Artemis and Mars habitats: where the evidence is, where it is missing, which findings matter most for a given cabin atmosphere, and which experiment would reduce the most uncertainty. It is a research exploration prototype, not a flight-safety tool.

**Tools and languages.** Python (requests, PyMuPDF, Beautiful Soup, pytest); TypeScript, React, Vite, Tailwind CSS, three.js, Lenis, MiniSearch, Vitest; Vercel hosting; optional Anthropic API (Claude Opus 5.5) for grounded answers.

## NASA data used

- NASA Physical Sciences Informatics (PSI) repository: 24 combustion investigations, including BASS, BASS-II, SPICE, SLICE, Saffire-I/II/III, SAME, SAME-R, DAFT, FLEX, FLEX-2, CFI and the six ACME experiments (BRE, CLD Flame, E-FIELD Flames, Flame Design, s-Flame, CFI-G). CC0.
- NASA Technical Reports Server (NTRS): 38 documents, including Olson 2004 (NASA/TM-2004-213114), Ferkul et al. 2026 (material flammability at lunar and Martian gravity), the LUCI rotating sounding rocket results, FM2 preparation papers, the NESC reduced-pressure ECLSS assessment, and the Saffire, FLEX, SAME and SoFIE reports.
- NASA web pages: Apollo 1 and Apollo 13 lessons learned, the 1997 Mir fire, the NASA Combustion Science pages.

Full list with links: REFERENCES.md in the repository.

## Use of SI (Super Intelligence) tools

Yes. Claude Code (Claude Opus 5.5) wrote the code (data pipeline, tests, web app and 3D scene) and extracted findings and claims from the NASA documents, working from our research question, design direction and review checkpoints. We did not use SI to come up with the idea. Every extracted quote and condition number is machine-checked against the source page by our verification gate, and records that fail are dropped. The one-line finding summaries in the app are SI-written and labelled "AI summary". The optional Ask mode uses Claude to summarise only retrieved, verified records, and labels its answers as SI-generated. Screenshots and renders in our slides are labelled "built with SI assistance". The README's AI-use section and the site footer carry the same disclosure.

## Resources used

Data: NASA PSI, NASA NTRS, NASA web pages (see above and REFERENCES.md). Software: React, Vite, TypeScript, Tailwind CSS, three.js, Lenis, MiniSearch, Vitest (MIT / Apache-2.0); PyMuPDF (AGPL-3.0, offline pipeline only); requests, Beautiful Soup, pytest, jsonschema; fonts Newsreader, Inter Tight and JetBrains Mono (SIL OFL 1.1); Anthropic TypeScript SDK; Vercel. No copyrighted images are used; all screenshots are of our own project.
