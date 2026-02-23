"""
Shared lightweight models/constants for pipeline modules.
"""

from dataclasses import dataclass


MATCH_STRATEGY_KEYS = ("clp01", "clp07_original_claim_id", "clp07_ref", "unmatched")


@dataclass(frozen=True)
class MatchResult:
    claim_header_id: int | None
    strategy: str
    reason_code: str
