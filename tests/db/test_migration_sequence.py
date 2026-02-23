import pytest

from tests.integration.db_utils import apply_migrations, db_connect, fetch_one


@pytest.mark.db
def test_migration_sequence_applies_and_creates_expected_objects(require_database_url, root_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(conn, root_dir)

        table_row = fetch_one(
            conn,
            """
            SELECT COUNT(*) AS count
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('claim_headers', 'claim_payments', 'claim_adjustments')
            """,
        )
        assert table_row["count"] == 3

        fn_row = fetch_one(
            conn,
            """
            SELECT COUNT(*) AS count
            FROM pg_proc
            WHERE proname IN (
                'get_payment_velocity',
                'get_trend_data',
                'get_ar_aging',
                'get_denial_summary',
                'get_payer_performance',
                'get_clean_claim_rate'
            )
            """,
        )
        assert fn_row["count"] >= 6
    finally:
        conn.close()
