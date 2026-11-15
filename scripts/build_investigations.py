#!/usr/bin/env python3
"""Build data/processed/investigations.json from cached PSI records (PSI fork builder).

Numeric ranges are computed here from the PSI experiment tables (or, where the table is silent,
from numbers stated in the record prose), with unit conversion done in code.
Descriptive fields (fuel, shape, variables, sensors, ...) were read from each record by the PSI fork
and are written below per investigation; nothing is filled in that the record doesn't state.
"""
from __future__ import annotations

import collections
import csv
import io
import json
import math
import re
from pathlib import Path

ROOT = Path("/Users/crfital/claude bs/firebreak")
RAW = ROOT / "data" / "raw" / "psi"
OUT = ROOT / "data" / "processed" / "investigations.json"

FLIGHT = "PSI-10 PSI-20 PSI-21 PSI-22 PSI-23 PSI-25 PSI-26 PSI-39 PSI-47 PSI-68 PSI-69 PSI-98 PSI-99 PSI-100 PSI-101 PSI-102 PSI-106 PSI-107 PSI-159".split()
ANALYSIS = "PSI-60 PSI-62 PSI-115 PSI-117 PSI-142".split()

ACME = {"PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"}
MDCA = {"PSI-39", "PSI-68", "PSI-69"}
MSG = {"PSI-25", "PSI-26", "PSI-106", "PSI-107"}

# multiply a value in this unit to get the canonical unit (% / kPa / cm/s)
UNIT = {"frac": 100.0, "pct": 1.0, "atm": 101.325, "mmHg": 0.133322, "bar": 100.0, "psia": 6.894757, "cm/s": 1.0, "mm/s": 0.1}
NUM = re.compile(r"\d+(?:\.\d+)?|\.\d+")
PCT = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def norm(h: str) -> str:
    return " ".join(h.replace("﻿", "").split()).lower()


def table_rows(acc: str) -> list[dict]:
    """Rows from every experiment table of an investigation (PSI-10 and PSI-159 have normal + inverse tables)."""
    out: list[dict] = []
    for p in sorted(RAW.glob(f"{acc}_experimental_table*.csv")):
        raw = p.read_bytes()
        try:
            txt = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            txt = raw.decode("latin-1")
        rows = list(csv.reader(io.StringIO(txt)))
        if not rows:
            continue
        hdr = [norm(h) for h in rows[0]]
        out += [
            {hdr[i]: (r[i] if i < len(r) else "") for i in range(len(hdr))}
            for r in rows[1:]
            if any(c.strip() for c in r)
        ]
    return out


def cell_numbers(cell: str, pct_only: bool) -> list[float]:
    s = cell.strip()
    if not pct_only:
        try:
            return [float(s)]  # plain number, keeps its sign (e.g. SPICE's "-5.92")
        except ValueError:
            pass
    # multi-value cells like "0.17; 0.21;0.25; 0.3", "1.5 - 5", "~ 21.5", "~30% and ~21% O2"
    return [float(x) for x in (PCT.findall(s) if pct_only else NUM.findall(s))]


# physically meaningful values only: drops placeholders like FLEX's pressure "0" and SPICE's negative air rates
VALID = {
    "o2": lambda v: 0 < v <= 100,  # also drops Excel artefacts like "3400%"
    "pressure": lambda v: v > 0,
    "flow": lambda v: v >= 0,
    "size": lambda v: v > 0,
}


def column_values(rows: list[dict], col: str, unit: str, dim: str, pct_only: bool = False) -> list[float]:
    key = norm(col)
    if rows and not any(key in r for r in rows):
        raise KeyError(f"column {col!r} not in any table: {list(rows[0])}")
    vals = []
    for r in rows:
        for n in cell_numbers(r.get(key, ""), pct_only):
            v = n * UNIT[unit]
            if VALID[dim](v):
                vals.append(v)
    return vals


def to_range(vals: list[float], nd: int):
    if not vals:
        return None
    lo, hi = min(vals), max(vals)
    assert not (math.isnan(lo) or math.isnan(hi))
    return [round(lo, nd), round(hi, nd)]


