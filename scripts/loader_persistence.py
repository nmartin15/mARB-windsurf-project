"""
Persistence helpers for EDI loader.

This module keeps DB write/idempotency utilities separate from orchestration and
matching logic to reduce coupling in load_to_supabase.py.
"""

_CLAIM_PAYMENTS_OPTIONAL_COLUMNS = None


def build_optional_payment_fields(client, payer_claim_control_number, match_strategy, match_reason_code):
    """
    Build optional claim_payments fields only when columns exist.

    This keeps the loader backward-compatible with older schemas.
    """
    supported = get_claim_payments_optional_columns(client)
    payload = {}
    if supported.get("payer_claim_control_number"):
        payload["payer_claim_control_number"] = payer_claim_control_number
    if supported.get("match_strategy"):
        payload["match_strategy"] = match_strategy
    if supported.get("match_reason_code"):
        payload["match_reason_code"] = match_reason_code
    return payload


def get_claim_payments_optional_columns(client):
    """Detect optional claim_payments columns once per process."""
    global _CLAIM_PAYMENTS_OPTIONAL_COLUMNS
    if _CLAIM_PAYMENTS_OPTIONAL_COLUMNS is not None:
        return _CLAIM_PAYMENTS_OPTIONAL_COLUMNS

    candidates = ["payer_claim_control_number", "match_strategy", "match_reason_code"]
    supported = {}
    for column in candidates:
        try:
            client.table("claim_payments").select(column).limit(1).execute()
            supported[column] = True
        except Exception:
            supported[column] = False

    _CLAIM_PAYMENTS_OPTIONAL_COLUMNS = supported
    return supported


def upsert_claim_header(client, payload):
    """
    Upsert claim header by natural key to support idempotent reruns.

    Natural key used:
      claim_id + file_name + file_type (+ org_id when available)
    """
    query = (
        client.table("claim_headers")
        .select("id")
        .eq("claim_id", payload.get("claim_id"))
        .eq("file_name", payload.get("file_name"))
        .eq("file_type", payload.get("file_type"))
        .limit(1)
    )
    org_id = payload.get("org_id")
    if org_id is None:
        query = query.is_("org_id", "null")
    else:
        query = query.eq("org_id", org_id)

    existing = query.execute()
    if existing.data:
        header_id = existing.data[0]["id"]
        client.table("claim_headers").update(payload).eq("id", header_id).execute()
        return header_id, True

    created = client.table("claim_headers").insert(payload).execute()
    return created.data[0]["id"], False


def clear_claim_children(client, header_id):
    """Delete dependent rows before reinserting on idempotent claim reload."""
    client.table("claim_lines").delete().eq("claim_header_id", header_id).execute()
    client.table("claim_diagnoses").delete().eq("claim_header_id", header_id).execute()
    client.table("claim_dates").delete().eq("claim_header_id", header_id).execute()
    client.table("claim_providers").delete().eq("claim_header_id", header_id).execute()
    client.table("claim_references").delete().eq("claim_header_id", header_id).execute()


def upsert_claim_payment(client, payload):
    """
    Upsert claim payment by conservative natural key for idempotent reruns.

    Natural key used:
      file_name + patient_control_number + check_number + payment_date
    """
    query = (
        client.table("claim_payments")
        .select("id")
        .eq("file_name", payload.get("file_name"))
        .eq("patient_control_number", payload.get("patient_control_number"))
        .eq("check_number", payload.get("check_number"))
        .limit(1)
    )
    payment_date = payload.get("payment_date")
    if payment_date is None:
        query = query.is_("payment_date", "null")
    else:
        query = query.eq("payment_date", payment_date)

    existing = query.execute()
    if existing.data:
        payment_id = existing.data[0]["id"]
        client.table("claim_payments").update(payload).eq("id", payment_id).execute()
        return payment_id, True

    created = client.table("claim_payments").insert(payload).execute()
    return created.data[0]["id"], False


def clear_payment_children(client, payment_id):
    """Delete payment line/adjustment children before idempotent reinsertion."""
    client.table("claim_adjustments").delete().eq("claim_payment_id", payment_id).execute()
    client.table("claim_payment_lines").delete().eq("claim_payment_id", payment_id).execute()
