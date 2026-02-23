import pytest
import json

import load_to_supabase as lts
from pipeline_models import MatchResult


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.op = "select"
        self.payload = None
        self.filters = []

    def select(self, *_a):
        self.op = "select"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def execute(self):
        if self.op == "select":
            if self.table_name == "edi_file_log":
                return _Result(self.client.existing_hash_rows)
            return _Result([])
        if self.op == "insert":
            self.client.inserted.setdefault(self.table_name, []).append(self.payload)
            if self.table_name in {"edi_file_log", "claim_lines", "claim_payment_lines"}:
                return _Result([{"id": len(self.client.inserted[self.table_name])}])
            return _Result([])
        if self.op == "update":
            self.client.updated.setdefault(self.table_name, []).append((self.payload, list(self.filters)))
            return _Result([])
        return _Result([])

    def insert(self, payload):
        self.op = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self


class _Client:
    def __init__(self, existing_hash_rows=None):
        self.existing_hash_rows = existing_hash_rows or []
        self.inserted = {}
        self.updated = {}

    def table(self, table_name):
        return _Query(self, table_name)


@pytest.mark.unit
def test_to_decimal_handles_valid_and_invalid_values():
    assert lts._to_decimal("12.5") == 12.5
    assert lts._to_decimal(10) == 10.0
    assert lts._to_decimal(None) is None
    assert lts._to_decimal("bad") is None


@pytest.mark.unit
def test_get_client_exits_when_env_missing(monkeypatch):
    monkeypatch.setattr(lts, "SUPABASE_URL", None)
    monkeypatch.setattr(lts, "SUPABASE_KEY", None)
    with pytest.raises(SystemExit):
        lts.get_client()


