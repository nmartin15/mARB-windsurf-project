import pytest

psycopg = pytest.importorskip("psycopg")
UniqueViolation = psycopg.errors.UniqueViolation

from tests.integration.db_utils import apply_migrations, db_connect, fetch_one, reset_claim_data


@pytest.mark.integration
@pytest.mark.db
def test_claim_header_natural_key_uniqueness(require_database_url, root_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(conn, root_dir)
        reset_claim_data(conn)

        with conn.cursor() as cur:
            cur.execute("INSERT INTO organizations(name) VALUES (%s) RETURNING id", ("Test Org",))
            org_id = cur.fetchone()["id"]
            cur.execute(
                """
                INSERT INTO claim_headers(org_id, claim_id, file_name, file_type, claim_type, claim_status)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (org_id, "CLAIM-1", "claims.json", "837P", "professional", "submitted"),
            )

        with pytest.raises(UniqueViolation):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO claim_headers(org_id, claim_id, file_name, file_type, claim_type, claim_status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (org_id, "CLAIM-1", "claims.json", "837P", "professional", "submitted"),
                )

        count = fetch_one(conn, "SELECT COUNT(*) AS count FROM claim_headers WHERE claim_id = 'CLAIM-1'")["count"]
        assert count == 1
    finally:
        conn.close()


@pytest.mark.integration
@pytest.mark.db
def test_claim_payment_natural_key_uniqueness_with_null_key_parts(require_database_url, root_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(conn, root_dir)
        reset_claim_data(conn)

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO claim_payments(
                    file_name, patient_control_number, check_number, payment_date,
                    claim_status_code, claim_status_desc
                ) VALUES (%s, %s, %s, %s, %s, %s)
                """,
                ("remit.json", "PCN-1", None, None, "1", "Processed as Primary"),
            )

        with pytest.raises(UniqueViolation):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO claim_payments(
                        file_name, patient_control_number, check_number, payment_date,
                        claim_status_code, claim_status_desc
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    ("remit.json", "PCN-1", None, None, "1", "Processed as Primary"),
                )

        count = fetch_one(
            conn,
            "SELECT COUNT(*) AS count FROM claim_payments WHERE patient_control_number = 'PCN-1'",
        )["count"]
        assert count == 1
    finally:
        conn.close()
