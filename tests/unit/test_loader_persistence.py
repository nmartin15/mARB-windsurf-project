import pytest

import loader_persistence as lp


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.filters = []
        self.payload = None
        self.op = "select"
        self.selected = None

    def select(self, column="*"):
        self.op = "select"
        self.selected = column
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def is_(self, key, value):
        self.filters.append(("is", key, value))
        return self

    def limit(self, *_args):
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self

    def insert(self, payload):
        self.op = "insert"
        self.payload = payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        if self.op == "select":
            if self.selected in self.client.fail_select_columns:
                raise Exception("column does not exist")
            rows = self.client.tables.get(self.table_name, [])
            filtered = []
            for row in rows:
                ok = True
                for op, k, v in self.filters:
                    if op == "eq" and row.get(k) != v:
                        ok = False
                    if op == "is":
                        is_null = v == "null"
                        if is_null and row.get(k) is not None:
                            ok = False
                if ok:
                    filtered.append(row)
            return _Result(filtered[:1])

        if self.op == "update":
            rows = self.client.tables.get(self.table_name, [])
            for row in rows:
                match = all(
                    (row.get(k) == v if op == "eq" else (row.get(k) is None and v == "null"))
                    for op, k, v in self.filters
                )
                if match:
                    row.update(self.payload)
            return _Result([])

        if self.op == "insert":
            rows = self.client.tables.setdefault(self.table_name, [])
            if isinstance(self.payload, dict):
                new_row = {"id": len(rows) + 1, **self.payload}
                rows.append(new_row)
                return _Result([new_row])
            return _Result([])

        if self.op == "delete":
            rows = self.client.tables.get(self.table_name, [])
            kept = []
            for row in rows:
                match = all(
                    (row.get(k) == v if op == "eq" else (row.get(k) is None and v == "null"))
                    for op, k, v in self.filters
                )
                if not match:
                    kept.append(row)
            self.client.tables[self.table_name] = kept
            return _Result([])

        return _Result([])


class _Client:
    def __init__(self):
        self.tables = {"claim_headers": [], "claim_payments": []}
        self.fail_select_columns = set()

    def table(self, name):
        return _Query(self, name)


@pytest.mark.unit
def test_build_optional_payment_fields_respects_supported_columns(monkeypatch):
    monkeypatch.setattr(
        lp,
        "get_claim_payments_optional_columns",
        lambda _client: {
            "payer_claim_control_number": True,
            "match_strategy": False,
            "match_reason_code": True,
        },
    )
    payload = lp.build_optional_payment_fields(object(), "PCCN", "clp01", "MATCHED_CLAIM_ID")
    assert payload == {"payer_claim_control_number": "PCCN", "match_reason_code": "MATCHED_CLAIM_ID"}


@pytest.mark.unit
def test_get_claim_payments_optional_columns_detects_missing_columns(monkeypatch):
    client = _Client()
    client.fail_select_columns.add("match_strategy")
    lp._CLAIM_PAYMENTS_OPTIONAL_COLUMNS = None
    cols = lp.get_claim_payments_optional_columns(client)
    assert cols["payer_claim_control_number"] is True
    assert cols["match_strategy"] is False
    assert cols["match_reason_code"] is True


@pytest.mark.unit
def test_upsert_claim_header_insert_then_update():
    client = _Client()
    payload = {"claim_id": "C1", "file_name": "f1", "file_type": "837P", "org_id": None}
    inserted_id, existed = lp.upsert_claim_header(client, payload)
    assert existed is False
    assert inserted_id == 1

    updated_id, existed = lp.upsert_claim_header(client, {**payload, "claim_status": "paid"})
    assert existed is True
    assert updated_id == 1
    assert client.tables["claim_headers"][0]["claim_status"] == "paid"


@pytest.mark.unit
def test_upsert_claim_payment_insert_then_update():
    client = _Client()
    payload = {
        "file_name": "835_1",
        "patient_control_number": "PCN1",
        "check_number": None,
        "payment_date": None,
        "paid_amount": 10.0,
    }
    inserted_id, existed = lp.upsert_claim_payment(client, payload)
    assert existed is False
    assert inserted_id == 1

    updated_id, existed = lp.upsert_claim_payment(client, {**payload, "paid_amount": 12.5})
    assert existed is True
    assert updated_id == 1
    assert client.tables["claim_payments"][0]["paid_amount"] == 12.5


@pytest.mark.unit
def test_clear_claim_and_payment_children_issue_delete_calls():
    client = _Client()
    client.tables["claim_lines"] = [{"id": 1, "claim_header_id": 5}, {"id": 2, "claim_header_id": 9}]
    client.tables["claim_diagnoses"] = [{"id": 1, "claim_header_id": 5}]
    client.tables["claim_dates"] = [{"id": 1, "claim_header_id": 5}]
    client.tables["claim_providers"] = [{"id": 1, "claim_header_id": 5}]
    client.tables["claim_references"] = [{"id": 1, "claim_header_id": 5}]
    client.tables["claim_adjustments"] = [{"id": 1, "claim_payment_id": 3}]
    client.tables["claim_payment_lines"] = [{"id": 1, "claim_payment_id": 3}]

    lp.clear_claim_children(client, 5)
    lp.clear_payment_children(client, 3)

    assert len(client.tables["claim_lines"]) == 1
    assert client.tables["claim_lines"][0]["claim_header_id"] == 9
    assert client.tables["claim_adjustments"] == []
    assert client.tables["claim_payment_lines"] == []
