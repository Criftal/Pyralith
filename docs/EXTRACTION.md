# Extraction rules (humans and agents)

Candidate records go in `data/processed/candidates/<batch>.jsonl`, one JSON object per line.
`scripts/verify_quotes.py` gates everything: records that fail are **dropped, never edited to pass**.
IDs are assigned by `scripts/export.py`; don't write them.

## Finding record

```json
{"kind": "finding",
 "source_id": "NTRS:20040084156",
 "experiment": "Test 1",
 "psi_id": null,
 "platform": "review",
 "reported": {"gravity": "normal gravity", "o2": null, "pressure": null, "flow": null},
 "analogue_of_g": null,
 "material": null,
 "finding": "One plain-English sentence, max 30 words, faithful to the quote.",
 "finding_type": "test_method",
 "direction": "more_flammable_than_1g",
 "safety_area": ["prevention"],
 "quote": "verbatim from the source, 6-40 words",
 "page": 1,
 "evidence_tier": 4,
 "extracted_by": "<agent or person name>"}
```

1. **quote**: copy character-for-character from `data/raw/text/<SRC>.txt`, from a single page (the
   `=== PAGE n ===` marker above it gives `page`). 6-40 words, contiguous: no ellipses, no stitching,
   nothing spanning a page break. Prefer sentences that state a result together with its condition.
2. **reported**: the test conditions exactly as the source words them, e.g. `"8.2 psia"`,
   `"0.21 mole fraction"`, `"microgravity"`, `"lunar gravity"`, `"20 cm/s"`, `"quiescent"`. Every number
   you write here must appear in that source's text. `null` when the source doesn't state it for this
   finding. Never convert units yourself: `scripts/normalize.py` does it.
3. **finding**: one sentence, at most 30 words, that adds nothing the quote doesn't support.
4. **Enums** are in `src/types.ts` (Platform, FindingType, Direction, SafetyArea). Use
   `more_flammable_than_1g` / `less_flammable_than_1g` only when the source explicitly compares against
   normal (Earth) gravity; otherwise `neutral` or `n/a`.
5. **evidence_tier** follows where the underlying data came from, not the paper type:
   1 long-duration flight (ISS, Cygnus/Saffire, Shuttle) · 2 short-duration flight (sounding rocket,
   parabolic flight, drop tower) · 3 1-g lab · 4 model or review/opinion.
6. **psi_id**: the PSI investigation whose data the finding reports, else `null`.
   BASS PSI-26 · BASS-II PSI-25 · SPICE PSI-107 · SLICE PSI-106 · Saffire-I/II/III PSI-98/99/100 ·
   SAME PSI-102 · SAME-R PSI-101 · DAFT/DAFT-2 PSI-47 · FLEX PSI-69 · FLEX-2 PSI-68 · CFI PSI-39 ·
   ACME BRE PSI-20 · CLD Flame PSI-21 · E-FIELD Flames PSI-22 · s-Flame PSI-23 · Flame Design PSI-10 ·
   CFI-G PSI-159. SoFIE is not in PSI (psi_id null).
7. **analogue_of_g**: only when the source says a technique mimics a gravity level (e.g. E-FIELD's
   electric field), set to that level; else `null`.
8. Aim for 3-8 strong findings per paper: flammability limits, comparisons with 1 g, oxygen / pressure /
   flow effects, smoke and detection, suppression, implications for test methods and design.
9. Out of scope: rocket and propellant combustion.

## Claim record (cited sentences used in UI copy)

```json
{"kind": "claim", "id": "c_test1_not_conservative", "topic": "test1", "label": "NASA-STD-6001 Test 1",
 "text": "Our <=30-word paraphrase.", "source_id": "NTRS:20040084156", "page": 1,
 "quote": "verbatim, 6-40 words", "link": null, "extracted_by": "..."}
```

Topics: `test1`, `u_shape`, `lunar_flammability`, `partial_g_gap`, `exploration_atmosphere`, `high_o2`,
`future_experiment`, `platform`, `incident`, `context`.

## Source ids and text files

| source_id      | text file                         |
|----------------|-----------------------------------|
| `NTRS:<id>`    | `data/raw/text/NTRS_<id>.txt`     |
| `PSI:<PSI-n>`  | `data/raw/text/PSI_<PSI-n>.txt`   |
| `WEB:<slug>`   | `data/raw/text/WEB_<slug>.txt`    |
