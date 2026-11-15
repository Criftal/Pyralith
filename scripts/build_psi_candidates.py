#!/usr/bin/env python3
"""Write data/processed/candidates/psi.jsonl: candidate findings + claims from PSI record prose (PSI fork).

Self-check only (exact substring after whitespace collapse, word limits, enums, reported numbers present).
The authoritative gate is scripts/verify_quotes.py; nothing here edits a record to make it pass.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/Users/crfital/claude bs/firebreak")
TEXT = ROOT / "data" / "raw" / "text"
OUT = ROOT / "data" / "processed" / "candidates" / "psi.jsonl"
BY = "psi-fork"

PLATFORMS = {"ISS", "Cygnus", "Shuttle", "sounding_rocket", "parabolic", "drop_tower", "1g_lab", "model", "review"}
TYPES = {"flammability_limit", "spread_rate", "extinction", "ignition", "smoke_toxicity", "smoke_detection", "suppression", "test_method", "design_requirement"}
DIRS = {"more_flammable_than_1g", "less_flammable_than_1g", "neutral", "n/a"}
AREAS = {"prevention", "detection", "suppression"}
TOPICS = {"test1", "u_shape", "lunar_flammability", "partial_g_gap", "exploration_atmosphere", "high_o2", "future_experiment", "platform", "incident", "context"}


def psi_url(acc: str) -> str:
    return f"https://psi.nasa.gov/physci/repo/data/investigations/{acc}"


def R(gravity=None, o2=None, pressure=None, flow=None) -> dict:
    return {"gravity": gravity, "o2": o2, "pressure": pressure, "flow": flow}


def F(acc, experiment, platform, reported, finding, finding_type, safety, quote, tier, material=None, direction="n/a", psi_id="same"):
    return {
        "kind": "finding",
        "source_id": f"PSI:{acc}",
        "experiment": experiment,
        "psi_id": acc if psi_id == "same" else psi_id,
        "platform": platform,
        "reported": reported,
        "analogue_of_g": None,
        "material": material,
        "finding": finding,
        "finding_type": finding_type,
        "direction": direction,
        "safety_area": safety,
        "quote": quote,
        "page": 1,
        "evidence_tier": tier,
        "extracted_by": BY,
    }


def C(cid, topic, label, text, acc, quote):
    return {
        "kind": "claim",
        "id": cid,
        "topic": topic,
        "label": label,
        "text": text,
        "source_id": f"PSI:{acc}",
        "page": 1,
        "quote": quote,
        "link": psi_url(acc),
        "extracted_by": BY,
    }


BRE_MAT = "BRE gas burner emulating condensed fuels"

RECORDS = [
    # ---------------- BASS-II (PSI-25) ----------------
    F("PSI-25", "BASS-II", "ISS", R(gravity="microgravity"),
      "BASS-II tested the hypothesis that materials in ventilated microgravity burn as well as, or better than, the same materials in normal gravity.",
      "flammability_limit", ["prevention"],
      "BASS–II tests the hypothesis that materials in microgravity, with adequate ventilation, burn as well if not better than the same material in normal gravity with other conditions being identical",
      4),
    F("PSI-25", "BASS-II", "ISS", R(gravity="normal gravity"),
      "BASS-II's record says NASA's normal-gravity upward-burning test, considered worst case on Earth, may not be conservative for flammability in space.",
      "test_method", ["prevention"],
      "using an upward burning test in normal gravity, which is considered to be the worst-case geometry for flammability of the material on Earth. However, it may not be conservative for flammability in space.",
      4),
    F("PSI-25", "BASS-II", "ISS", R(),
      "BASS-II's record says its results help engineers select the safest materials and improve firefighting methods for future space missions.",
      "design_requirement", ["prevention", "suppression"],
      "BASS-II helps engineers select the safest materials and improve firefighting methods on future space missions.",
      4),
    C("c_psi25_test1_not_conservative", "test1", "NASA-STD-6001 Test 1",
      "BASS-II's PSI record notes NASA's normal-gravity upward-burning screening test is considered worst case on Earth but may not be conservative for flammability in space.",
      "PSI-25",
      "using an upward burning test in normal gravity, which is considered to be the worst-case geometry for flammability of the material on Earth. However, it may not be conservative for flammability in space."),
    # ---------------- BASS (PSI-26) ----------------
    F("PSI-26", "BASS", "ISS", R(gravity="microgravity"),
      "BASS notes that testing all but the thinnest materials needs longer microgravity time than drop towers or parabolic aircraft provide.",
      "test_method", ["prevention"],
      "To test this hypothesis with any but the thinnest materials requires extended microgravity time – longer than available in drop towers or parabolic aircraft.",
      4),
    F("PSI-26", "BASS", "ISS", R(gravity="microgravity"),
      "BASS used nitrogen as a flame suppressant in microgravity, which its record links directly to current and planned extinguishment techniques.",
      "suppression", ["suppression"],
      "Using nitrogen as a flame suppressant in microgravity provides a direct link to current and planned extinguishment techniques.",
      4),
    C("c_psi26_test1_ignores_low_g", "test1", "NASA-STD-6001 Test 1",
      "BASS's PSI record states NASA spacecraft materials selection uses NASA-STD-6001 Test 1, which sorts materials by 1-g behavior without considering low-gravity effects.",
      "PSI-26",
      "Current NASA spacecraft materials selection is based on a standard test method (NASA–STD–6001 Test 1) that segregates material based on 1-g behavior without consideration of low gravity effects."),
    # ---------------- ACME BRE (PSI-20) ----------------
    F("PSI-20", "BRE", "ISS", R(gravity="microgravity", flow="quiescent"),
      "BRE observed quasi-steady burning emulating materials like PMMA and nylon in microgravity with no airflow, though shutting off ventilation is an established step against spacecraft fires.",
      "extinction", ["suppression"],
      "Quasi-steady burning corresponding to various condensed-phase materials (such as PMMA and Nylon) was observed in microgravity despite the absence of air flow, where the cessation of ventilation is an established step in putting out spacecraft fires.",
      1, material=BRE_MAT),
    F("PSI-20", "BRE", "ISS", R(gravity="microgravity", o2="21% oxygen", flow="quiescent"),
      "In BRE, flames burning without airflow in a normal 21% oxygen atmosphere self-extinguished in a short time.",
      "extinction", ["suppression"],
      "The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft, whereas such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time.",
      1, material=BRE_MAT),
    F("PSI-20", "BRE", "ISS", R(gravity="microgravity", flow="quiescent"),
      "In BRE, combustion continued without airflow in elevated-oxygen atmospheres that are being considered for future spacecraft.",
      "flammability_limit", ["prevention", "suppression"],
      "The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft",
      1, material=BRE_MAT),
    F("PSI-20", "BRE", "ISS", R(gravity="microgravity"),
      "Preliminary BRE results suggest NASA may want to use its cone-calorimeter flammability Test 2 more, since it measures properties matching the microgravity flames observed.",
      "test_method", ["prevention"],
      "they suggest that NASA may want to increase use of its alternative flammability Test 2, with the cone calorimeter, where that test can measure material properties corresponding to the microgravity flames observed with the BRE burner.",
      1),
    C("c_psi20_crew_atmospheres", "exploration_atmosphere", "ACME BRE test atmospheres",
      "ACME BRE planned microgravity tests at NASA-considered crew atmospheres: 14.7 psia with 21% O2, 10.2 psia with 26.5%, and 8.2 psia with 34%.",
      "PSI-20",
      "NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen."),
    C("c_psi20_high_o2_no_flow", "high_o2", "BRE: elevated O2, no airflow",
      "In BRE, flames kept burning without airflow in elevated-oxygen atmospheres considered for future spacecraft, while flames at 21% oxygen self-extinguished quickly.",
      "PSI-20",
      "The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft, whereas such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time."),
    # ---------------- ACME Flame Design (PSI-10) ----------------
    F("PSI-10", "Flame Design", "ISS", R(gravity="microgravity"),
      "Flame Design tested the hypothesis that microgravity spherical diffusion flames extinguish when their peak temperature first falls below 1130 K.",
      "extinction", [],
      "Microgravity spherical diffusion flames extinguish when the peak temperature first decreases below 1130 K.",
      4),
    # ---------------- ACME CFI-G (PSI-159) ----------------
    F("PSI-159", "CFI-G", "ISS", R(gravity="microgravity"),
      "CFI-G set out to show in flight cool diffusion flames that extinguish when flow rate drops but transition to hot flames when it rises.",
      "ignition", ["prevention"],
      "Cool diffusion flames for which a decrease in fluent flow rate will cause extinction, whereas an increase will cause a transition to a hot diffusion flame, with oscillation possible between hot and cool flames.",
      4),
    # ---------------- ACME E-FIELD Flames (PSI-22): claims only ----------------
    C("c_psi22_ion_driven_convection", "context", "E-FIELD Flames",
      "In E-FIELD Flames, the applied electric field acted on ions from chemi-ionization, driving ion-driven convection that influenced flame behavior.",
      "PSI-22",
      "The electric field interacts with ions generated through chemi-ionization during combustion, driving ion-driving convection and influencing flame behavior."),
    C("c_psi22_not_for_space", "context", "E-FIELD Flames: stated purpose",
      "E-FIELD Flames' PSI record says the research was not conducted to serve space applications, though findings might aid future space combustion devices.",
      "PSI-22",
      "The E-FIELD Flames research is not being conducted to serve any space applications, but it is possible that its findings could aid the development of future space-based combustion devices"),
    # ---------------- DAFT / DAFT-2 (PSI-47) ----------------
    F("PSI-47", "DAFT", "ISS", R(gravity="microgravity"),
      "DAFT/DAFT-2 tested whether a modified P-Trak particulate counter would be accurate in microgravity.",
      "smoke_detection", ["detection"],
      "DAFT / DAFT-2 tests that a modified P-Trak particulate counter would be accurate in microgravity.",
      4),
    F("PSI-47", "DAFT", "ISS", R(),
      "DAFT's record states that longer missions with larger vessels will require fire detection systems with greater reliability and sensitivity.",
      "design_requirement", ["detection"],
      "Extended duration space flight missions with larger vessels will require fire detection systems with increased reliability and sensitivity.",
      4),
    # ---------------- FLEX (PSI-69) ----------------
    F("PSI-69", "FLEX", "ISS", R(gravity="microgravity"),
      "FLEX tested whether the lack of buoyant convection in microgravity significantly changes flammability limits and fire-suppressant efficacy compared with normal gravity.",
      "suppression", ["prevention", "suppression"],
      "Specifically, the hypothesis posits that the lack of buoyant convection in microgravity will lead to significant differences in the flammability limits and suppression efficacy of various fire suppressant agents compared to normal gravity conditions.",
      4),
    F("PSI-69", "FLEX", "ISS", R(gravity="microgravity"),
      "FLEX's record says its microgravity findings on CO2, helium and SF6 suppressants can lead to more efficient, less harmful fire suppression systems.",
      "suppression", ["suppression"],
      "The mission's findings on the effectiveness of various fire suppressants, including CO2, He, and SF6, in microgravity can lead to the development of more efficient and less harmful fire suppression systems, reducing the risk of toxic byproducts during fire events.",
      4),
    # ---------------- FLEX-2 (PSI-68): claim only ----------------
    C("c_psi68_o2_to_0p4", "high_o2", "FLEX-2 test atmospheres",
      "FLEX-2's ISS droplet tests varied pressure from 0.5 to 3.0 atm and O2 concentration from 0.1 to 0.4 mole fraction.",
      "PSI-68",
      "The chamber was filled with the appropriate atmosphere, which was varied in pressure between 0.5 atm to 3.0 atm and O2 concentration between 0.1 to 0.4 mole fraction with the diluent gas making up the balance."),
    # ---------------- Saffire (PSI-98, PSI-99) ----------------
    F("PSI-98", "Saffire-I", "Cygnus", R(),
      "Saffire's premise: because fire behaves very differently in normal and reduced gravity, designing spacecraft fire safety from terrestrial fires and standards carries inherent risk.",
      "test_method", ["prevention"],
      "This investigation hypothesizes that due to large differences between fire behavior in normal and reduced gravity, the use of terrestrial fires and fire standards to design spacecraft fire safety systems presents an inherent risk to the vehicle",
      4),
    C("c_psi98_microgravity_data_gap", "context", "Saffire: data gap",
      "Saffire's PSI record states spacecraft designers lack microgravity fire data on which to base fire safety designs and procedures.",
      "PSI-98",
      "There is a significant lack of microgravity data available for spacecraft designers on which to base their fire safety designs and procedures."),
    F("PSI-99", "Saffire-II", "Cygnus", R(gravity="microgravity"),
      "Saffire results determine microgravity flammability limits for several spacecraft materials and help validate NASA's material selection criteria.",
      "flammability_limit", ["prevention"],
      "Results determine microgravity flammability limits for several spacecraft materials, help to validate NASA’s material selection criteria, and how microgravity and limited oxygen affect flame size.",
      1),
    # ---------------- SAME (PSI-102), SAME-R (PSI-101) ----------------
    F("PSI-102", "SAME", "ISS", R(gravity="microgravity"),
      "SAME tested the hypothesis that liquid aerosol smoke produced in microgravity has substantially larger droplets than smoke produced under the same conditions in normal gravity.",
      "smoke_detection", ["detection"],
      "it is hypothesized that liquid aerosol smokes produced in microgravity will exhibit substantially larger droplet sizes than under the same conditions in normal gravity",
      4),
    F("PSI-102", "SAME", "ISS", R(gravity="microgravity"),
      "SAME's hypothesis: changed smoke size distribution and number density will affect smoke detector response, possibly leaving some detectors silent.",
      "smoke_detection", ["detection"],
      "The change in the size distribution and number density will, in turn, affect the response of the smoke detectors and possibly result in some detectors not producing an alarm when exposed to this smoke.",
      4),
    F("PSI-101", "SAME-R", "ISS", R(),
      "SAME-R's record says its results can lead to technology for an advanced fire detector for future long-duration spacecraft missions.",
      "smoke_detection", ["detection"],
      "the results from SAME-R can lead to technology for an advanced fire detector for future spacecraft that will be used for long duration missions.",
      4),
    # ---------------- PSI-funded analysis studies ----------------
    F("PSI-62", "other", "model", R(gravity="microgravity"),
      "PSI-62 hypothesized its unsteady flamelet-manifold model could reproduce concurrent flame spread in microgravity, including the 'Goldilocks' flammability zone.",
      "flammability_limit", ["prevention"],
      "The unsteady flamelet generated manifold (UFGM) approach was believed to be able to accurately reproduce concurrent flame spread in microgravity, including phenomena such as the “Goldilocks” flammability zone",
      4),
    F("PSI-115", "other", "model", R(gravity="microgravity"),
      "PSI-115 hypothesized that without buoyancy, reduced mixing and heat transfer alter combustion-vapor history and particle trajectories, changing smoke composition.",
      "smoke_detection", ["detection"],
      "Without buoyancy, mixing and heat transfer are reduced, the time-temperature history of the combustion vapors (or particle precursors) and particle trajectories are significantly altered, changing the composition of the smoke.",
      4),
    F("PSI-142", "other", "model", R(),
      "PSI-142 found the flammable region of warm and cool flames expands at elevated pressures, due to increased low- and intermediate-temperature reactivity.",
      "flammability_limit", ["prevention"],
      "At elevated pressures, it was found that the flammable region of warm flames and cool flames expands due to the increase in low-temperature and intermediate-temperature reactivity with pressure.",
      4),
]


def ws(s: str) -> str:
    return " ".join(s.split())


def page_text(source_id: str) -> str:
    d = json.loads((TEXT / f"{source_id.replace(':', '_')}.json").read_text())
    return d["pages"][0]


def check(rec: dict) -> list[str]:
    errs = []
    src = page_text(rec["source_id"])
    q = rec["quote"]
    if ws(q) not in ws(src):
        errs.append("quote not found verbatim")
    n = len(q.split())
    if not 6 <= n <= 40:
        errs.append(f"quote has {n} words")
    if rec["kind"] == "finding":
        if len(rec["finding"].split()) > 30:
            errs.append(f"finding has {len(rec['finding'].split())} words")
        if rec["platform"] not in PLATFORMS:
            errs.append("platform")
        if rec["finding_type"] not in TYPES:
            errs.append("finding_type")
        if rec["direction"] not in DIRS:
            errs.append("direction")
        if not set(rec["safety_area"]) <= AREAS:
            errs.append("safety_area")
        if rec["evidence_tier"] not in (1, 2, 3, 4):
            errs.append("tier")
        for k, v in rec["reported"].items():
            if v is None:
                continue
            if ws(v).lower() not in ws(src).lower():
                errs.append(f"reported {k} {v!r} not in source")
            for num in re.findall(r"\d+(?:\.\d+)?", v):
                if not re.search(rf"(?<![\d.]){re.escape(num)}(?![\d])", src):
                    errs.append(f"reported number {num} not in source")
    else:
        if rec["topic"] not in TOPICS:
            errs.append("topic")
        if len(rec["text"].split()) > 30:
            errs.append(f"claim text has {len(rec['text'].split())} words")
    return errs


def main() -> None:
    bad = 0
    for rec in RECORDS:
        errs = check(rec)
        if errs:
            bad += 1
            print("FAIL", rec["source_id"], rec.get("id") or rec["finding"][:60], errs)
    ids = [r["id"] for r in RECORDS if r["kind"] == "claim"]
    assert len(ids) == len(set(ids)), "duplicate claim ids"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w") as f:
        for rec in RECORDS:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    nf = sum(r["kind"] == "finding" for r in RECORDS)
    print(f"wrote {len(RECORDS)} records ({nf} findings, {len(RECORDS) - nf} claims); self-check failures: {bad}")


if __name__ == "__main__":
    main()
