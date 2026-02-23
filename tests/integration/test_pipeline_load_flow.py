import pytest

from parse_835 import parse_835_file
from parse_837p import parse_837p_file
from tests.integration.db_utils import apply_migrations, db_connect, fetch_one, reset_claim_data


def _insert_parsed_837_claim(conn, claim_data):
    claim = claim_data["claim"]
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO claim_headers(
                claim_id, claim_type, file_name, file_type, claim_status,
                total_charge_amount, payer_id, payer_name,
                claim_filing_indicator_code, claim_filing_indicator_desc
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                claim.get("claim_id"),
                claim.get("claim_type", "professional"),
                claim.get("file_name"),
                claim.get("file_type"),
                "submitted",
                float(claim.get("total_charge_amount")) if claim.get("total_charge_amount") else None,
                claim.get("payer_id"),
                claim.get("payer_name"),
                claim.get("claim_filing_indicator_code"),
                claim.get("claim_filing_indicator_desc"),
            ),
        )
        header_id = cur.fetchone()["id"]

        for line in claim_data.get("lines", []):
            cur.execute(
                """
                INSERT INTO claim_lines(claim_header_id, line_number, procedure_code, charge_amount)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    header_id,
                    line.get("line_number", 1),
                    line.get("procedure_code"),
                    float(line.get("charge_amount")) if line.get("charge_amount") else None,
                ),
            )

    return header_id


def _insert_parsed_835_payment(conn, payment_data, claim_header_id=None):
    pmt = payment_data["payment"]
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO claim_payments(
                claim_header_id, file_name, patient_control_number, claim_status_code,
                claim_status_desc, total_charge_amount, paid_amount, patient_responsibility,
                payer_id, payer_name, check_number, payment_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                claim_header_id,
                pmt.get("file_name"),
                pmt.get("patient_control_number"),
                pmt.get("claim_status_code"),
                pmt.get("claim_status_desc"),
                pmt.get("total_charge_amount"),
                pmt.get("paid_amount"),
                pmt.get("patient_responsibility"),
                pmt.get("payer_id"),
                pmt.get("payer_name"),
                pmt.get("check_number"),
                pmt.get("payment_date"),
            ),
        )
        payment_id = cur.fetchone()["id"]

        for adj in payment_data.get("adjustments", []):
            cur.execute(
                """
                INSERT INTO claim_adjustments(
                    claim_payment_id, adjustment_group_code, carc_code, adjustment_amount
                ) VALUES (%s, %s, %s, %s)
                """,
                (payment_id, adj.get("adjustment_group_code"), adj.get("carc_code"), adj.get("adjustment_amount")),
            )
    return payment_id


@pytest.mark.integration
@pytest.mark.db
def test_parse_and_load_flow_837_and_835(require_database_url, root_dir, fixture_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(conn, root_dir)
        reset_claim_data(conn)

        parsed_837 = parse_837p_file(str(fixture_dir / "837_unknown_qualifiers.edi"))
        assert parsed_837["record_count"] == 1
        header_id = _insert_parsed_837_claim(conn, parsed_837["claims"][0])

        parsed_835 = parse_835_file(str(fixture_dir / "835_multi_cas.edi"))
        assert parsed_835["record_count"] == 1
        payment_id = _insert_parsed_835_payment(conn, parsed_835["payments"][0], claim_header_id=header_id)

        claim_count = fetch_one(conn, "SELECT COUNT(*) AS count FROM claim_headers")["count"]
        line_count = fetch_one(conn, "SELECT COUNT(*) AS count FROM claim_lines")["count"]
        payment_count = fetch_one(conn, "SELECT COUNT(*) AS count FROM claim_payments")["count"]
        adjustment_count = fetch_one(conn, "SELECT COUNT(*) AS count FROM claim_adjustments")["count"]

        assert claim_count == 1
        assert line_count >= 1
        assert payment_count == 1
        assert adjustment_count >= 1

        join_row = fetch_one(
            conn,
            """
            SELECT cp.id, ch.id
            FROM claim_payments cp
            JOIN claim_headers ch ON cp.claim_header_id = ch.id
            WHERE cp.id = %s
            """,
            (payment_id,),
        )
        assert join_row is not None
    finally:
        conn.close()
