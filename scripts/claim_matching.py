"""
Claim matching helpers for linking 835 payments to 837 claims.

Configuration is loaded from matching_config.json to avoid hardcoding payer
crosswalk preferences in loader logic.
"""

from __future__ import annotations

import json
import os
import re
from pipeline_models import MatchResult


_MATCHING_CONFIG = None


def match_claim_header(client, pcn, payer_claim_control_number):
    """Match an 835 payment to a claim header with explicit fallback strategy."""
    normalized_pcn_candidates = claim_key_candidates(pcn)
    for candidate in normalized_pcn_candidates:
        direct = client.table("claim_headers").select("id").eq("claim_id", candidate).limit(1).execute()
        if direct.data:
            return MatchResult(direct.data[0]["id"], "clp01", "MATCHED_CLAIM_ID")

    # Fallback 1: CLP07 against claim header original claim id.
    normalized_clp07_candidates = claim_key_candidates(payer_claim_control_number)
    for candidate in normalized_clp07_candidates:
        original_ref = (
            client.table("claim_headers")
            .select("id")
            .eq("original_claim_id", candidate)
            .limit(1)
            .execute()
        )
        if original_ref.data:
            return MatchResult(
                original_ref.data[0]["id"],
                "clp07_original_claim_id",
                "MATCHED_ORIGINAL_CLAIM_ID",
            )

    # Fallback 2: CLP07 against prioritized REF qualifiers.
    qualifier_priority = load_matching_config().get("reference_qualifier_priority", [])
    for candidate in normalized_clp07_candidates:
        for qualifier in qualifier_priority:
            ref_match = (
                client.table("claim_references")
                .select("claim_header_id")
                .eq("reference_qualifier", qualifier)
                .eq("reference_value", candidate)
                .limit(1)
                .execute()
            )
            if ref_match.data:
                return MatchResult(
                    ref_match.data[0]["claim_header_id"],
                    "clp07_ref",
                    f"MATCHED_REF_{qualifier}",
                )

    # Fallback 3: broad REF value match.
    for candidate in normalized_clp07_candidates:
        ref_match = (
            client.table("claim_references")
            .select("claim_header_id")
            .eq("reference_value", candidate)
            .limit(1)
            .execute()
        )
        if ref_match.data:
            return MatchResult(ref_match.data[0]["claim_header_id"], "clp07_ref", "MATCHED_REF_ANY")

    if pcn and not normalized_pcn_candidates:
        return MatchResult(None, "unmatched", "UNUSABLE_CLP01")
    if payer_claim_control_number and not normalized_clp07_candidates:
        return MatchResult(None, "unmatched", "UNUSABLE_CLP07")
    if pcn:
        return MatchResult(None, "unmatched", "NO_MATCH_CLP01_CLP07")
    if payer_claim_control_number:
        return MatchResult(None, "unmatched", "NO_MATCH_CLP07")
    return MatchResult(None, "unmatched", "NO_KEYS")


def claim_key_candidates(value):
    """
    Generate deterministic candidate keys for resilient claim matching.

    Includes original token, normalized token, and leading-zero trimmed variants.
    """
    if value is None:
        return []

    key = str(value).strip()
    if not key:
        return []

    candidates = [key]
    normalized = normalize_claim_key(key)
    if normalized and normalized not in candidates:
        candidates.append(normalized)

    no_leading_zeros = key.lstrip("0")
    if no_leading_zeros and no_leading_zeros != key:
        candidates.append(no_leading_zeros)
        normalized_no_zeros = normalize_claim_key(no_leading_zeros)
        if normalized_no_zeros and normalized_no_zeros not in candidates:
            candidates.append(normalized_no_zeros)
    return candidates


def normalize_claim_key(value):
    """Normalize claim identifiers by removing punctuation and whitespace."""
    if value is None:
        return ""
    token = str(value).strip().upper()
    return re.sub(r"[^A-Z0-9]", "", token)


def load_matching_config():
    """Load matching config from scripts/matching_config.json once per process."""
    global _MATCHING_CONFIG
    if _MATCHING_CONFIG is not None:
        return _MATCHING_CONFIG

    default = {"reference_qualifier_priority": ["1K", "D9", "F8", "9A"]}
    config_path = os.path.join(os.path.dirname(__file__), "matching_config.json")
    if not os.path.exists(config_path):
        _MATCHING_CONFIG = default
        return _MATCHING_CONFIG

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        qualifiers = loaded.get("reference_qualifier_priority", default["reference_qualifier_priority"])
        if not isinstance(qualifiers, list):
            qualifiers = default["reference_qualifier_priority"]
        _MATCHING_CONFIG = {"reference_qualifier_priority": [str(q) for q in qualifiers]}
    except Exception:
        _MATCHING_CONFIG = default
    return _MATCHING_CONFIG
