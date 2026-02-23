"""
Shared EDI parsing helpers for 837/835 scripts.

This module centralizes delimiter detection and low-level parsing so parsers can
handle payer-specific separator variants without hardcoded assumptions.
"""

from __future__ import annotations

from typing import Dict, List, Tuple


def detect_delimiters(content: str) -> Dict[str, str]:
    """
    Detect segment/element/component delimiters from ISA envelope when possible.

    Returns:
        {
            "segment": "~",
            "element": "*",
            "component": ":",
            "repetition": "^"
        }
    """
    defaults = {
        "segment": "~",
        "element": "*",
        "component": ":",
        "repetition": "^",
    }
    if not content:
        return defaults

    isa_pos = content.find("ISA")
    if isa_pos == -1 or len(content) < isa_pos + 106:
        return defaults

    # X12 ISA is fixed length. Element separator is char 4, component separator
    # is ISA16, and segment terminator follows ISA16.
    element_sep = content[isa_pos + 3]
    component_sep = content[isa_pos + 104]
    segment_term = content[isa_pos + 105]

    if not element_sep.strip() or not segment_term.strip():
        return defaults

    return {
        "segment": segment_term,
        "element": element_sep,
        "component": component_sep if component_sep.strip() else defaults["component"],
        "repetition": "^",
    }


def parse_edi_content(content: str) -> Tuple[List[List[str]], Dict[str, str]]:
    """Parse raw EDI text into segment/element arrays using detected delimiters."""
    delimiters = detect_delimiters(content)
    segment_sep = delimiters["segment"]
    element_sep = delimiters["element"]

    raw_segments = content.split(segment_sep)
    segments: List[List[str]] = []
    for seg in raw_segments:
        cleaned = seg.strip().replace("\n", "").replace("\r", "")
        if cleaned:
            segments.append(cleaned.split(element_sep))
    return segments, delimiters


def split_composite(value: str, component_sep: str) -> List[str]:
    """Split a composite value with fallback separators for legacy files."""
    if not value:
        return []

    if component_sep and component_sep in value:
        return value.split(component_sep)

    # Backward compatibility for files that effectively use ":" or ">".
    if ":" in value:
        return value.split(":")
    if ">" in value:
        return value.split(">")
    return [value]