def compute(spec, rows, nd, dim):
    """spec: None | ("table", [(col, unit, opts...)]) | ("prose", [values], unit) | ("upto", value, unit)"""
    if spec is None:
        return None
    kind = spec[0]
    if kind == "table":
        vals = []
        for item in spec[1]:
            col, unit, *opt = item
            o = opt[0] if opt else {}
            vals += column_values(rows, col, unit, dim, pct_only=o.get("pct_only", False))
        return to_range(vals, nd)
    if kind == "prose":
        return to_range([v * UNIT[spec[2]] for v in spec[1]], nd)
    if kind == "upto":  # "up to X" -> [0, X]
        return [0, round(spec[1] * UNIT[spec[2]], nd)]
    raise ValueError(spec)


def human(nbytes: float) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if nbytes < 1024 or unit == "TB":
            return f"{nbytes:.0f} B" if unit == "B" else f"{nbytes:.1f} {unit}"
        nbytes /= 1024
    return ""


def year(d: str | None):
    m = re.search(r"(\d{4})\s*$", d or "")
    return m.group(1) if m else None


def clean_doi(d: str) -> str:
    d = d.strip()
    d = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", d, flags=re.I)
    return d.strip()


SAFFIRE_SENSORS = ["two cameras", "thermocouples", "two radiometers", "solid state sensors (pressure, CO2, O2)", "two anemometers"]
SAFFIRE_MEAS = ["flame images", "flow, flame and plume temperatures", "flame radiation", "pressure", "CO2 mole fraction", "O2 mole fraction", "flow velocity"]

