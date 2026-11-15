"""Unit conversion is done by code, never by hand: these pin the conventions the README states."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import normalize as nz  # noqa: E402


@pytest.mark.parametrize(
    "text,expected",
    [
        ("microgravity", 0.0), ("µg", 0.0), ("0-g", 0.0), ("10^-6 g", 0.0),
        ("Lunar-g", round(1 / 6, 4)), ("lunar gravity", round(1 / 6, 4)), ("1/6 g", round(1 / 6, 4)),
        ("0.17g", 0.17), ("0.38 g", 0.38), ("Martian gravity", 0.38),
        ("normal gravity", 1.0), ("1-g", 1.0), ("1g", 1.0),
        ("partial gravity", None), ("reduced gravity", None), (None, None),
    ],
)
def test_gravity(text, expected):
    assert nz.gravity_g(text) == expected


@pytest.mark.parametrize(
    "text,expected",
    [
        ("34% O2", 34.0), ("21 %", 21.0), ("0.21 mole fraction", 21.0), ("0.3", 30.0), ("air", 20.9),
        ("14 % O2", 14.0), ("21-30%", None), ("0.17; 0.21", None), ("120%", None),
    ],
)
def test_o2(text, expected):
    assert nz.o2_percent(text) == expected


@pytest.mark.parametrize(
    "text,expected",
    [
        ("8.2 psia", 56.54), ("10.2 psi", 70.33), ("4.3 psid", 29.65), ("1 atm", 101.33), ("56.5 kPa", 56.5),
        ("757.7 mmHg", 101.02), ("0.944 bar", 94.4), ("8.2 psi (56.5 kPa)", None), ("high pressure", None),
    ],
)
def test_pressure(text, expected):
    assert nz.pressure_kpa(text) == expected


@pytest.mark.parametrize(
    "text,expected",
    [("20 cm/s", 20.0), ("50 mm/s", 5.0), ("0.2 m/s", 20.0), ("quiescent", 0.0), ("5-20 cm/s", None), ("fast", None)],
)
def test_flow(text, expected):
    assert nz.flow_cm_s(text) == expected


def test_formula_digits_are_not_numbers():
    assert nz.numbers_in("34% O2, 66% N2") == ["34", "66"]
    assert nz.numbers_in("CO2 diluted C2H4") == []
