#!/usr/bin/env python3
"""Convert test conditions, exactly as a source words them, into canonical units.

Canonical units: gravity in g (Earth = 1), O2 in % by volume, pressure in kPa, flow in cm/s.
Every function returns None rather than guess: ranges, lists, missing units and unknown words give None.

Conventions (stated in the README):
  microgravity / 0 g -> 0 · lunar gravity / one-sixth g -> 1/6 · Martian gravity -> 0.38 · normal/Earth gravity -> 1
  "air" (no number) -> 20.9 % O2 · "atmospheric"/"sea level" (no number) -> 101.325 kPa
  "quiescent" / "no flow" -> 0 cm/s
"""
from __future__ import annotations

import re
import unicodedata

LUNAR_G = 1 / 6
MARTIAN_G = 0.38
AIR_O2 = 20.9
ATM_KPA = 101.325
PSI_KPA = 6.894757
MMHG_KPA = 0.133322

# Chemical formulas carry digits that are not condition values: O2, CO2, N2, CH4, C2H4, C12H26, H2O ...
_FORMULA = re.compile(r"\b[A-Z][A-Za-z]*\d[A-Za-z0-9]*\b")
_NUMBER = re.compile(r"\d+(?:\.\d+)?|\.\d+")


def clean(s: str) -> str:
    t = unicodedata.normalize("NFKC", s)
    t = _FORMULA.sub(" ", t)
    for dash in ("−", "–", "—", "‐", "‑"):
        t = t.replace(dash, "-")
    return t.lower()


def numbers_in(s: str | None) -> list[str]:
    """Numeric tokens in a reported condition (formula digits excluded), as written."""
    return _NUMBER.findall(clean(s)) if s else []


def gravity_g(s: str | None) -> float | None:
    if not s:
        return None
    t = clean(s)
    if re.search(r"micro-?gravity|μ-?g\b|micro-g\b|weightless|zero[- ]?g(ravity)?\b|\b0[- ]?g\b|10\^?-\d", t):
        return 0.0
    m = re.search(r"\b(\d+)\s*/\s*(\d+)(?:th)?\s*-?\s*g\b", t)
    if m and int(m.group(2)) != 0:
        return round(int(m.group(1)) / int(m.group(2)), 4)
    m = re.search(r"(\d+(?:\.\d+)?|\.\d+)\s*-?\s*g(?:'s|s|0|e)?\b", t)
    if m:
        return float(m.group(1))
    if re.search(r"lunar|moon|one[- ]sixth", t):
        return round(LUNAR_G, 4)
    if re.search(r"martian|\bmars\b", t):
        return MARTIAN_G
    if re.search(r"normal[- ]gravity|earth(?:'s|’s)? gravity|terrestrial gravity|\bnormal-g\b|\bearth-g\b|\bone[- ]g\b", t):
        return 1.0
    return None


def o2_percent(s: str | None) -> float | None:
    if not s:
        return None
    t = clean(s)
    nums = _NUMBER.findall(t)
    if not nums:
        return AIR_O2 if re.search(r"\bair\b", t) else None
    if len(nums) != 1:
        return None
    v = float(nums[0])
    if "fraction" in t or ("%" not in t and "percent" not in t and v <= 1.0):
        v *= 100
    return round(v, 3) if 0 < v <= 100 else None


def pressure_kpa(s: str | None) -> float | None:
    if not s:
        return None
    t = clean(s)
    nums = _NUMBER.findall(t)
    if not nums:
        return ATM_KPA if re.search(r"\batmospheric\b|sea[- ]level", t) else None
    if len(nums) != 1:
        return None
    v = float(nums[0])
    if re.search(r"\bkpa\b", t):
        k = v
    elif re.search(r"\batm\b|\batmospheres?\b", t):
        k = v * ATM_KPA
    elif re.search(r"\bpsi[agd]?\b", t):
        k = v * PSI_KPA
    elif re.search(r"\bmm ?hg\b|\btorr\b", t):
        k = v * MMHG_KPA
    elif re.search(r"\bmbar\b", t):
        k = v * 0.1
    elif re.search(r"\bbar\b", t):
        k = v * 100
    elif re.search(r"\bpa\b", t):
        k = v / 1000
    else:
        return None
    return round(k, 2)


def flow_cm_s(s: str | None) -> float | None:
    if not s:
        return None
    t = clean(s)
    nums = _NUMBER.findall(t)
    if not nums:
        return 0.0 if re.search(r"quiescent|no (?:forced )?flow|stagnant|zero flow", t) else None
    if len(nums) != 1:
        return None
    v = float(nums[0])
    if re.search(r"cm ?/ ?s|cm ?s-1|cm/sec|cm per s", t):
        return v
    if re.search(r"mm ?/ ?s|mm/sec", t):
        return round(v / 10, 4)
    if re.search(r"(?<![cm])m ?/ ?s|(?<![cm])m/sec", t):
        return round(v * 100, 4)
    return None


CONVERTERS = {
    "gravity": gravity_g,
    "o2": o2_percent,
    "pressure": pressure_kpa,
    "flow": flow_cm_s,
}
CANONICAL_FIELD = {"gravity": "gravity_g", "o2": "o2_percent", "pressure": "pressure_kpa", "flow": "flow_cm_s"}
