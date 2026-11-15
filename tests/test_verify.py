"""The citation gate must accept real quotes and reject anything altered or invented."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import verify_quotes as vq  # noqa: E402

SRC = "NTRS:20040084156"  # Olson 2004, NASA/TM-2004-213114 (2 pages)
REAL = "Over most of the range of air ventilation rates (5-20 cm/s) comparable to spacecraft ventilation, upstream flame spread was the only viable flame."


def finding(**over):
    rec = {
        "source_id": SRC, "experiment": "other", "psi_id": None, "platform": "review",
        "reported": {"gravity": "microgravity", "o2": None, "pressure": None, "flow": "5-20 cm/s"},
        "analogue_of_g": None, "material": None, "finding": "Only upstream flame spread was viable at spacecraft ventilation speeds.",
        "finding_type": "spread_rate", "direction": "n/a", "safety_area": ["prevention"],
        "quote": REAL, "page": 1, "evidence_tier": 4,
    }
    rec.update(over)
    return rec


def test_normalisation_handles_pdf_artefacts():
    assert vq.norm("ﬂame  spread") == "flame spread"  # ligature + whitespace
    assert vq.norm("flam-\nmability", join_hyphens=True) == "flammability"  # line-break hyphenation
    assert vq.norm("low-\nvelocity") == "low-velocity"
    assert vq.norm("NASA’s “Test 1”") == vq.norm('NASA\'s "Test 1"')  # curly quotes
    assert vq.norm("O₂") == "o2"  # NFKC subscripts


def test_real_record_passes():
    assert vq.check_finding(finding()) is None


def test_tampered_quote_is_dropped():
    err = vq.check_finding(finding(quote=REAL.replace("upstream", "downstream")))
    assert err and err.startswith("quote:")


def test_quote_on_wrong_page_is_dropped():
    err = vq.check_finding(finding(page=2))
    assert err and err.startswith("quote:") and "found on page [1]" in err


def test_invented_number_is_dropped():
    err = vq.check_finding(finding(reported={"gravity": "microgravity", "o2": "99% O2", "pressure": None, "flow": None}))
    assert err and err.startswith("numbers:")


def test_invented_wording_is_dropped():
    err = vq.check_finding(finding(reported={"gravity": "Venusian gravity", "o2": None, "pressure": None, "flow": None}))
    assert err and err.startswith("numbers:")


def test_schema_limits():
    assert vq.check_finding(finding(platform="spaceship")).startswith("schema:")
    assert vq.check_finding(finding(quote="too short")).startswith("schema:")
    assert vq.check_finding(finding(quote=REAL[:60] + " ... " + REAL[60:])).startswith("schema:")
    assert vq.check_finding(finding(finding=" ".join(["word"] * 31))).startswith("schema:")
    assert vq.check_finding(finding(page=9)).startswith("schema:")