MANUAL: dict[str, dict] = {
    "PSI-10": dict(
        fuel_phase=["gas"], fuel="C2H4, C3H8", fuel_shape="spherical diffusion flames (normal and inverse)", sample_size=None,
        o2=("table", [("XO2 (init)", "frac"), ("XO2 (final)", "frac"), ("XO2", "frac")]),
        pressure=("table", [("pinit (atm)", "atm"), ("pfinal (atm)", "atm")]),
        flow=None,
        variables=["fuel", "fuel mole fraction (N2 dilution)", "fuel and N2 flow rates", "ambient O2 concentration", "pressure"],
        within="In the normal-flame table, tests varied the fuel (C2H4 or C3H8), its mole fraction (Xfuel) and the fuel and N2 mass flow rates, in ambients of about 20% or 36-40% O2 (XO2) at roughly 1 or 1.3 atm; in the inverse-flame table the O2/N2 oxidizer (XO2) flowed from the burner into an ethylene ambient.",
        sensors=["cameras", "radiometers", "photomultiplier tubes", "thermocouples"],
        measurement_types=["soot-inception limits", "flame temperature", "flame size", "flame color", "soot volume fraction", "extinction limits"],
        safety_area=[],
    ),
    "PSI-20": dict(
        fuel_phase=["gas"], fuel="C2H4, CH4", fuel_shape="porous circular burner", sample_size="25 and 50 mm diameter burners",
        o2=("table", [("Oxygen Conc (percent)", "pct", {"hi": 100})]),
        pressure=("prose", [14.7, 10.2, 8.2], "psia"),
        flow=None,
        variables=["burner size", "fuel (C2H4 or CH4, N2 dilution)", "O2 concentration", "pressure"],
        within="Tests varied burner size (25 or 50 mm), fuel bottle (100% or 50% C2H4, 100% CH4) and oxygen concentration (21-40%); the table notes chamber pressures were also varied but does not list them.",
        sensors=["heat flux sensor"],
        measurement_types=["burner surface temperature", "heat flux", "extinction limits", "flammability map"],
        safety_area=["prevention", "suppression"],
    ),
    "PSI-21": dict(
        fuel_phase=["gas"], fuel="methane, ethylene", fuel_shape="coflow burner", sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["fuel (methane or ethylene)", "fuel dilution (N2)", "velocity"],
        within="Methane-based and ethylene-based tests varied the fuel bottle and the nitrogen-diluted fuel concentration (25%-100%), the objective naming velocity and fuel dilution as the varied parameters.",
        sensors=[],
        measurement_types=["flame shape", "lift-off height", "OH* and CH* chemiluminescence", "gas temperature (thin-filament pyrometry)", "soot luminosity", "soot temperature", "soot volume fraction (laser extinction)", "extinction limits"],
        safety_area=["suppression"],
    ),
    "PSI-22": dict(
        fuel_phase=["gas"], fuel="methane, ethylene", fuel_shape="gas-jet burner and coflow burner", sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["burner (coflow or gas-jet)", "fuel", "fuel dilution (N2)", "electrode mesh polarity", "electric field strength", "fuel flow rate", "coflow velocity"],
        within="Tests used a coflow burner and then a gas-jet burner, varying fuel bottle (100% or 40% CH4, 100% or 30% C2H4), fuel concentration (25%-100%) and mesh polarity (negative or positive), with up to 10 kV applied.",
        sensors=["high-resolution cameras", "spectral imaging with filters", "thermopile detectors"],
        measurement_types=["ion current", "voltage-current curves", "flame response time", "flame shape", "luminosity", "soot distribution", "chemiluminescent emissions", "soot volume fraction", "flame radiant emissions"],
        safety_area=[],
    ),
    "PSI-23": dict(
        fuel_phase=["gas"], fuel="H2, CH4, C2H4", fuel_shape="spherical porous burner", sample_size=None,
        o2=("table", [("Atmosphere*", "pct", {"pct_only": True})]),
        pressure=("prose", [1], "atm"),  # table note: "Atmosphere is ~1 atm"
        flow=None,
        variables=["fuel mixture (H2, CH4, C2H4)", "fuel diluent (N2 or He)", "ambient O2 (~21% or ~30%)", "flow rate"],
        within="Tests varied the fuel bottle (C2H4, CH4, H2 and H2/CH4 blends), the diluent (nitrogen in the first round, helium in the second) and ambient oxygen (~21% or ~30% O2) at about 1 atm.",
        sensors=[],
        measurement_types=["spectrally resolved images", "flame temperature", "burner temperature", "radiative flux", "reactant flow rates", "ambient temperature and pressure", "acceleration levels"],
        safety_area=[],
    ),
    "PSI-25": dict(
        fuel_phase=["solid"], fuel="PMMA, SIBAL (cotton-fiberglass), Nomex, Japan wax",
        fuel_shape="films, slabs, rods, spherical sections, fabric sheets",
        sample_size="PMMA films 0.1-0.4 mm and slabs 1-5 mm thick, 1-2 cm wide; PMMA rods 1/4-1/2 in; 4 cm spherical section; 1-2 cm SIBAL",
        o2=("table", [("Calibrated initial O2 % by vol", "pct")]),
        pressure=None,
        flow=("upto", 40, "cm/s"),  # "airflow speeds up to 40 cm/s"
        variables=["flow speed", "flow direction (opposed or concurrent)", "O2 concentration (N2 vitiation)", "sample material", "sample geometry and thickness"],
        within="Tests varied PMMA film, slab and rod thickness and geometry (plus SIBAL, Nomex and wax samples), fan-set airflow up to 40 cm/s and initial O2 (lowered by adding nitrogen), in opposed and concurrent flow.",
        sensors=["radiometer", "MSG imaging"],
        measurement_types=["flame appearance", "flame growth", "flame spread rate", "O2 concentration", "CO2 concentration", "CO concentration"],
        safety_area=["prevention", "suppression"],
    ),
    "PSI-26": dict(
        fuel_phase=["solid"], fuel="SIBAL (cotton-fiberglass), PMMA, Nomex, Ultem, paraffin and Japan wax",
        fuel_shape="fabric sheets, spheres, slabs, cylinders, candles",
        sample_size="1 and 2 cm samples (fabric strips, PMMA spheres)",
        o2=None, pressure=None,
        flow=("upto", 40, "cm/s"),  # "airflow speeds reaching as high as 40 cm/s"
        variables=["sample material", "sample geometry", "flow direction (opposed or concurrent)", "flow speed", "nitrogen suppressant"],
        within="Tests varied material (SIBAL, PMMA, Nomex, Ultem, wax), geometry (fabric, spheres, slabs, candles, wake configurations), flow direction and fan-driven airflow up to 40 cm/s, and assessed a nitrogen extinguishing agent.",
        sensors=[],
        measurement_types=["flame size", "flame shape", "flame color", "flame spread rate", "flame quenching"],
        safety_area=["prevention", "suppression"],
    ),
    "PSI-39": dict(
        fuel_phase=["liquid"], fuel="n-dodecane, n-dodecane/iso-dodecane mixtures, farnesane",
        fuel_shape="droplet (needle-deployed or SiC-fiber tethered)", sample_size=None,
        o2=("table", [("Oxygen", "frac")]),
        pressure=("table", [("Pressure", "atm")]),
        flow=None,
        variables=["pressure", "O2 concentration", "helium dilution", "fuel mixture", "fiber support"],
        within="Tests varied pressure (0.5-5 atm), oxygen (0.17 or 0.21 mole fraction), helium dilution (0-0.59), fuel (n-dodecane or n-dodecane/iso-dodecane blends) and fiber-supported versus unsupported droplets.",
        sensors=["black-and-white camera", "UV camera", "high resolution cameras", "narrow-band radiometer", "wide-band radiometer"],
        measurement_types=["droplet size", "OH* emission", "flame size", "flame radiation"],
        safety_area=[],
    ),
    "PSI-47": dict(
        fuel_phase=[], fuel=None, fuel_shape=None, sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["instrument (modified P-Trak or DustTrak)", "sampled location"],
        within="Session D1 used the modified P-Trak and session D2 the DustTrak, both measuring an Arizona Road Dust aerosol at different ISS locations.",
        sensors=["TSI P-Trak (modified)", "DustTrak"],
        measurement_types=["aerosol particle counts"],
        safety_area=["detection"],
    ),
    "PSI-68": dict(
        fuel_phase=["liquid"], fuel="isooctane, n-octane, heptane, decane, ethanol, propanol/glycerol, heptane/isooctane",
        fuel_shape="droplet (free, fiber-supported or binary array)", sample_size="1.5-5 mm initial droplet diameter",
        o2=("table", [("Oxygen Mole Fraction", "frac")]),
        pressure=("table", [("Ambient Pressure (atm)", "atm")]),
        flow=("table", [("Flow Velocity (cm/s)", "cm/s")]),
        variables=["fuel type", "ambient gas composition", "pressure", "droplet initial diameter", "droplet translation velocity", "droplet spacing (arrays)"],
        within="Tests varied fuel (pure and bi-component), O2 mole fraction (0.17-0.3) in N2 or He, pressure (0.5-3 atm), droplet size (1.5-5 mm), translation velocity (0.1-5 cm/s) and array spacing.",
        sensors=["color camera"],
        measurement_types=["droplet burning", "flame evolution", "flame extinction", "soot volume fraction", "chamber pressure", "chamber temperature"],
        safety_area=["prevention", "suppression"],
    ),
    "PSI-69": dict(
        fuel_phase=["liquid"], fuel="methanol, heptane", fuel_shape="droplet (free or fiber-supported)",
        sample_size=("table_mm", "Droplet initial diameter; mm"),
        o2=("table", [("O initial ambient composition; mole fraction", "frac")]),
        pressure=("table", [("Ambient pressure; mmHg", "mmHg")]),
        flow=None,
        variables=["fuel", "pressure", "O2 concentration", "CO2 diluent", "He diluent", "droplet initial diameter"],
        within="Tests varied fuel (methanol or heptane), ambient pressure, initial O2 mole fraction, CO2 or He dilution and droplet size, recording extinction diameter, burning rate and burn time.",
        sensors=[],
        measurement_types=["droplet burning rate", "visible flame extinction diameter", "burn time", "heat radiation", "soot levels", "temperature profiles"],
        safety_area=["prevention", "suppression"],
    ),
    "PSI-98": dict(
        platform="Cygnus",
        fuel_phase=["solid"], fuel="SIBAL (cotton-fiberglass fabric)", fuel_shape="fabric sheet", sample_size="0.37 cm x 40.6 cm x 94 cm",
        o2=("table", [("Percent O2", "pct")]),
        pressure=None,
        flow=("table", [("Air Flow (cm/s)", "cm/s")]),
        variables=["flow direction (concurrent or opposed)"],
        within="Two SIBAL fabric samples burned in a 20 cm/s airflow, one in concurrent and one in opposed flow.",
        sensors=SAFFIRE_SENSORS, measurement_types=SAFFIRE_MEAS,
        safety_area=["prevention"],
    ),
    "PSI-99": dict(
        platform="Cygnus",
        fuel_phase=["solid"], fuel="silicone, SIBAL (cotton-fiberglass), PMMA, Nomex", fuel_shape="sheet samples",
        sample_size="5 cm x 29 cm; 0.27 mm to 1 cm thick",
        o2=("table", [("Percent O2 (Note 1)", "pct")]),
        pressure=None,
        flow=("table", [("Air Flow (cm/s)", "cm/s")]),
        variables=["material", "sample thickness", "flow direction (concurrent or opposed)"],
        within="Nine samples varied material (silicone, SIBAL, PMMA, PMMA with Nomex), thickness (0.27 mm to 1 cm) and flow direction; the table lists 20 cm/s for every sample, while the record prose says 20 or 30 cm/s.",
        sensors=SAFFIRE_SENSORS, measurement_types=SAFFIRE_MEAS + ["burn length", "spread rate"],
        safety_area=["prevention"],
    ),
    "PSI-100": dict(
        platform="Cygnus",
        fuel_phase=["solid"], fuel="SIBAL (cotton-fiberglass fabric)", fuel_shape="fabric sheet", sample_size="0.33 cm x 94 cm x 40.6 cm",
        o2=None, pressure=None,
        flow=("table", [("Air Flow", "cm/s")]),
        variables=["flow direction (concurrent or opposed)"],
        within="Two SIBAL fabric samples burned at 30 cm/s (versus 20 cm/s in Saffire-I), one in concurrent and one in opposed flow.",
        sensors=SAFFIRE_SENSORS, measurement_types=SAFFIRE_MEAS,
        safety_area=["prevention"],
    ),
    "PSI-101": dict(
        fuel_phase=["solid"], fuel="Kapton, silicone, lampwick, Teflon, Pyrell foam", fuel_shape=None, sample_size=None,
        o2=None, pressure=None,
        flow=("table", [("Inlet velocity (cm/s)", "cm/s")]),
        variables=["sample material", "inlet velocity", "heating temperature", "aging time"],
        within="Tests overheated five materials (Kapton, silicone, lampwick, Teflon, Pyrell) at inlet velocities of 0-8.1 cm/s with different heating temperatures and smoke aging times.",
        sensors=["M-pass", "DustTrak", "ionization detector", "thermal precipitators"],
        measurement_types=["smoke particle size distribution", "smoke aging"],
        safety_area=["detection"],
    ),
    "PSI-102": dict(
        fuel_phase=["solid", "liquid"], fuel="Teflon, Kapton, silicone rubber, lampwick, dibutyl phthalate", fuel_shape=None, sample_size=None,
        o2=None, pressure=None,
        flow=("table", [("Air Flow (cm/s)", "cm/s")]),
        variables=["sample material", "air flow", "aging duration"],
        within="Tests heated five materials at air flows of 5 or 10 cm/s with aging durations of 1 or 20 minutes.",
        sensors=["two smoke detectors", "video cameras", "thermophoretic soot samplers"],
        measurement_types=["primary and aggregate particle dimensions (TEM)", "sample mass loss", "smoke detector response"],
        safety_area=["detection"],
    ),
    "PSI-106": dict(
        fuel_phase=["gas"], fuel="methane, ethylene", fuel_shape="exchangeable burner tubes in coflow", sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["fuel", "nitrogen dilution", "burner diameter", "coflow velocity"],
        within="Tests ran 100%, 70% and 40% CH4 and 20% C2H4 (balance N2), with burner diameter and coflow velocity as the other studied parameters.",
        sensors=["high resolution camera", "flow rate and temperature sensors"],
        measurement_types=["flame structure images", "liftoff velocity limits", "flow rate", "temperature", "soot formation"],
        safety_area=[],
    ),
    "PSI-107": dict(
        fuel_phase=["gas"], fuel="methane, ethylene, propane, propylene, propylene mixtures", fuel_shape="co-flow jet nozzle",
        sample_size="nozzle diameters 0.41, 0.76 and 1.6 mm",
        o2=None, pressure=None,
        flow=("table", [("Air Rate (cm/s)", "cm/s")]),
        variables=["fuel", "nozzle diameter", "fuel flow rate", "co-flow air velocity"],
        within="Tests varied fuel, nozzle diameter (0.41, 0.76 or 1.6 mm), fuel flow rate and co-flow air velocity to find each flame's smoke point; the table's non-negative air rates span 0.66-85.28 cm/s, while the record prose states 5.4-65 cm/s.",
        sensors=["still cameras", "video cameras"],
        measurement_types=["luminous flame length", "smoke point", "radiative heat loss", "co-flow air velocity distribution"],
        safety_area=[],
    ),
    "PSI-159": dict(
        fuel_phase=["gas"], fuel="ethane, propane, butane", fuel_shape="spherical porous burner", sample_size=None,
        o2=("table", [("XO2 before test", "frac"), ("XO2 after test", "frac"), ("XO2", "frac")]),
        pressure=("table", [("approx p (bar)", "bar")]),
        flow=None,
        variables=["fuel", "fuel dilution", "O2 concentration", "pressure", "fuel flow rate"],
        within="In the normal-flame table, tests varied the fuel (ethane, propane or butane, pure or diluted), ambient XO2, pressure (about 0.5-3 bar) and fuel flow rate; in the inverse-flame table the O2/N2 oxidizer (XO2) flowed from the burner into a fuel-laden ambient.",
        sensors=["cameras", "radiometers", "photomultiplier tubes", "thermocouples"],
        measurement_types=["cool flame occurrence", "hot ignition", "burn time", "self-extinction", "peak burner temperature"],
        safety_area=["prevention"],
    ),
    # --- PSI-funded analysis studies of flight data (no flight hardware of their own) ---
    "PSI-60": dict(
        fuel_phase=["gas"], fuel=None, fuel_shape="Yale and ACME burner configurations (simulated)", sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["gravity (normal vs microgravity)", "burner configuration", "soot model parameters"],
        within="Simulations of Yale and ACME burner configurations under normal and microgravity were compared with soot temperatures and volume fractions derived from over 1600 SPICE images.",
        sensors=["DSLR cameras (SPICE imagery)"],
        measurement_types=["soot temperature (color-ratio pyrometry)", "soot volume fraction"],
        safety_area=["detection", "suppression"],
    ),
    "PSI-62": dict(
        fuel_phase=["solid"], fuel="PMMA, wax", fuel_shape="flat sheets, spheres, rods, wax cylinders", sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["sample geometry", "microgravity vs normal-gravity comparison"],
        within="Unsteady flamelet-manifold simulations of BASS geometries (flat sheets, spheres, PMMA rods, wax cylinders) were compared with two-color tomography of BASS and BASS-II imagery.",
        sensors=["DSLR cameras (BASS imagery)"],
        measurement_types=["flame geometry", "temperature distribution", "soot volume fraction", "flame spread rate"],
        safety_area=["prevention"],
    ),
    "PSI-115": dict(
        fuel_phase=["liquid"], fuel="dibutyl phthalate (DBP)", fuel_shape=None, sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["gravity (Earth vs microgravity)", "cross-flow velocity"],
        within="Direct numerical simulations of DBP smoke particle growth in Earth gravity and microgravity at two low cross-flow velocities.",
        sensors=[],
        measurement_types=["simulated particle size distributions"],
        safety_area=["detection"],
    ),
    "PSI-117": dict(
        fuel_phase=["liquid"], fuel="n-alkanes", fuel_shape="droplet (simulated)", sample_size="~0.5 mm and 1-4 mm droplets",
        o2=None, pressure=None, flow=None,
        variables=["forcing mode (convection, heating or both)", "droplet size", "forcing amplitude and frequency", "ambient composition", "pressure"],
        within="3-D CFD of droplet cool flames under three forcing modes (convection, imposed heat flux, both) for large and sub-millimeter droplets, checked against FLEX measurements.",
        sensors=[],
        measurement_types=["ignition delay", "oscillation frequency and amplitude", "stand-off diameter", "extinction diameter"],
        safety_area=["prevention"],
    ),
    "PSI-142": dict(
        fuel_phase=["gas", "liquid"], fuel="n-heptane, dimethyl ether (DME), n-decane, n-dodecane", fuel_shape="counterflow flames", sample_size=None,
        o2=None, pressure=None, flow=None,
        variables=["oxygen concentration", "ozone sensitization", "pressure", "fuel"],
        within="Ground counterflow experiments and three numerical schemes examined oxygen-concentration effects on cool-flame extinction limits, with and without ozone, for DME and n-alkane fuels.",
        sensors=[],
        measurement_types=["cool and hot flame extinction limits", "CH2O PLIF", "thermometry", "chemiluminescence"],
        safety_area=["prevention"],
    ),
}

