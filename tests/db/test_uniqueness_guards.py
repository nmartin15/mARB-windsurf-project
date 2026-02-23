import pytest

from tests.integration.db_utils import apply_migrations, db_connect, fetch_one, reset_claim_data


@pytest.mark.db
def test_guarded_uniqueness_creates_indexes_when_no_duplicates(require_database_url, root_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(
            conn,
            root_dir,
            files=[
                "supabase/migrations/00001_canonical_schema.sql",
                "supabase/migrations/20260221_01_add_claim_payment_matching_fields.sql",
                "supabase/migrations/20260221_02_pipeline_safe_index_hardening.sql",
            ],
        )
        reset_claim_data(conn)

        apply_migrations(
            conn,
            root_dir,
            files=["supabase/migrations/20260221_04_guarded_natural_key_uniqueness.sql"],
        )

        idx_headers = fetch_one(
            conn,
            "SELECT COUNT(*) AS count FROM pg_indexes WHERE indexname = 'uq_claim_headers_natural_key'",
        )["count"]
        idx_payments = fetch_one(
            conn,
            "SELECT COUNT(*) AS count FROM pg_indexes WHERE indexname = 'uq_claim_payments_natural_key'",
        )["count"]

        assert idx_headers == 1
        assert idx_payments == 1
    finally:
        conn.close()


@pytest.mark.db
def test_guarded_uniqueness_skips_index_creation_when_duplicates_exist(require_database_url, root_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(
            conn,
            root_dir,
            files=[
                "supabase/migrations/00001_canonical_schema.sql",
                "supabase/migrations/20260221_01_add_claim_payment_matching_fields.sql",
                "supabase/migrations/20260221_02_pipeline_safe_index_hardening.sql",
            ],
        )
        reset_claim_data(conn)

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO claim_headers(claim_id, file_name, file_type, claim_type, claim_status)
                VALUES
                    ('DUP-CLAIM', 'dup.json', '837P', 'professional', 'submitted'),
                    ('DUP-CLAIM', 'dup.json', '837P', 'professional', 'submitted')
                """
            )
            cur.execute(
                """
                INSERT INTO claim_payments(
                    file_name, patient_control_number, check_number, payment_date, claim_status_code
                ) VALUES
                    ('dup835.json', 'PCN-X', NULL, NULL, '1'),
                    ('dup835.json', 'PCN-X', NULL, NULL, '1')
                """
            )

        apply_migrations(
            conn,
            root_dir,
            files=["supabase/migrations/20260221_04_guarded_natural_key_uniqueness.sql"],
        )

        idx_headers = fetch_one(
            conn,
            "SELECT COUNT(*) AS count FROM pg_indexes WHERE indexname = 'uq_claim_headers_natural_key'",
        )["count"]
        idx_payments = fetch_one(
            conn,
            "SELECT COUNT(*) AS count FROM pg_indexes WHERE indexname = 'uq_claim_payments_natural_key'",
        )["count"]

        assert idx_headers == 0
        assert idx_payments == 0
    finally:
        conn.close()
