import os
import sys
import unittest


ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
SCRIPTS_DIR = os.path.join(ROOT_DIR, "scripts")
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

from edi_utils import detect_delimiters, split_composite  # noqa: E402
from parse_835 import parse_835_file  # noqa: E402
from parse_837p import parse_837p_file  # noqa: E402
from claim_matching import claim_key_candidates, normalize_claim_key, load_matching_config  # noqa: E402


FIXTURE_DIR = os.path.join(ROOT_DIR, "tests", "fixtures")


class TestEdiParsers(unittest.TestCase):
    def test_detect_delimiters_from_isa(self):
        # Build a valid fixed-length ISA envelope with custom separators.
        element = "|"
        component = ":"
        segment = "~"
        isa = (
            f"ISA{element}00{element}{'':<10}{element}00{element}{'':<10}{element}"
            f"ZZ{element}{'SENDERID':<15}{element}ZZ{element}{'RECEIVERID':<15}{element}"
            f"260221{element}1230{element}^{element}00501{element}000000001{element}0{element}P{element}"
            f"{component}{segment}"
        )
        delimiters = detect_delimiters(isa + "GS|HP|A|B|20260221|1230|1|X|005010X221A1~")
        self.assertEqual(delimiters["element"], "|")
        self.assertEqual(delimiters["component"], ":")
        self.assertEqual(delimiters["segment"], "~")

    def test_835_extracts_clp07_and_all_cas_triplets(self):
        fixture = os.path.join(FIXTURE_DIR, "835_multi_cas.edi")
        parsed = parse_835_file(fixture)
        self.assertEqual(parsed["record_count"], 1)

        payment = parsed["payments"][0]["payment"]
        self.assertEqual(payment["patient_control_number"], "PCN0001")
        self.assertEqual(payment["payer_claim_control_number"], "PAYERCTRL123")

        claim_adjustments = parsed["payments"][0]["adjustments"]
        line_adjustments = parsed["payments"][0]["service_lines"][0]["adjustments"]
        self.assertEqual(len(claim_adjustments), 2)
        self.assertEqual(len(line_adjustments), 2)

    def test_837_parse_summary_tracks_unknown_qualifiers(self):
        fixture = os.path.join(FIXTURE_DIR, "837_unknown_qualifiers.edi")
        parsed = parse_837p_file(fixture)
        summary = parsed["parse_summary"]

        self.assertIn("ZZZ", summary["unknown_diagnosis_qualifiers"])
        self.assertIn("ZZ", summary["unknown_ref_qualifiers"])
        self.assertEqual(parsed["record_count"], 1)

    def test_split_composite_supports_multiple_styles(self):
        self.assertEqual(split_composite("HC:99213:25", ":"), ["HC", "99213", "25"])
        self.assertEqual(split_composite("HC>99213>25", ":"), ["HC", "99213", "25"])

    def test_claim_key_normalization_and_candidates(self):
        self.assertEqual(normalize_claim_key(" 00-ab 123 "), "00AB123")
        candidates = claim_key_candidates("00-ab 123")
        self.assertIn("00-ab 123", candidates)
        self.assertIn("00AB123", candidates)
        self.assertIn("AB123", candidates)

    def test_matching_config_loads_qualifier_priority(self):
        config = load_matching_config()
        self.assertIn("reference_qualifier_priority", config)
        self.assertTrue(len(config["reference_qualifier_priority"]) >= 1)


if __name__ == "__main__":
    unittest.main()