PLATFORM = {"International Space Station (ISS)": "ISS", "Cygnus Spacecraft": "Cygnus"}


def build(acc: str) -> dict:
    rec = json.loads((RAW / f"{acc}.json").read_text())
    m = MANUAL[acc]
    rows = table_rows(acc)

    def g(k):
        v = rec.get(k)
        return v.strip() if isinstance(v, str) and v.strip() else None

    if acc in ACME:
        hw = "ACME-CIR"
    elif acc in MDCA:
        hw = "MDCA-CIR"
    elif acc in MSG:
        hw = "MSG-SPICE-duct"
    else:
        hw = "other"

    platform = m.get("platform") or PLATFORM.get(g("flightProgram") or "")
    if acc in ANALYSIS:
        platform = None

    ys, ye = year(g("investigationStartDate")), year(g("investigationEndDate"))
    if ys and ye:
        years = ys if ys == ye else f"{ys}-{ye}"
    else:
        years = f"{ys}-" if ys else (ye or None)

    sample_size = m["sample_size"]
    if isinstance(sample_size, tuple):  # computed from a table column in mm
        r = compute(("table", [(sample_size[1], "pct")]), rows, 2, "size")
        sample_size = f"{r[0]:g}-{r[1]:g} mm initial droplet diameter" if r else None

    # data files: experiment table(s) + one summary per top-level folder of the record's files
    url = f"https://psi.nasa.gov/physci/repo/data/investigations/{acc}"
    data_files = [{"name": t["file_name"], "format": "csv", "url": url} for t in (rec.get("experimentalTable") or [])]
    folders: dict[str, list] = collections.defaultdict(lambda: [0, 0.0])
    prefix = f"/Home/psi-data/{acc}/"
    for f in rec.get("added") or []:
        rp = f.get("remote_path") or ""
        if prefix not in rp:
            continue
        seg = rp.split(prefix, 1)[1].split("/")[0]
        if seg == "Experimental table":
            continue  # listed individually above
        folders[seg][0] += 1
        folders[seg][1] += float(f.get("file_size") or 0)
    for seg, (n, size) in folders.items():
        data_files.append({"name": f"{seg} ({n} file{'s' if n != 1 else ''}, {human(size)})", "format": "folder", "url": url})

    pubs, seen = [], set()
    for p in rec.get("publications") or []:
        d = clean_doi(p.get("doi") or "")
        if d and d.lower() not in seen:
            seen.add(d.lower())
            pubs.append(f"DOI:{d}")

    return {
        "psi_id": acc,
        "name": g("title"),
        "acronym": g("investigationAcronym"),
        "doi": g("doi"),
        "hardware_group": hw,
        "platform": platform,
        "years": years,
        "objectives": g("objective"),
        "fuel_phase": m["fuel_phase"],
        "fuel": m["fuel"],
        "fuel_shape": m["fuel_shape"],
        "sample_size": sample_size,
        "o2_range_percent": compute(m["o2"], rows, 1, "o2"),
        "pressure_range_kpa": compute(m["pressure"], rows, 1, "pressure"),
        "flow_range_cm_s": compute(m["flow"], rows, 2, "flow"),
        "gravity_g": 0 if acc in FLIGHT else None,
        "variables": m["variables"],
        "within_investigation_differences": m["within"],
        "sensors": m["sensors"],
        "measurement_types": m["measurement_types"],
        "safety_area": m["safety_area"],
        "data_files": data_files,
        "publications": pubs,
        "source_url": url,
    }


def main() -> None:
    out = [build(a) for a in FLIGHT + ANALYSIS]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    for inv in out:
        print(
            f"{inv['psi_id']:8} {str(inv['acronym'] or '-'):20} {inv['hardware_group']:15} {str(inv['platform']):7} "
            f"{str(inv['years']):10} O2={inv['o2_range_percent']} P={inv['pressure_range_kpa']} "
            f"flow={inv['flow_range_cm_s']} files={len(inv['data_files'])} pubs={len(inv['publications'])}"
        )


if __name__ == "__main__":
    main()