@pytest.mark.unit
def test_get_client_returns_created_client(monkeypatch):
    monkeypatch.setattr(lts, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(lts, "SUPABASE_KEY", "service-key")
    sentinel = object()
    monkeypatch.setattr(lts, "create_client", lambda url, key: (sentinel, url, key))
    result = lts.get_client()
    assert result[0] is sentinel
    assert result[1] == "https://example.supabase.co"
    assert result[2] == "service-key"


@pytest.mark.unit
def test_load_837_file_skips_duplicate_hash(monkeypatch):
    res = lts.load_837_file(
        _Client(existing_hash_rows=[{"id": 1}]),
        {"file_name": "f", "file_type": "837P", "file_hash": "abc", "record_count": 1, "claims": []},
    )
    assert res["skipped"] is True
    assert res["reason"] == "duplicate"


@pytest.mark.unit
def test_load_835_file_skips_duplicate_hash():
    res = lts.load_835_file(
        _Client(existing_hash_rows=[{"id": 1}]),
        {"file_name": "f835", "file_hash": "x", "record_count": 1, "payments": []},
    )
    assert res["skipped"] is True
    assert res["reason"] == "duplicate"


@pytest.mark.unit
def test_load_single_payment_returns_reconciliation_values(monkeypatch):
    inserted = {"claim_payments": [], "claim_adjustments": [], "claim_payment_lines": []}

    class _Result:
        def __init__(self, data):
            self.data = data

    class _Q:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None

        def update(self, _payload):
            return self

        def eq(self, *_a):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.payload is not None:
                inserted[self.table_name].append(self.payload)
            if self.table_name == "claim_payment_lines":
                return _Result([{"id": 77}])
            return _Result([])

    class _Client:
        def table(self, table_name):
            return _Q(table_name)

    monkeypatch.setattr(lts, "match_claim_header", lambda *_a, **_k: MatchResult(10, "clp01", "MATCHED_CLAIM_ID"))
    monkeypatch.setattr(
        lts,
        "upsert_claim_payment",
        lambda _c, payload: (501, False),
    )
    monkeypatch.setattr(lts, "build_optional_payment_fields", lambda *_a, **_k: {})
    monkeypatch.setattr(lts, "clear_payment_children", lambda *_a, **_k: None)

    payment_data = {
        "payment": {
            "file_name": "f835",
            "patient_control_number": "PCN1",
            "payer_claim_control_number": "PCCN",
            "claim_status_code": "1",
            "claim_status_desc": "Processed as Primary",
            "total_charge_amount": "200",
            "paid_amount": "120",
            "patient_responsibility": "20",
            "payer_id": "P1",
            "payer_name": "Payer One",
            "check_number": "CHK1",
            "payment_date": "2026-02-20",
            "payment_method_code": "CHK",
        },
        "adjustments": [
            {"adjustment_group_code": "CO", "carc_code": "45", "adjustment_amount": "15.5"},
        ],
        "service_lines": [
            {
                "procedure_code": "99213",
                "modifier_1": "25",
                "charge_amount": "100",
                "paid_amount": "60",
                "revenue_code": None,
                "units_paid": "1",
                "adjustments": [{"adjustment_group_code": "PR", "carc_code": "2", "adjustment_amount": "5"}],
            }
        ],
    }

    result = lts._load_single_payment(_Client(), payment_data, org_id=None)
    assert result["match_strategy"] == "clp01"
    assert result["charge_amount"] == 200.0
    assert result["paid_amount"] == 120.0
    assert result["adjustment_amount"] == 20.5
    assert len(inserted["claim_adjustments"]) == 2


@pytest.mark.unit
def test_load_837_file_logs_status_and_errors(monkeypatch):
    calls = {"count": 0}

    def _loader(_client, claim_data, _org_id):
        calls["count"] += 1
        if claim_data["claim"]["claim_id"] == "BAD":
            raise ValueError("boom")

    monkeypatch.setattr(lts, "_load_single_claim", _loader)

    file_data = {
        "file_name": "claims.json",
        "file_type": "837P",
        "file_hash": "hash-1",
        "record_count": 2,
        "parse_summary": {"warnings": ["w1"], "invalid_dates": 1},
        "claims": [{"claim": {"claim_id": "GOOD"}}, {"claim": {"claim_id": "BAD"}}],
    }
    client = _Client()
    result = lts.load_837_file(client, file_data, org_id=7)

    assert result["loaded"] == 1
    assert len(result["errors"]) == 1
    assert result["quality"]["warnings"] == 1
    assert "edi_file_log" in client.inserted
    assert "edi_file_log" in client.updated


@pytest.mark.unit
def test_load_835_file_aggregates_match_and_reconciliation(monkeypatch):
    responses = iter(
        [
            {"match_strategy": "clp01", "charge_amount": 100.0, "paid_amount": 80.0, "adjustment_amount": 20.0},
            {"match_strategy": "unmatched", "charge_amount": 50.0, "paid_amount": 0.0, "adjustment_amount": 0.0},
        ]
    )

    monkeypatch.setattr(lts, "_load_single_payment", lambda *_a, **_k: next(responses))
    client = _Client()
    file_data = {
        "file_name": "835.json",
        "file_hash": "hash-835",
        "record_count": 2,
        "parse_summary": {"warnings": [], "invalid_dates": 0, "unknown_adjustment_groups": [], "unknown_carc_codes": []},
        "payments": [{"payment": {"patient_control_number": "A"}}, {"payment": {"patient_control_number": "B"}}],
    }
    result = lts.load_835_file(client, file_data, org_id=2)

    assert result["loaded"] == 2
    assert result["match_summary"]["clp01"] == 1
    assert result["match_summary"]["unmatched"] == 1
    assert result["reconciliation"]["total_charge_amount"] == 150.0
    assert result["reconciliation"]["total_paid_amount"] == 80.0
    assert result["reconciliation"]["total_adjustment_amount"] == 20.0


@pytest.mark.unit
def test_load_single_claim_inserts_expected_children(monkeypatch):
    monkeypatch.setattr(lts, "upsert_claim_header", lambda *_a, **_k: (42, False))
    monkeypatch.setattr(lts, "clear_claim_children", lambda *_a, **_k: None)

    client = _Client()
    claim_data = {
        "claim": {
            "claim_id": "C-1",
            "claim_type": "professional",
            "file_name": "f837",
            "file_type": "837P",
            "total_charge_amount": "100.0",
            "prior_auth_status": "none",
        },
        "lines": [{"line_number": 1, "procedure_code": "99213", "charge_amount": "100", "unit_count": "1"}],
        "diagnoses": [{"diagnosis_code": "Z123", "diagnosis_type": "other"}],
        "dates_header": [{"date_qualifier": "472", "date_value": "20260220", "parsed_date": "2026-02-20"}],
        "dates_line": [{"line_number": 1, "date_qualifier": "472", "date_value": "20260220", "parsed_date": "2026-02-20"}],
        "providers": [{"provider_role": "rendering", "last_or_org_name": "DOE"}],
        "references": [{"reference_qualifier": "F8", "reference_value": "REF-1"}],
    }

    lts._load_single_claim(client, claim_data, org_id=9)
    assert len(client.inserted.get("claim_lines", [])) == 1
    assert len(client.inserted.get("claim_diagnoses", [])) == 1
    assert len(client.inserted.get("claim_dates", [])) == 2
    assert len(client.inserted.get("claim_providers", [])) == 1
    assert len(client.inserted.get("claim_references", [])) == 1


@pytest.mark.unit
def test_load_single_claim_clears_children_on_existing_header(monkeypatch):
    calls = {"cleared": False}
    monkeypatch.setattr(lts, "upsert_claim_header", lambda *_a, **_k: (42, True))
    monkeypatch.setattr(lts, "clear_claim_children", lambda *_a, **_k: calls.__setitem__("cleared", True))

    client = _Client()
    claim_data = {
        "claim": {"claim_id": "C-1", "file_name": "f837", "file_type": "837P"},
        "lines": [],
        "diagnoses": [],
        "dates_header": [],
        "dates_line": [],
        "providers": [],
        "references": [],
    }
    lts._load_single_claim(client, claim_data, org_id=None)
    assert calls["cleared"] is True


@pytest.mark.unit
def test_load_single_payment_unmatched_and_existing_payment(monkeypatch):
    calls = {"cleared": False}

    class _Q:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None

        def update(self, _payload):
            return self

        def eq(self, *_a):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "claim_payment_lines":
                return _Result([{"id": 99}])
            return _Result([])

    class _C:
        def table(self, table_name):
            return _Q(table_name)

    monkeypatch.setattr(lts, "match_claim_header", lambda *_a, **_k: MatchResult(None, "unmatched", "NO_KEYS"))
    monkeypatch.setattr(lts, "upsert_claim_payment", lambda *_a, **_k: (88, True))
    monkeypatch.setattr(lts, "build_optional_payment_fields", lambda *_a, **_k: {})
    monkeypatch.setattr(lts, "clear_payment_children", lambda *_a, **_k: calls.__setitem__("cleared", True))

    payment_data = {
        "payment": {
            "file_name": "f835",
            "patient_control_number": "PCN1",
            "payer_claim_control_number": "PCCN",
            "claim_status_code": "4",
            "total_charge_amount": "10",
            "paid_amount": "0",
        },
        "adjustments": [],
        "service_lines": [],
    }
    result = lts._load_single_payment(_C(), payment_data, org_id=None)
    assert result["match_strategy"] == "unmatched"
    assert calls["cleared"] is True


@pytest.mark.unit
def test_load_835_file_collects_errors_from_single_payment(monkeypatch):
    client = _Client()

    def _boom(*_a, **_k):
        raise RuntimeError("load failed")

    monkeypatch.setattr(lts, "_load_single_payment", _boom)
    file_data = {
        "file_name": "835.json",
        "file_hash": "hash-835",
        "record_count": 1,
        "payments": [{"payment": {"patient_control_number": "P-ERR"}}],
        "parse_summary": {"warnings": [], "invalid_dates": 0, "unknown_adjustment_groups": [], "unknown_carc_codes": []},
    }
    result = lts.load_835_file(client, file_data)
    assert result["loaded"] == 0
    assert len(result["errors"]) == 1
    assert "Payment P-ERR: load failed" in result["errors"][0]


@pytest.mark.unit
def test_main_runs_837_path_and_reports(monkeypatch, tmp_path):
    data_file = tmp_path / "input_837.json"
    data_file.write_text(json.dumps([{"file_name": "f837", "file_type": "837P", "claims": []}]), encoding="utf-8")

    monkeypatch.setattr(
        lts.argparse.ArgumentParser,
        "parse_args",
        lambda self: type("Args", (), {"json_file": str(data_file), "type": "837P", "org_id": 1})(),
    )
    monkeypatch.setattr(lts, "get_client", lambda: object())
    monkeypatch.setattr(lts, "load_837_file", lambda *_a, **_k: {"loaded": 2, "errors": [], "quality": {"warnings": 0, "invalid_dates": 0}})
    lts.main()


@pytest.mark.unit
def test_main_runs_835_path_with_match_summary(monkeypatch, tmp_path):
    data_file = tmp_path / "input_835.json"
    data_file.write_text(json.dumps([{"file_name": "f835", "payments": []}]), encoding="utf-8")
    monkeypatch.setattr(
        lts.argparse.ArgumentParser,
        "parse_args",
        lambda self: type("Args", (), {"json_file": str(data_file), "type": "835", "org_id": None})(),
    )
    monkeypatch.setattr(lts, "get_client", lambda: object())
    monkeypatch.setattr(
        lts,
        "load_835_file",
        lambda *_a, **_k: {
            "loaded": 1,
            "errors": ["err1"],
            "match_summary": {"clp01": 1, "clp07_original_claim_id": 0, "clp07_ref": 0, "unmatched": 0},
            "reconciliation": {"total_charge_amount": 100.0, "total_paid_amount": 90.0, "total_adjustment_amount": 10.0},
            "quality": {"warnings": 1, "invalid_dates": 0, "unknown_adjustment_groups": 0, "unknown_carc_codes": 0},
        },
    )
    lts.main()
