# FIREBREAK: pitch

**Check the format first.** The 2025 Space Apps guide asked for a demo video of up to 30 seconds *or* a slide deck of up to 7 slides including the title, hosted outside the Space Apps site. Videos needed English subtitles. The 2026 Project Submission Guide (released 13 Nov 2026) is at https://www.spaceappschallenge.org/resources/project-submission-guide/. Confirm the current limits there before recording.

## 60-second spoken pitch (live presentation)

**[0:00, Overview screen] Hook**
Every material that flies with NASA astronauts has passed Test 1, a burn test done here, in Earth gravity. The question nobody can answer yet is simple: *it passed on Earth, but will it burn on the Moon?*

**[0:10, Mission → Artemis lunar habitat, then Gap Map]**
We pulled NASA's PSI combustion investigations and 38 NASA technical reports into one map of gravity against oxygen. Artemis habitats will run at 34% oxygen and lunar gravity: this glowing cell. It's empty. PSI holds zero partial-gravity combustion data. Only 8 of our 174 verified findings come from an Artemis-like atmosphere at all.

**[0:25, "Can we bound the Moon?" panel]**
The obvious fix is to bound the Moon between 0 g and 1 g. NASA's own research says you can't. The flammability boundary is U-shaped: flames quench at low flow and blow off at high flow, and lunar gravity sits near the most flammable point. On the ISS, a PMMA rod burned at 13.6% oxygen. On Earth it blows off at 16%.

**[0:40, Ranked findings → Export]**
For any mission, we rank findings by how much they should change a design decision, and the weights are on screen. Researchers can export everything with units straight into their own flammability models. Every number links to a NASA page and a verbatim quote, and 317 out of 317 records passed our machine quote check.

**[0:52, Next fire]**
Then FIREBREAK says where NASA should light the next fire: lunar gravity, 30 to 40% oxygen, at the top of the list. That's exactly what LUCI and FM2, the first combustion experiment on the Moon, are about to measure. FIREBREAK is ready for their data.

## 7-slide deck (if submitting slides)

1. **Title:** FIREBREAK. *Passed on Earth. Safe on the Moon?* Team Pyralith (Aahaan Sharma, Michael Asabere), challenge: Flame in Freefall.
2. **The gap:** Test 1 runs at 1 g. Artemis cabins run 8.2 psia / 34% O₂. PSI has no partial-gravity combustion data. (Gap Map screenshot.)
3. **Why you can't interpolate:** the U-shaped flammability boundary, lunar gravity near the most flammable point, and the BASS-II PMMA example (13.6% vs 16% O₂). Cite Ferkul et al. 2026 and Olson 2004.
4. **How it works:**
   - NASA data used: PSI JSON API, NTRS, Claude-assisted extraction.
   - The quote-verification gate: 317 / 317 verified, plus 10/10 independent PDF spot-checks.
5. **For engineers:** decision-value ranking, prevention / detection / suppression filters, and CSV/JSON export with units.
6. **Where to light the next fire:** ranked condition gaps with cited reasons and platforms (FM2, LUCI, sounding rocket, ISS).
7. **Close:** live link https://firebreak-two.vercel.app. Not a safety tool; built to plug in LUCI and FM2 results when they land.

## 30-second video script (if submitting video; add English subtitles)

1. **(0–5 s)** Overview screen: "It passed NASA's flammability test on Earth. Will it burn on the Moon?"
2. **(5–14 s)** Gap Map with Artemis selected: "NASA's PSI archive holds zero partial-gravity combustion data, and Artemis will live right here."
3. **(14–22 s)** Bound panel: "You can't interpolate. NASA's research says lunar gravity is near the most flammable point."
4. **(22–30 s)** Next fire: "FIREBREAK ranks where to light the next fire. Every claim has a verified NASA quote."
