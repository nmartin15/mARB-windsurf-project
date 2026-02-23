import pytest
from pathlib import Path
import json

from parse_835 import parse_835_file, parse_amount, parse_cas_adjustments, parse_date
from parse_835 import parse_folder
import parse_835 as parse_835_module


@pytest.mark.unit
def test_parse_835_fixture_extracts_expected_fields(fixture_dir):
    result = parse_835_file(str(fixture_dir / "835_multi_cas.edi"))
    assert result["file_type"] == "835"
    assert result["record_count"] == 1

    payment = result["payments"][0]["payment"]
    assert payment["patient_control_number"] == "PCN0001"
    assert payment["payer_claim_control_number"] == "PAYERCTRL123"

    assert len(result["payments"][0]["adjustments"]) == 2
    assert len(result["payments"][0]["service_lines"][0]["adjustments"]) == 2


@pytest.mark.unit
def test_parse_cas_adjustments_tracks_unknown_group_and_carc():
    summary = {"unknown_adjustment_groups": set(), "unknown_carc_codes": set()}
    segment = ["CAS", "ZZ", "999", "12.34", "1"]
    rows = parse_cas_adjustments(segment, summary)

    assert len(rows) == 1
    assert rows[0]["adjustment_amount"] == 12.34
    assert rows[0]["adjustment_quantity"] == 1
    assert "ZZ" in summary["unknown_adjustment_groups"]
    assert "999" in summary["unknown_carc_codes"]


@pytest.mark.unit
def test_parse_date_and_amount_are_tolerant():
    assert parse_date("20260131") == "2026-01-31"
    assert parse_date("bad-date") is None
    assert parse_amount("14.25") == 14.25
    assert parse_amount("-2.00") == -2.0
    assert parse_amount("abc") is None


@pytest.mark.unit
def test_parse_folder_handles_valid_and_invalid_files(tmp_path):
    valid = tmp_path / "valid.edi"
    valid.write_text((Path(__file__).resolve().parents[1] / "fixtures" / "835_multi_cas.edi").read_text(encoding="utf-8"))
    invalid = tmp_path / "broken.edi"
    invalid.write_text("ISA*too-short")

    results = parse_folder(str(tmp_path))
    names = {r["file_name"] for r in results}
    assert "valid.edi" in names
    assert "broken.edi" in names


@pytest.mark.unit
def test_parse_folder_captures_exceptions(monkeypatch, tmp_path):
    (tmp_path / "ok.edi").write_text("DUMMY")

    def _boom(_path):
        raise RuntimeError("parse failed")

    monkeypatch.setattr(parse_835_module, "parse_835_file", _boom)
    results = parse_835_module.parse_folder(str(tmp_path))
    assert results[0]["error"] == "parse failed"


@pytest.mark.unit
def test_main_writes_output_file(monkeypatch, tmp_path):
    in_file = tmp_path / "in.edi"
    in_file.write_text("DUMMY")
    out_file = tmp_path / "out.json"
    expected = {"file_name": "in.edi", "record_count": 1, "payments": []}

    monkeypatch.setattr(parse_835_module, "parse_835_file", lambda _p: expected)
    monkeypatch.setattr(
        parse_835_module.argparse.ArgumentParser,
        "parse_args",
        lambda self: type("Args", (), {"input": str(in_file), "output": str(out_file)})(),
    )

    parse_835_module.main()
    payload = json.loads(out_file.read_text(encoding="utf-8"))
    assert payload[0]["file_name"] == "in.edi"
