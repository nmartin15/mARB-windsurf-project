from datetime import date, timedelta


def seed_rpc_dataset(conn):
    today = date.today()
    with conn.cursor() as cur:
        cur.execute("INSERT INTO organizations(name) VALUES ('RPC Test Org') RETURNING id")
        org_id = cur.fetchone()["id"]

        claims = [
            # paid, clean claim in current month
            {
                "claim_id": "C100",
                "status": "paid",
                "total": 200.0,
                "paid": 200.0,
                "payer_id": "P1",
                "payer_name": "Payer One",
                "days_old": 10,
                "is_clean": True,
            },
            # denied claim in prior month
            {
                "claim_id": "C200",
                "status": "denied",
                "total": 300.0,
                "paid": 0.0,
                "payer_id": "P2",
                "payer_name": "Payer Two",
                "days_old": 45,
                "is_clean": False,
            },
            # partial claim older bucket
            {
                "claim_id": "C300",
                "status": "partial",
                "total": 500.0,
                "paid": 100.0,
                "payer_id": "P1",
                "payer_name": "Payer One",
                "days_old": 95,
                "is_clean": False,
            },
        ]

        claim_id_map = {}
        for c in claims:
            created_at = today - timedelta(days=c["days_old"])
            cur.execute(
                """
                INSERT INTO claim_headers(
                    org_id, claim_id, claim_type, file_name, file_type, claim_status,
                    total_charge_amount, paid_amount, payer_id, payer_name, is_clean_claim, created_at
                ) VALUES (
                    %(org_id)s, %(claim_id)s, 'professional', 'seed_837.json', '837P', %(status)s,
                    %(total)s, %(paid)s, %(payer_id)s, %(payer_name)s, %(is_clean)s, %(created_at)s
                )
                RETURNING id
                """,
                {
                    "org_id": org_id,
                    "claim_id": c["claim_id"],
                    "status": c["status"],
                    "total": c["total"],
                    "paid": c["paid"],
                    "payer_id": c["payer_id"],
                    "payer_name": c["payer_name"],
                    "is_clean": c["is_clean"],
                    "created_at": created_at,
                },
            )
            claim_header_id = cur.fetchone()["id"]
            claim_id_map[c["claim_id"]] = claim_header_id

            cur.execute(
                """
                INSERT INTO claim_dates(claim_header_id, date_qualifier, date_value, parsed_date)
                VALUES (%s, '472', %s, %s)
                """,
                (claim_header_id, created_at.strftime("%Y%m%d"), created_at),
            )

        # payments (exclude denied one to keep realistic)
        cur.execute(
            """
            INSERT INTO claim_payments(
                claim_header_id, org_id, file_name, patient_control_number, claim_status_code,
                claim_status_desc, total_charge_amount, paid_amount, payer_id, payer_name,
                check_number, payment_date
            ) VALUES
                (%s, %s, 'seed_835.json', 'C100', '1', 'Processed as Primary', 200, 200, 'P1', 'Payer One', 'CHK-1', %s),
                (%s, %s, 'seed_835.json', 'C300', '2', 'Processed as Secondary', 500, 100, 'P1', 'Payer One', 'CHK-2', %s)
            RETURNING id
            """,
            (
                claim_id_map["C100"],
                org_id,
                today - timedelta(days=2),
                claim_id_map["C300"],
                org_id,
                today - timedelta(days=3),
            ),
        )
        payment_rows = cur.fetchall()
        first_payment_id = payment_rows[0]["id"]
        denied_related_payment_id = payment_rows[1]["id"]

        # denial adjustments to feed denial summary
        cur.execute(
            """
            INSERT INTO claim_adjustments(
                claim_payment_id, adjustment_group_code, adjustment_group_desc,
                carc_code, carc_description, adjustment_amount
            ) VALUES
                (%s, 'CO', 'Contractual Obligation', '45', 'Charges exceed fee schedule', 50.00),
                (%s, 'PR', 'Patient Responsibility', '2', 'Coinsurance Amount', 25.00)
            """,
            (first_payment_id, denied_related_payment_id),
        )

    return {"org_id": org_id}
