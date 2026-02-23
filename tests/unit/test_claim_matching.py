import pytest
import builtins

import claim_matching as matching


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, tables, name):
        self.tables = tables
        self.name = name
        self.filters = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def is_(self, key, value):
        self.filters.append(("is", key, value))
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        rows = self.tables.get(self.name, [])

        def _matches(row):
            for op, key, value in self.filters:
                current = row.get(key)
                if op == "eq" and current != value:
                    return False
                if op == "is" and not ((value == "null" and current is None) or current == value):
                    return False
            return True

        return _Result([r for r in rows if _matches(r)])


class _Client:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables, name)


@pytest.mark.unit
def test_claim_key_candidates_and_normalization():
    assert matching.normalize_claim_key(" 00-ab 123 ") == "00AB123"
    assert matching.claim_key_candidates(None) == []
    candidates = matching.claim_key_candidates("00-ab 123")
    assert "00-ab 123" in candidates
    assert "00AB123" in candidates
    assert "ab 123".upper().replace(" ", "") in [c.replace("-", "").replace(" ", "").upper() for c in candidates]


@pytest.mark.unit
def test_match_claim_header_direct_clp01():
    client = _Client({"claim_headers": [{"id": 10, "claim_id": "AB123"}]})
    result = matching.match_claim_header(client, "AB123", "")
    assert result.claim_header_id == 10
    assert result.strategy == "clp01"
    assert result.reason_code == "MATCHED_CLAIM_ID"


@pytest.mark.unit
def test_match_claim_header_falls_back_to_original_claim_id():
    client = _Client(
        {
            "claim_headers": [
                {"id": 20, "claim_id": "DIFFERENT", "original_claim_id": "PAYERCTRL123"},
            ]
        }
    )
    result = matching.match_claim_header(client, "NO_MATCH", "PAYERCTRL123")
    assert result.claim_header_id == 20
    assert result.strategy == "clp07_original_claim_id"
    assert result.reason_code == "MATCHED_ORIGINAL_CLAIM_ID"


@pytest.mark.unit
def test_match_claim_header_uses_ref_qualifier_priority(monkeypatch):
    monkeypatch.setattr(matching, "_MATCHING_CONFIG", {"reference_qualifier_priority": ["D9", "F8"]})
    client = _Client(
        {
            "claim_headers": [],
            "claim_references": [{"claim_header_id": 30, "reference_qualifier": "D9", "reference_value": "CTRL-1"}],
        }
    )
    result = matching.match_claim_header(client, "NOPE", "CTRL-1")
    assert result.claim_header_id == 30
    assert result.strategy == "clp07_ref"
    assert result.reason_code == "MATCHED_REF_D9"


@pytest.mark.unit
def test_match_claim_header_reports_unmatched_reason():
    client = _Client({"claim_headers": [], "claim_references": []})
    result = matching.match_claim_header(client, "A123", "B456")
    assert result.claim_header_id is None
    assert result.strategy == "unmatched"
    assert result.reason_code == "NO_MATCH_CLP01_CLP07"


@pytest.mark.unit
def test_match_claim_header_reports_no_keys():
    client = _Client({"claim_headers": [], "claim_references": []})
    result = matching.match_claim_header(client, "", "")
    assert result.strategy == "unmatched"
    assert result.reason_code == "NO_KEYS"


@pytest.mark.unit
def test_match_claim_header_reports_unusable_clp07():
    client = _Client({"claim_headers": [], "claim_references": []})
    result = matching.match_claim_header(client, "", "   ")
    assert result.strategy == "unmatched"
    assert result.reason_code == "UNUSABLE_CLP07"


@pytest.mark.unit
def test_load_matching_config_defaults_when_missing(monkeypatch):
    monkeypatch.setattr(matching, "_MATCHING_CONFIG", None)
    monkeypatch.setattr(matching.os.path, "exists", lambda _p: False)
    cfg = matching.load_matching_config()
    assert "reference_qualifier_priority" in cfg
    assert cfg["reference_qualifier_priority"][0] == "1K"


@pytest.mark.unit
def test_load_matching_config_handles_bad_json(monkeypatch):
    monkeypatch.setattr(matching, "_MATCHING_CONFIG", None)
    monkeypatch.setattr(matching.os.path, "exists", lambda _p: True)

    def _raise(*_a, **_k):
        raise ValueError("bad json")

    monkeypatch.setattr(builtins, "open", _raise)
    cfg = matching.load_matching_config()
    assert cfg["reference_qualifier_priority"][0] == "1K"
