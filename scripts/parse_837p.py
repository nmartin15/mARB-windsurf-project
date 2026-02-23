"""
mARB Health — 837P Professional Claims Parser

Parses EDI 837P (CMS-1500) files into structured JSON matching the canonical
database schema. Handles CLM, SV1, HI, DTP, NM1, SBR, REF, PRV segments.

Usage:
    python parse_837p.py <input_file_or_folder> [--output <output.json>]

Output: JSON array of claim objects ready for load_to_supabase.py
"""

import os
import sys
import json
import argparse
import hashlib
from datetime import datetime
from edi_utils import parse_edi_content, split_composite


# ---------------------------------------------------------------------------
# Mapping dictionaries
# ---------------------------------------------------------------------------

FACILITY_TYPE_MAP = {
    '11': 'Office', '12': 'Home', '13': 'Critical Access Hospital',
    '14': 'Skilled Nursing Facility', '18': 'Psychiatric Hospital',
    '21': 'Inpatient Hospital', '22': 'Outpatient Hospital',
    '23': 'Emergency Room', '24': 'Ambulatory Surgical Center',
    '31': 'Skilled Nursing Facility', '32': 'Nursing Facility',
    '41': 'Ambulance Land', '42': 'Ambulance Air/Water',
    '51': 'Psychiatric Inpatient', '61': 'Inpatient Rehab',
    '71': 'Public Health Clinic', '85': 'Critical Access Hospital',
}

FREQUENCY_TYPE_MAP = {
    '1': 'Original Claim', '7': 'Corrected Claim', '8': 'Void Claim',
    '5': 'Late Charge Claim', '6': 'Adjusted Claim',
}

ASSIGNMENT_MAP = {
    'A': 'Assigned', 'B': 'Assignment Accepted on Lab Only', 'C': 'Not Assigned',
}

FILING_INDICATOR_MAP = {
    '11': 'Other Non-Federal', '12': 'PPO', '13': 'POS', '14': 'EPO',
    '15': 'Indemnity', '16': 'HMO Medicare Risk', '17': 'DMO',
    'AM': 'Auto Medical', 'CI': 'Commercial Insurance',
    'MA': 'Medicare Part A', 'MB': 'Medicare Part B', 'MC': 'Medicaid',
    'CH': 'CHAMPUS/TRICARE', 'VA': 'Veterans Affairs', 'OF': 'Other Federal',
    'WC': 'Workers Compensation', 'LI': 'Liability Insurance',
    'BL': 'BCBS', 'FI': 'Federal Employees', 'HM': 'HMO',
    'TV': 'Title V', 'ZZ': 'Mutually Defined',
}

PAYER_RESP_MAP = {'P': 'Primary', 'S': 'Secondary', 'T': 'Tertiary'}

DTP_QUALIFIER_MAP = {
    '434': 'Statement Dates', '435': 'Admission Date', '096': 'Discharge Date',
    '232': 'Statement Period Start', '233': 'Statement Period End',
    '472': 'Service Date', '473': 'Prescription Date', '573': 'Claim Paid Date',
    '439': 'Accident Date', '454': 'Initial Treatment Date',
    '431': 'Onset of Symptoms',
}

DIAGNOSIS_TYPE_MAP = {
    'ABK': 'principal', 'ABJ': 'principal', 'ABF': 'other',
    'APR': 'reason_for_visit', 'ABN': 'reason_for_visit',
    'BBR': 'admitting', 'BBQ': 'other',
    'BP': 'external_cause', 'BG': 'drg', 'DR': 'drg',
}

PROVIDER_ROLE_MAP = {
    '71': 'attending', '72': 'operating', '82': 'rendering',
    '77': 'service_location', 'DN': 'referring', 'DQ': 'supervising',
    'OB': 'other',
}

