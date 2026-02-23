-- =============================================================================
-- mARB Health — RPC Functions for Dashboard & Reports
-- =============================================================================

-- =============================================================================
-- get_payment_velocity: Monthly payment speed metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_payment_velocity(p_org_id INTEGER DEFAULT NULL, p_period TEXT DEFAULT '6M')
RETURNS TABLE(
    month TEXT,
    amount NUMERIC,
    disputes_closed INTEGER,
    days_to_payment NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CASE p_period
        WHEN '1M' THEN CURRENT_DATE - INTERVAL '1 month'
        WHEN '3M' THEN CURRENT_DATE - INTERVAL '3 months'
        WHEN '6M' THEN CURRENT_DATE - INTERVAL '6 months'
        WHEN '1Y' THEN CURRENT_DATE - INTERVAL '1 year'
        ELSE CURRENT_DATE - INTERVAL '2 years'
    END;

    RETURN QUERY
    SELECT
        TO_CHAR(cp.payment_date, 'Mon') AS month,
        SUM(cp.paid_amount)::NUMERIC AS amount,
        COUNT(*)::INTEGER AS disputes_closed,
        COALESCE(
            AVG(
                CASE WHEN cd_svc.parsed_date IS NOT NULL AND cp.payment_date IS NOT NULL
                THEN (cp.payment_date - cd_svc.parsed_date)
                ELSE NULL END
            ), 0
        )::NUMERIC AS days_to_payment
    FROM claim_payments cp
    LEFT JOIN claim_headers ch ON cp.claim_header_id = ch.id
    LEFT JOIN claim_dates cd_svc ON cd_svc.claim_header_id = ch.id
        AND cd_svc.date_qualifier IN ('472', '232')
        AND cd_svc.claim_line_id IS NULL
    WHERE cp.payment_date >= start_date
        AND (p_org_id IS NULL OR cp.org_id = p_org_id)
    GROUP BY TO_CHAR(cp.payment_date, 'Mon'), DATE_TRUNC('month', cp.payment_date)
    ORDER BY DATE_TRUNC('month', cp.payment_date);
END;
$$;

-- =============================================================================
-- get_trend_data: Claim aging distribution
-- =============================================================================
CREATE OR REPLACE FUNCTION get_trend_data(p_org_id INTEGER DEFAULT NULL, p_period TEXT DEFAULT '6M')
RETURNS TABLE(
    range TEXT,
    count INTEGER,
    "avgDays" NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CASE p_period
        WHEN '1M' THEN CURRENT_DATE - INTERVAL '1 month'
        WHEN '3M' THEN CURRENT_DATE - INTERVAL '3 months'
        WHEN '6M' THEN CURRENT_DATE - INTERVAL '6 months'
        WHEN '1Y' THEN CURRENT_DATE - INTERVAL '1 year'
        ELSE CURRENT_DATE - INTERVAL '2 years'
    END;

    RETURN QUERY
    WITH claim_ages AS (
        SELECT
            ch.id,
            COALESCE(
                (SELECT cd.parsed_date FROM claim_dates cd
                 WHERE cd.claim_header_id = ch.id
                   AND cd.date_qualifier IN ('472', '232')
                   AND cd.claim_line_id IS NULL
                   AND cd.parsed_date IS NOT NULL
                 ORDER BY cd.date_qualifier LIMIT 1),
                ch.created_at::DATE
            ) AS service_date
        FROM claim_headers ch
        WHERE ch.file_name IS NOT NULL
            AND (p_org_id IS NULL OR ch.org_id = p_org_id)
    ),
    aged AS (
        SELECT
            ca.id,
            CURRENT_DATE - ca.service_date AS days_old
        FROM claim_ages ca
        WHERE ca.service_date >= start_date
    )
    SELECT
        CASE
            WHEN a.days_old <= 30 THEN '0-30'
            WHEN a.days_old <= 60 THEN '31-60'
            WHEN a.days_old <= 90 THEN '61-90'
            ELSE '91+'
        END AS range,
        COUNT(*)::INTEGER AS count,
        ROUND(AVG(a.days_old), 1)::NUMERIC AS "avgDays"
    FROM aged a
    GROUP BY
        CASE
            WHEN a.days_old <= 30 THEN '0-30'
            WHEN a.days_old <= 60 THEN '31-60'
            WHEN a.days_old <= 90 THEN '61-90'
            ELSE '91+'
        END
    ORDER BY
        CASE range
            WHEN '0-30' THEN 1
            WHEN '31-60' THEN 2
            WHEN '61-90' THEN 3
            ELSE 4
        END;
END;
$$;

-- =============================================================================
-- get_ar_aging: Accounts receivable aging buckets
-- =============================================================================
CREATE OR REPLACE FUNCTION get_ar_aging(p_org_id INTEGER DEFAULT NULL)
RETURNS TABLE(
    payer_id VARCHAR,
    payer_name VARCHAR,
    amount_0_30 NUMERIC,
    amount_31_60 NUMERIC,
    amount_61_90 NUMERIC,
    amount_91_120 NUMERIC,
    amount_120_plus NUMERIC,
    count_0_30 INTEGER,
    count_31_60 INTEGER,
    count_61_90 INTEGER,
    count_91_120 INTEGER,
    count_120_plus INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH claim_ages AS (
        SELECT
            ch.id,
            ch.payer_id AS p_id,
            ch.payer_name AS p_name,
            ch.total_charge_amount,
            COALESCE(ch.paid_amount, 0) AS paid,
            CURRENT_DATE - COALESCE(
                (SELECT cd.parsed_date FROM claim_dates cd
                 WHERE cd.claim_header_id = ch.id
                   AND cd.date_qualifier IN ('472', '232')
                   AND cd.claim_line_id IS NULL
                   AND cd.parsed_date IS NOT NULL
                 LIMIT 1),
                ch.created_at::DATE
            ) AS days_old
        FROM claim_headers ch
        WHERE ch.file_name IS NOT NULL
            AND ch.claim_status NOT IN ('paid')
            AND (p_org_id IS NULL OR ch.org_id = p_org_id)
    )
    SELECT
        ca.p_id::VARCHAR AS payer_id,
        COALESCE(ca.p_name, 'Unknown')::VARCHAR AS payer_name,
        SUM(CASE WHEN ca.days_old <= 30 THEN ca.total_charge_amount - ca.paid ELSE 0 END)::NUMERIC AS amount_0_30,
        SUM(CASE WHEN ca.days_old BETWEEN 31 AND 60 THEN ca.total_charge_amount - ca.paid ELSE 0 END)::NUMERIC AS amount_31_60,
        SUM(CASE WHEN ca.days_old BETWEEN 61 AND 90 THEN ca.total_charge_amount - ca.paid ELSE 0 END)::NUMERIC AS amount_61_90,
        SUM(CASE WHEN ca.days_old BETWEEN 91 AND 120 THEN ca.total_charge_amount - ca.paid ELSE 0 END)::NUMERIC AS amount_91_120,
        SUM(CASE WHEN ca.days_old > 120 THEN ca.total_charge_amount - ca.paid ELSE 0 END)::NUMERIC AS amount_120_plus,
        COUNT(CASE WHEN ca.days_old <= 30 THEN 1 END)::INTEGER AS count_0_30,
        COUNT(CASE WHEN ca.days_old BETWEEN 31 AND 60 THEN 1 END)::INTEGER AS count_31_60,
        COUNT(CASE WHEN ca.days_old BETWEEN 61 AND 90 THEN 1 END)::INTEGER AS count_61_90,
        COUNT(CASE WHEN ca.days_old BETWEEN 91 AND 120 THEN 1 END)::INTEGER AS count_91_120,
        COUNT(CASE WHEN ca.days_old > 120 THEN 1 END)::INTEGER AS count_120_plus
    FROM claim_ages ca
    GROUP BY ca.p_id, ca.p_name
    ORDER BY SUM(ca.total_charge_amount - ca.paid) DESC;
END;
$$;

-- =============================================================================
-- get_denial_summary: Denial analysis by CARC code and payer
-- =============================================================================
CREATE OR REPLACE FUNCTION get_denial_summary(p_org_id INTEGER DEFAULT NULL, p_period TEXT DEFAULT '6M')
RETURNS TABLE(
    carc_code VARCHAR,
    carc_description VARCHAR,
    adjustment_group VARCHAR,
    payer_id VARCHAR,
    payer_name VARCHAR,
    denial_count INTEGER,
    total_denied_amount NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CASE p_period
        WHEN '1M' THEN CURRENT_DATE - INTERVAL '1 month'
        WHEN '3M' THEN CURRENT_DATE - INTERVAL '3 months'
        WHEN '6M' THEN CURRENT_DATE - INTERVAL '6 months'
        WHEN '1Y' THEN CURRENT_DATE - INTERVAL '1 year'
        ELSE CURRENT_DATE - INTERVAL '2 years'
    END;

    RETURN QUERY
    SELECT
        ca.carc_code::VARCHAR,
        COALESCE(ca.carc_description, 'Unknown')::VARCHAR AS carc_description,
        ca.adjustment_group_code::VARCHAR AS adjustment_group,
        cp.payer_id::VARCHAR,
        COALESCE(cp.payer_name, 'Unknown')::VARCHAR AS payer_name,
        COUNT(*)::INTEGER AS denial_count,
        SUM(ca.adjustment_amount)::NUMERIC AS total_denied_amount
    FROM claim_adjustments ca
    JOIN claim_payments cp ON ca.claim_payment_id = cp.id
    WHERE cp.created_at >= start_date
        AND (p_org_id IS NULL OR cp.org_id = p_org_id)
    GROUP BY ca.carc_code, ca.carc_description, ca.adjustment_group_code, cp.payer_id, cp.payer_name
    ORDER BY COUNT(*) DESC;
END;
$$;

-- =============================================================================
-- get_payer_performance: Payer metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION get_payer_performance(p_org_id INTEGER DEFAULT NULL, p_period TEXT DEFAULT '6M')
RETURNS TABLE(
    payer_id VARCHAR,
    payer_name VARCHAR,
    total_claims INTEGER,
    total_charged NUMERIC,
    total_paid NUMERIC,
    avg_days_to_payment NUMERIC,
    denial_rate NUMERIC,
    reimbursement_rate NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CASE p_period
        WHEN '1M' THEN CURRENT_DATE - INTERVAL '1 month'
        WHEN '3M' THEN CURRENT_DATE - INTERVAL '3 months'
        WHEN '6M' THEN CURRENT_DATE - INTERVAL '6 months'
        WHEN '1Y' THEN CURRENT_DATE - INTERVAL '1 year'
        ELSE CURRENT_DATE - INTERVAL '2 years'
    END;

    RETURN QUERY
    SELECT
        ch.payer_id::VARCHAR,
        COALESCE(ch.payer_name, 'Unknown')::VARCHAR AS payer_name,
        COUNT(*)::INTEGER AS total_claims,
        SUM(ch.total_charge_amount)::NUMERIC AS total_charged,
        SUM(COALESCE(ch.paid_amount, 0))::NUMERIC AS total_paid,
        COALESCE(AVG(
            CASE WHEN cp.payment_date IS NOT NULL AND cd.parsed_date IS NOT NULL
            THEN cp.payment_date - cd.parsed_date ELSE NULL END
        ), 0)::NUMERIC AS avg_days_to_payment,
        CASE WHEN COUNT(*) > 0
            THEN (COUNT(CASE WHEN ch.claim_status = 'denied' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100)
            ELSE 0
        END::NUMERIC AS denial_rate,
        CASE WHEN SUM(ch.total_charge_amount) > 0
            THEN (SUM(COALESCE(ch.paid_amount, 0))::NUMERIC / SUM(ch.total_charge_amount)::NUMERIC * 100)
            ELSE 0
        END::NUMERIC AS reimbursement_rate
    FROM claim_headers ch
    LEFT JOIN claim_payments cp ON cp.claim_header_id = ch.id
    LEFT JOIN claim_dates cd ON cd.claim_header_id = ch.id
        AND cd.date_qualifier IN ('472', '232')
        AND cd.claim_line_id IS NULL
    WHERE ch.file_name IS NOT NULL
        AND ch.created_at >= start_date
        AND (p_org_id IS NULL OR ch.org_id = p_org_id)
    GROUP BY ch.payer_id, ch.payer_name
    ORDER BY SUM(ch.total_charge_amount) DESC;
END;
$$;

-- =============================================================================
-- get_clean_claim_rate: First-pass acceptance rate
-- =============================================================================
CREATE OR REPLACE FUNCTION get_clean_claim_rate(p_org_id INTEGER DEFAULT NULL, p_period TEXT DEFAULT '6M')
RETURNS TABLE(
    period_label TEXT,
    total_claims INTEGER,
    clean_claims INTEGER,
    clean_claim_rate NUMERIC,
    denied_claims INTEGER,
    rejected_claims INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CASE p_period
        WHEN '1M' THEN CURRENT_DATE - INTERVAL '1 month'
        WHEN '3M' THEN CURRENT_DATE - INTERVAL '3 months'
        WHEN '6M' THEN CURRENT_DATE - INTERVAL '6 months'
        WHEN '1Y' THEN CURRENT_DATE - INTERVAL '1 year'
        ELSE CURRENT_DATE - INTERVAL '2 years'
    END;

    RETURN QUERY
    SELECT
        TO_CHAR(DATE_TRUNC('month', ch.created_at), 'Mon YYYY') AS period_label,
        COUNT(*)::INTEGER AS total_claims,
        COUNT(CASE WHEN ch.is_clean_claim = true
                    OR (ch.claim_status IN ('accepted', 'paid') AND ch.original_claim_id IS NULL)
              THEN 1 END)::INTEGER AS clean_claims,
        CASE WHEN COUNT(*) > 0
            THEN ROUND(
                COUNT(CASE WHEN ch.is_clean_claim = true
                            OR (ch.claim_status IN ('accepted', 'paid') AND ch.original_claim_id IS NULL)
                      THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 1)
            ELSE 0
        END::NUMERIC AS clean_claim_rate,
        COUNT(CASE WHEN ch.claim_status = 'denied' THEN 1 END)::INTEGER AS denied_claims,
        COUNT(CASE WHEN ch.claim_status = 'rejected' THEN 1 END)::INTEGER AS rejected_claims
    FROM claim_headers ch
    WHERE ch.file_name IS NOT NULL
        AND ch.created_at >= start_date
        AND (p_org_id IS NULL OR ch.org_id = p_org_id)
    GROUP BY DATE_TRUNC('month', ch.created_at)
    ORDER BY DATE_TRUNC('month', ch.created_at);
END;
$$;

-- Grant execute on all functions
GRANT EXECUTE ON FUNCTION get_payment_velocity TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_trend_data TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_ar_aging TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_denial_summary TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_payer_performance TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_clean_claim_rate TO authenticated, anon;

COMMENT ON FUNCTION get_payment_velocity IS 'Returns monthly payment velocity metrics (amount, count, avg days to payment)';
COMMENT ON FUNCTION get_trend_data IS 'Returns claim aging distribution in 30-day buckets';
COMMENT ON FUNCTION get_ar_aging IS 'Returns A/R aging by payer with 30/60/90/120/120+ buckets';
COMMENT ON FUNCTION get_denial_summary IS 'Returns denial analysis grouped by CARC code and payer';
COMMENT ON FUNCTION get_payer_performance IS 'Returns payer performance metrics (speed, denial rate, reimbursement)';
COMMENT ON FUNCTION get_clean_claim_rate IS 'Returns clean claim rate by month';
