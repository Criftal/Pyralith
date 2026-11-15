"""Exported app data (public/data/*.json) obeys the contract in src/types.ts and re-verifies from scratch."""
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import normalize as nz  # noqa: E402
import verify_quotes as vq  # noqa: E402

DATA = ROOT / "public" / "data"
pytestmark = pytest.mark.skipif(not (DATA / "findings.json").exists(), reason="run scripts/export.py first")


def load(name):
    return json.loads((DATA / name).read_text())


FINDING_KEYS = {
    "id", "source_id", "experiment", "psi_id", "platform", "gravity_g", "analogue_of_g", "o2_percent", "pressure_kpa",
    "flow_cm_s", "reported", "material", "finding", "finding_type", "direction", "safety_area", "quote", "page",
    "evidence_tier", "verified",
}
INVESTIGATION_KEYS = {
    "psi_id", "name", "acronym", "doi", "hardware_group", "platform", "years", "objectives", "fuel_phase", "fuel",
    "fuel_shape", "sample_size", "o2_range_percent", "pressure_range_kpa", "flow_range_cm_s", "gravity_g", "variables",
    "within_investigation_differences", "sensors", "measurement_types", "safety_area", "data_files", "publications",
    "source_url",
}


def test_findings_shape_and_ids():
    findings = load("findings.json")
    sources = load("sources.json")
    assert findings, "no findings exported"
    assert len({f["id"] for f in findings}) == len(findings)
    for f in findings:
        assert set(f) == FINDING_KEYS, f["id"]
        assert f["verified"] is True
        assert f["source_id"] in sources
        assert f["platform"] in vq.PLATFORMS and f["finding_type"] in vq.FINDING_TYPES
        assert f["direction"] in vq.DIRECTIONS and set(f["safety_area"]) <= vq.SAFETY
        assert 6 <= len(f["quote"].split()) <= 40 and len(f["finding"].split()) <= 30
        for k in ("gravity_g", "o2_percent", "pressure_kpa", "flow_cm_s", "analogue_of_g"):
            assert f[k] is None or (isinstance(f[k], (int, float)) and math.isfinite(f[k])), (f["id"], k)


def test_null_is_never_turned_into_zero():
    """A canonical number exists only if the source stated the condition, and equals the code conversion of it."""
    for f in load("findings.json"):
        for dim, field in nz.CANONICAL_FIELD.items():
            reported = f["reported"][dim]
            if reported is None:
                assert f[field] is None, (f["id"], field)
            else:
                assert f[field] == nz.CONVERTERS[dim](reported), (f["id"], field)


def test_every_exported_quote_reverifies():
    for f in load("findings.json"):
        assert vq.quote_on_page(f["source_id"], f["page"], f["quote"]), f["id"]
    for c in load("claims.json"):
        assert vq.quote_on_page(c["source_id"], c["page"], c["quote"]), c["id"]


def test_investigations_shape():
    invs = load("investigations.json")
    assert len(invs) >= 20
    for i in invs:
        assert set(i) == INVESTIGATION_KEYS, i["psi_id"]
        for k in ("o2_range_percent", "pressure_range_kpa", "flow_range_cm_s"):
            r = i[k]
            assert r is None or (len(r) == 2 and r[0] <= r[1]), (i["psi_id"], k)


def test_missions_cite_verified_quotes():
    missions = load("missions.json")
    assert {m["id"] for m in missions} == {"iss", "artemis_habitat", "pressurized_rover", "eva_suit", "mars_transit", "mars_habitat"}
    for m in missions:
        for dim in ("gravity", "o2", "pressure", "flow"):
            cv = m[dim]
            if cv is not None:
                assert vq.quote_on_page(cv["source_id"], cv["page"], cv["quote"]), (m["id"], dim)
                assert cv["qualifier"] in vq.QUALIFIERS


def test_meta_matches_files():
    meta = load("meta.json")
    assert meta["counts"]["findings"] == len(load("findings.json"))
    assert meta["counts"]["claims"] == len(load("claims.json"))
    v = meta["verification"]
    assert v["verified"] + v["dropped_quote"] + v["dropped_numbers"] + v["dropped_schema"] == v["candidates"]