REF_QUALIFIER_MAP = {
    'D9': 'Claim Identifier', 'EA': 'Medical Record Number',
    'F8': 'Resubmission Original Reference', 'G1': 'Prior Authorization Number',
    '9A': 'Repriced Claim Reference', '9B': 'Referral Number',
}


# ---------------------------------------------------------------------------
# EDI parsing utilities
# ---------------------------------------------------------------------------

def parse_edi_file(file_path):
    """Read an EDI file and return parsed segments plus detected delimiters."""
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    return parse_edi_content(content)


def get_claim_blocks(segments):
    """Split segments into blocks starting at HL*x*x*22 (subscriber level)."""
    blocks = []
    current = []
    for seg in segments:
        if seg[0] == 'HL' and len(seg) >= 4 and seg[3] == '22':
            if current:
                blocks.append(current)
            current = [seg]
        elif current:
            current.append(seg)
    if current:
        blocks.append(current)
    return blocks


def safe_get(lst, idx, default=''):
    """Safe list index access."""
    return lst[idx] if idx < len(lst) else default


def parse_date(date_str, fmt='D8'):
    """Parse EDI date string to ISO format."""
    if not date_str:
        return None
    try:
        if fmt == 'RD8' and '-' in date_str:
            parts = date_str.split('-')
            return datetime.strptime(parts[0], '%Y%m%d').strftime('%Y-%m-%d')
        return datetime.strptime(date_str[:8], '%Y%m%d').strftime('%Y-%m-%d')
    except (ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# Claim extraction
# ---------------------------------------------------------------------------

def extract_claim(block, file_name, component_sep=':'):
    """Extract a single claim and all related data from a claim block."""

    claim = {
        'claim_type': 'professional',
        'file_name': file_name,
        'file_type': '837P',
    }
    lines = []
    diagnoses = []
    dates_header = []
    dates_line = []
    providers = []
    references = []

    claim_id = None
    current_line_number = None
    in_header = True  # True until we hit the first LX

    # --- SBR / Payer info ---
    sbr_data = {}
    payer_data = {}

    for seg in block:
        seg_id = seg[0]

        # CLM segment
        if seg_id == 'CLM' and len(seg) >= 6:
            claim_id = safe_get(seg, 1)
            claim['claim_id'] = claim_id
            claim['total_charge_amount'] = safe_get(seg, 2)

            location_info = safe_get(seg, 5, '')
            parts = split_composite(location_info, component_sep)
            if len(parts) >= 1:
                claim['facility_type_code'] = parts[0]
                claim['facility_type_desc'] = FACILITY_TYPE_MAP.get(parts[0], '')
            if len(parts) >= 2:
                claim['facility_code_qualifier'] = parts[1]
            if len(parts) >= 3:
                claim['claim_frequency_type_code'] = parts[2]
                claim['claim_frequency_type_desc'] = FREQUENCY_TYPE_MAP.get(parts[2], '')

            if len(seg) >= 8:
                claim['assignment_code'] = safe_get(seg, 7)
                claim['assignment_desc'] = ASSIGNMENT_MAP.get(safe_get(seg, 7), '')
            if len(seg) >= 9:
                claim['benefits_assignment'] = safe_get(seg, 8)
            if len(seg) >= 10:
                claim['release_of_info_code'] = safe_get(seg, 9)

        # SBR segment (subscriber/payer info)
        elif seg_id == 'SBR' and len(seg) >= 2:
            sbr_data['payer_responsibility_code'] = safe_get(seg, 1)
            sbr_data['payer_responsibility_desc'] = PAYER_RESP_MAP.get(safe_get(seg, 1), '')
            if len(seg) >= 10:
                code = safe_get(seg, 9)
                claim['claim_filing_indicator_code'] = code
                claim['claim_filing_indicator_desc'] = FILING_INDICATOR_MAP.get(code, '')

        # NM1*PR — Payer name
        elif seg_id == 'NM1' and safe_get(seg, 1) == 'PR' and len(seg) >= 4:
            payer_data['payer_name'] = safe_get(seg, 3)
            if len(seg) >= 10:
                payer_data['payer_id'] = safe_get(seg, 9)

        # NM1 — Claim-level providers (between CLM and LX)
        elif seg_id == 'NM1' and safe_get(seg, 1) != 'PR' and in_header and len(seg) >= 4:
            entity_code = safe_get(seg, 1)
            role = PROVIDER_ROLE_MAP.get(entity_code, 'other')
            provider = {
                'provider_role': role,
                'entity_identifier_code': entity_code,
                'entity_type_qualifier': safe_get(seg, 2),
                'last_or_org_name': safe_get(seg, 3),
                'first_name': safe_get(seg, 4),
                'middle_name': safe_get(seg, 5),
            }
            if len(seg) >= 10:
                provider['id_code_qualifier'] = safe_get(seg, 8)
                provider['npi'] = safe_get(seg, 9)
            providers.append(provider)

        # NM1*85 — Billing provider (file-level, not in claim block usually)
        elif seg_id == 'NM1' and safe_get(seg, 1) == '85' and len(seg) >= 10:
            providers.append({
                'provider_role': 'billing',
                'entity_identifier_code': '85',
                'entity_type_qualifier': safe_get(seg, 2),
                'last_or_org_name': safe_get(seg, 3),
                'first_name': safe_get(seg, 4),
                'id_code_qualifier': safe_get(seg, 8),
                'npi': safe_get(seg, 9),
            })

        # PRV — Provider taxonomy (in claim block)
        elif seg_id == 'PRV' and in_header and len(seg) >= 4:
            for prov in providers:
                if not prov.get('taxonomy_code'):
                    prov['taxonomy_code'] = safe_get(seg, 3)
                    break

        # DTP — dates (header level, between CLM and LX)
        elif seg_id == 'DTP' and in_header and len(seg) >= 4:
            qual = safe_get(seg, 1)
            fmt = safe_get(seg, 2)
            date_val = safe_get(seg, 3)
            dates_header.append({
                'date_qualifier': qual,
                'date_qualifier_desc': DTP_QUALIFIER_MAP.get(qual, ''),
                'date_format_qualifier': fmt,
                'date_value': date_val,
                'parsed_date': parse_date(date_val, fmt),
            })

        # HI — Diagnoses (between CLM and LX)
        elif seg_id == 'HI' and in_header:
            for i in range(1, len(seg)):
                element = seg[i]
                parts = split_composite(element, component_sep)
                if len(parts) >= 2:
                    qualifier = parts[0]
                    code = parts[1]
                    diagnoses.append({
                        'diagnosis_code': code,
                        'diagnosis_type': DIAGNOSIS_TYPE_MAP.get(qualifier, 'other'),
                        'code_qualifier': qualifier,
                        'sequence_number': len(diagnoses) + 1,
                    })

        # REF — Reference numbers (between CLM and LX)
        elif seg_id == 'REF' and in_header and len(seg) >= 3:
            qual = safe_get(seg, 1)
            references.append({
                'reference_qualifier': qual,
                'reference_qualifier_desc': REF_QUALIFIER_MAP.get(qual, ''),
                'reference_value': safe_get(seg, 2),
            })
            if qual == 'G1':
                claim['prior_auth_number'] = safe_get(seg, 2)
                claim['prior_auth_status'] = 'approved'

        # LX — Line number (starts service line section)
        elif seg_id == 'LX' and len(seg) >= 2:
            in_header = False
            current_line_number = safe_get(seg, 1)

        # SV1 — Professional service line
        elif seg_id == 'SV1' and current_line_number and len(seg) >= 5:
            proc_info = safe_get(seg, 1, '')
            proc_parts = split_composite(proc_info, component_sep)
            procedure_code = proc_parts[1] if len(proc_parts) >= 2 else ''
            procedure_qualifier = proc_parts[0] if len(proc_parts) >= 1 else ''

            line = {
                'line_number': int(current_line_number) if current_line_number.isdigit() else 1,
                'procedure_code': procedure_code,
                'procedure_qualifier': procedure_qualifier,
                'charge_amount': safe_get(seg, 2),
                'unit_measurement_code': safe_get(seg, 3),
                'unit_count': safe_get(seg, 4),
            }

            # Modifiers from procedure info
            for mi, mk in enumerate(['modifier_1', 'modifier_2', 'modifier_3', 'modifier_4'], start=2):
                if len(proc_parts) > mi:
                    line[mk] = proc_parts[mi]

            # Place of service
            if len(seg) >= 6:
                line['place_of_service_code'] = safe_get(seg, 5)

            lines.append(line)

        # DTP — Line-level dates (after LX)
        elif seg_id == 'DTP' and not in_header and current_line_number and len(seg) >= 4:
            qual = safe_get(seg, 1)
            fmt = safe_get(seg, 2)
            date_val = safe_get(seg, 3)
            dates_line.append({
                'line_number': int(current_line_number) if current_line_number.isdigit() else 1,
                'date_qualifier': qual,
                'date_qualifier_desc': DTP_QUALIFIER_MAP.get(qual, ''),
                'date_format_qualifier': fmt,
                'date_value': date_val,
                'parsed_date': parse_date(date_val, fmt),
            })

    # Merge SBR/payer data into claim
    claim.update(sbr_data)
    claim.update(payer_data)

    return {
        'claim': claim,
        'lines': lines,
        'diagnoses': diagnoses,
        'dates_header': dates_header,
        'dates_line': dates_line,
        'providers': providers,
        'references': references,
    }


# ---------------------------------------------------------------------------
# File-level extraction (billing provider, ISA/GS metadata)
# ---------------------------------------------------------------------------

def extract_file_metadata(segments, file_name):
    """Extract file-level data not inside claim blocks (ISA, GS, NM1*85)."""
    metadata = {'file_name': file_name}
    billing_provider = None

    for seg in segments:
        seg_id = seg[0]

        if seg_id == 'ISA' and len(seg) >= 16:
            metadata['sender_id'] = safe_get(seg, 6, '').strip()
            metadata['receiver_id'] = safe_get(seg, 8, '').strip()

        elif seg_id == 'GS' and len(seg) >= 9:
            metadata['transaction_type'] = safe_get(seg, 1)
            metadata['gs_sender'] = safe_get(seg, 2)
            metadata['gs_receiver'] = safe_get(seg, 3)

        elif seg_id == 'ST' and len(seg) >= 2:
            metadata['transaction_set'] = safe_get(seg, 1)

        elif seg_id == 'NM1' and safe_get(seg, 1) == '85' and len(seg) >= 10:
            billing_provider = {
                'provider_role': 'billing',
                'entity_identifier_code': '85',
                'entity_type_qualifier': safe_get(seg, 2),
                'last_or_org_name': safe_get(seg, 3),
                'first_name': safe_get(seg, 4),
                'id_code_qualifier': safe_get(seg, 8),
                'npi': safe_get(seg, 9),
            }

        elif seg_id == 'PRV' and safe_get(seg, 1) == 'BI' and billing_provider and len(seg) >= 4:
            billing_provider['taxonomy_code'] = safe_get(seg, 3)

    return metadata, billing_provider


def build_parse_summary(claims):
    """Build lightweight parser quality metrics for a parsed 837P file."""
    summary = {
        'warnings': [],
        'unknown_dtp_qualifiers': set(),
        'unknown_ref_qualifiers': set(),
        'unknown_diagnosis_qualifiers': set(),
        'invalid_dates': 0,
    }

    for claim_data in claims:
        claim = claim_data.get('claim', {})
        if claim.get('claim_filing_indicator_code') and not claim.get('claim_filing_indicator_desc'):
            summary['warnings'].append(
                f"Unknown filing indicator: {claim.get('claim_filing_indicator_code')}"
            )

        for dt in claim_data.get('dates_header', []) + claim_data.get('dates_line', []):
            qualifier = dt.get('date_qualifier')
            if qualifier and not dt.get('date_qualifier_desc'):
                summary['unknown_dtp_qualifiers'].add(qualifier)
            if dt.get('date_value') and dt.get('parsed_date') is None:
                summary['invalid_dates'] += 1

        for ref in claim_data.get('references', []):
            qualifier = ref.get('reference_qualifier')
            if qualifier and not ref.get('reference_qualifier_desc'):
                summary['unknown_ref_qualifiers'].add(qualifier)

        for dx in claim_data.get('diagnoses', []):
            qualifier = dx.get('code_qualifier')
            if qualifier and dx.get('diagnosis_type') == 'other' and qualifier not in DIAGNOSIS_TYPE_MAP:
                summary['unknown_diagnosis_qualifiers'].add(qualifier)

    return {
        'warnings': summary['warnings'][:25],
        'unknown_dtp_qualifiers': sorted(summary['unknown_dtp_qualifiers']),
        'unknown_ref_qualifiers': sorted(summary['unknown_ref_qualifiers']),
        'unknown_diagnosis_qualifiers': sorted(summary['unknown_diagnosis_qualifiers']),
        'invalid_dates': summary['invalid_dates'],
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_837p_file(file_path):
    """Parse a single 837P file and return structured data."""
    file_name = os.path.basename(file_path)
    segments, delimiters = parse_edi_file(file_path)
    component_sep = delimiters.get('component', ':')
    blocks = get_claim_blocks(segments)
    metadata, billing_provider = extract_file_metadata(segments, file_name)

    # Compute file hash for dedup
    with open(file_path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    claims = []
    for block in blocks:
        claim_data = extract_claim(block, file_name, component_sep)

        # Add billing provider if not already in the claim's providers
        if billing_provider:
            has_billing = any(p.get('provider_role') == 'billing' for p in claim_data['providers'])
            if not has_billing:
                claim_data['providers'].insert(0, billing_provider.copy())

        claims.append(claim_data)

    parse_summary = build_parse_summary(claims)

    return {
        'file_name': file_name,
        'file_type': '837P',
        'file_hash': file_hash,
        'record_count': len(claims),
        'metadata': metadata,
        'parse_summary': {
            **parse_summary,
            'segment_delimiter': delimiters.get('segment'),
            'element_delimiter': delimiters.get('element'),
            'component_delimiter': delimiters.get('component'),
        },
        'claims': claims,
    }


def parse_folder(folder_path):
    """Parse all EDI files in a folder."""
    results = []
    for fname in os.listdir(folder_path):
        if fname.upper().endswith(('.TXT', '.EDI', '.837', '.X12')):
            fpath = os.path.join(folder_path, fname)
            try:
                result = parse_837p_file(fpath)
                results.append(result)
                print(f"Parsed {fname}: {result['record_count']} claims")
            except Exception as e:
                print(f"Error parsing {fname}: {e}")
                results.append({
                    'file_name': fname,
                    'file_type': '837P',
                    'error': str(e),
                    'claims': [],
                })
    return results


def main():
    parser = argparse.ArgumentParser(description='Parse 837P EDI files')
    parser.add_argument('input', help='Input file or folder path')
    parser.add_argument('--output', '-o', help='Output JSON file path', default=None)
    args = parser.parse_args()

    if os.path.isdir(args.input):
        results = parse_folder(args.input)
    elif os.path.isfile(args.input):
        results = [parse_837p_file(args.input)]
    else:
        print(f"Error: {args.input} not found")
        sys.exit(1)

    output_path = args.output or 'parsed_837p_output.json'
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    total_claims = sum(r.get('record_count', 0) for r in results)
    print(f"\nTotal: {len(results)} files, {total_claims} claims -> {output_path}")


if __name__ == '__main__':
    main()
