import pytest

from tests.db.seed_data import seed_rpc_dataset
from tests.integration.db_utils import apply_migrations, db_connect, fetch_all, reset_claim_data


@pytest.mark.db
def test_rpc_functions_return_expected_shapes(require_database_url, root_dir):
    conn = db_connect(require_database_url)
    try:
        apply_migrations(conn, root_dir)
        reset_claim_data(conn)
        seed = seed_rpc_dataset(conn)
        org_id = seed["org_id"]

        velocity_rows = fetch_all(
            conn,
            "SELECT * FROM get_payment_velocity(%s, %s)",
            (org_id, "6M"),
        )
        assert len(velocity_rows) >= 1
        assert "month" in velocity_rows[0]
        assert velocity_rows[0]["days_to_payment"] >= 0

        trend_rows = fetch_all(conn, "SELECT * FROM get_trend_data(%s, %s)", (org_id, "6M"))
        assert len(trend_rows) >= 1
        assert trend_rows[0]["range"] in {"0-30", "31-60", "61-90", "91+"}

        ar_rows = fetch_all(conn, "SELECT * FROM get_ar_aging(%s)", (org_id,))
        assert len(ar_rows) >= 1
        assert "amount_0_30" in ar_rows[0]

        denial_rows = fetch_all(conn, "SELECT * FROM get_denial_summary(%s, %s)", (org_id, "6M"))
        assert len(denial_rows) >= 1
        assert denial_rows[0]["denial_count"] >= 1

        payer_rows = fetch_all(conn, "SELECT * FROM get_payer_performance(%s, %s)", (org_id, "6M"))
        assert len(payer_rows) >= 1
        assert "reimbursement_rate" in payer_rows[0]

        clean_rows = fetch_all(conn, "SELECT * FROM get_clean_claim_rate(%s, %s)", (org_id, "6M"))
        assert len(clean_rows) >= 1
        assert clean_rows[0]["total_claims"] >= clean_rows[0]["clean_claims"]
    finally:
        conn.close()
