import pytest
from pathlib import Path
import json

from parse_837p import extract_claim, parse_837p_file, parse_date
from parse_837p import extract_file_metadata, parse_folder
import parse_837p as parse_837p_module


@pytest.mark.unit
def test_parse_837p_fixture_tracks_unknown_qualifiers(fixture_dir):
    result = parse_837p_file(str(fixture_dir / "837_unknown_qualifiers.edi"))
    assert result["file_type"] == "837P"
    assert result["record_count"] == 1

    summary = result["parse_summary"]
    assert "ZZZ" in summary["unknown_diagnosis_qualifiers"]
    assert "ZZ" in summary["unknown_ref_qualifiers"]


@pytest.mark.unit
def test_parse_date_handles_rd8_ranges():
    assert parse_date("20260201-20260210", "RD8") == "2026-02-01"
    assert parse_date("20260210", "D8") == "2026-02-10"
    assert parse_date("bad", "D8") is None


@pytest.mark.unit
def test_extract_claim_maps_core_fields_and_children():
    block = [
        ["HL", "1", "0", "22"],
        ["CLM", "CLAIM001", "150.00", "", "", "11:B:1", "", "A", "Y", "Y"],
        ["SBR", "P", "", "", "", "", "", "", "", "CI"],
        ["NM1", "PR", "2", "Blue Payer", "", "", "", "", "PI", "PAYER01"],
        ["NM1", "82", "1", "DOE", "JOHN", "", "", "", "XX", "1234567890"],
        ["PRV", "PE", "PXC", "207Q00000X"],
        ["DTP", "472", "D8", "20260220"],
        ["HI", "ABK:Z123", "ZZZ:U999"],
        ["REF", "G1", "PA-1234"],
        ["LX", "1"],
        ["SV1", "HC:99213:25", "150.00", "UN", "1", "11"],
        ["DTP", "472", "D8", "20260221"],
    ]

    parsed = extract_claim(block, "fixture.837", component_sep=":")
    claim = parsed["claim"]

    assert claim["claim_id"] == "CLAIM001"
    assert claim["claim_filing_indicator_code"] == "CI"
    assert claim["payer_name"] == "Blue Payer"
    assert claim["prior_auth_number"] == "PA-1234"
    assert parsed["lines"][0]["procedure_code"] == "99213"
    assert parsed["lines"][0]["modifier_1"] == "25"
    assert parsed["dates_header"][0]["parsed_date"] == "2026-02-20"
    assert parsed["dates_line"][0]["line_number"] == 1


@pytest.mark.unit
def test_extract_file_metadata_reads_isa_gs_and_billing_provider():
    segments = [
        ["ISA", "00", "", "00", "", "ZZ", "SENDER", "ZZ", "RECEIVER", "260222", "1200", "^", "00501", "1", "0", "P", ":"],
        ["GS", "HC", "GS-SENDER", "GS-RECEIVER", "20260222", "1200", "1", "X", "005010X222A1"],
        ["ST", "837", "0001"],
        ["NM1", "85", "2", "BILLING ORG", "", "", "", "", "XX", "1234567890"],
        ["PRV", "BI", "PXC", "207Q00000X"],
    ]
    metadata, billing_provider = extract_file_metadata(segments, "f.edi")
    assert metadata["sender_id"] == "SENDER"
    assert metadata["gs_sender"] == "GS-SENDER"
    assert billing_provider["provider_role"] == "billing"
    assert billing_provider["taxonomy_code"] == "207Q00000X"


@pytest.mark.unit
def test_parse_folder_parses_mixed_files(tmp_path):
    valid = tmp_path / "valid.edi"
    valid.write_text((Path(__file__).resolve().parents[1] / "fixtures" / "837_unknown_qualifiers.edi").read_text(encoding="utf-8"))
    invalid = tmp_path / "broken.edi"
    invalid.write_text("ISA*too-short")

    results = parse_folder(str(tmp_path))
    names = {r["file_name"] for r in results}
    assert "valid.edi" in names
    assert "broken.edi" in names


@pytest.mark.unit
def test_parse_folder_captures_exceptions(monkeypatch, tmp_path):
    (tmp_path / "one.edi").write_text("x")

    def _boom(_path):
        raise RuntimeError("parse failed")

    monkeypatch.setattr(parse_837p_module, "parse_837p_file", _boom)
    results = parse_837p_module.parse_folder(str(tmp_path))
    assert results[0]["error"] == "parse failed"


@pytest.mark.unit
def test_main_writes_output_file(monkeypatch, tmp_path):
    in_file = tmp_path / "in.edi"
    in_file.write_text("DUMMY")
    out_file = tmp_path / "out.json"
    expected = {"file_name": "in.edi", "record_count": 2, "claims": []}

    monkeypatch.setattr(parse_837p_module, "parse_837p_file", lambda _p: expected)
    monkeypatch.setattr(
        parse_837p_module.argparse.ArgumentParser,
        "parse_args",
        lambda self: type("Args", (), {"input": str(in_file), "output": str(out_file)})(),
    )

    parse_837p_module.main()
    payload = json.loads(out_file.read_text(encoding="utf-8"))
    assert payload[0]["file_name"] == "in.edi"
