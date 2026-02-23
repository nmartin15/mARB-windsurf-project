"""
mARB Health — 835 Electronic Remittance Advice Parser

Parses EDI 835 files into structured JSON matching the canonical database schema.
Extracts payment information (CLP), service-level payments (SVC), and
adjustment/denial codes (CAS).

Usage:
    python parse_835.py <input_file_or_folder> [--output <output.json>]

Output: JSON array of payment objects ready for load_to_supabase.py
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

CLP_STATUS_MAP = {
    '1': 'Processed as Primary',
    '2': 'Processed as Secondary',
    '3': 'Processed as Tertiary',
    '4': 'Denied',
    '19': 'Processed as Primary, Forwarded to Additional Payer(s)',
    '20': 'Processed as Secondary, Forwarded to Additional Payer(s)',
    '21': 'Processed as Tertiary, Forwarded to Additional Payer(s)',
    '22': 'Reversal of Previous Payment',
    '23': 'Not Our Claim, Forwarded to Additional Payer(s)',
    '25': 'Reject into payment cycle',
}

ADJUSTMENT_GROUP_MAP = {
    'CO': 'Contractual Obligation',
    'PR': 'Patient Responsibility',
    'OA': 'Other Adjustment',
    'PI': 'Payer Initiated Reduction',
    'CR': 'Correction/Reversal',
}

CARC_MAP = {
    '1': 'Deductible Amount',
    '2': 'Coinsurance Amount',
    '3': 'Copayment Amount',
    '4': 'Procedure code inconsistent with modifier',
    '5': 'Procedure code inconsistent with place of service',
    '6': 'Procedure/revenue code inconsistent with diagnosis',
    '9': 'Services not authorized',
    '16': 'Claim lacks information needed for adjudication',
    '18': 'Exact duplicate claim/service',
    '22': 'Care may be covered by another payer',
    '23': 'Charges included in allowance for another service',
    '24': 'Charges covered under capitation',
    '26': 'Expenses incurred prior to coverage',
    '27': 'Expenses incurred after coverage',
    '29': 'Time limit for filing has expired',
    '31': 'Patient not eligible for service on date of service',
    '35': 'Lifetime benefit maximum has been reached',
    '39': 'Services denied at the time authorization/pre-certification was requested',
    '45': 'Charges exceed contracted/legislated fee arrangement',
    '49': 'Non-covered because it is a routine/preventive exam',
    '50': 'Non-covered services',
    '55': 'Procedure requires prior authorization',
    '96': 'Non-covered charge(s)',
    '97': 'Benefit not included in current contract/plan',
    '109': 'Not covered by this payer/contractor',
    '119': 'Benefit maximum for this time period/occurrence has been reached',
    '167': 'Diagnosis is not covered',
    '197': 'Precertification/authorization/notification absent',
    '204': 'Service not covered/authorized',
    '242': 'Services not provided by designated provider',
    '252': 'Service not on approved list',
    'A1': 'Claim/service denied (Claim PPS)',
    'A6': 'Prior hospitalization or 30-day transfer requirement not met',
    'B7': 'Provider not certified/eligible to be paid for this procedure',
    'B15': 'Coverage not in effect at the time the service was provided',
}

PAYMENT_METHOD_MAP = {
    'ACH': 'Automated Clearing House',
    'CHK': 'Check',
    'FWT': 'Federal Wire Transfer',
    'NON': 'Non-Payment Data',
}

DTM_QUALIFIER_MAP = {
    '036': 'Expiration Date',
    '050': 'Received Date',
    '232': 'Claim Statement Period Start',
    '233': 'Claim Statement Period End',
    '405': 'Production Date',
    '472': 'Service Date',
    '573': 'Date Claim Paid',
}

FILING_INDICATOR_MAP = {
    '12': 'PPO', '13': 'POS', '14': 'EPO', '15': 'Indemnity',
    'MA': 'Medicare Part A', 'MB': 'Medicare Part B', 'MC': 'Medicaid',
    'BL': 'BCBS', 'CI': 'Commercial', 'HM': 'HMO',
    'WC': 'Workers Comp', 'CH': 'TRICARE',
}


# ---------------------------------------------------------------------------
# EDI parsing utilities
# ---------------------------------------------------------------------------

def parse_edi_file(file_path):
    """Read an EDI file and return parsed segments plus detected delimiters."""
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    return parse_edi_content(content)


def safe_get(lst, idx, default=''):
    return lst[idx] if idx < len(lst) else default


def parse_date(date_str):
    """Parse CCYYMMDD date string to ISO format."""
    if not date_str or len(date_str) < 8:
        return None
    try:
        return datetime.strptime(date_str[:8], '%Y%m%d').strftime('%Y-%m-%d')
    except ValueError:
        return None


def parse_amount(amount_str):
    """Parse amount string to float, handling negatives."""
    if not amount_str:
        return None
    try:
        return float(amount_str)
    except ValueError:
        return None


def parse_cas_adjustments(seg, summary=None):
    """
    Parse CAS adjustments from a CAS segment.

    Handles repeated reason/amount(/quantity) triplets and remains tolerant of
    unknown group codes.
    """
    adjustments = []
    if len(seg) < 4:
        return adjustments

    group_code = safe_get(seg, 1)
    group_desc = ADJUSTMENT_GROUP_MAP.get(group_code, 'Unknown')
    if summary is not None and group_code and group_code not in ADJUSTMENT_GROUP_MAP:
        summary['unknown_adjustment_groups'].add(group_code)
    idx = 2

    while idx < len(seg):
        carc = safe_get(seg, idx)
        if not carc:
            break

        # Defensive break if malformed segment appears to start a new group.
        if carc in ADJUSTMENT_GROUP_MAP and idx != 2:
            break

        amount = parse_amount(safe_get(seg, idx + 1)) if idx + 1 < len(seg) else None
        qty = None
        if idx + 2 < len(seg):
            qty_token = safe_get(seg, idx + 2)
            # If next token is a new group code, quantity is absent.
            if qty_token not in ADJUSTMENT_GROUP_MAP:
                try:
                    qty = int(qty_token)
                except (ValueError, TypeError):
                    qty = None
                idx += 3
            else:
                idx += 2
        else:
            idx += 2

        adjustments.append({
            'adjustment_group_code': group_code,
            'adjustment_group_desc': group_desc,
            'carc_code': carc,
            'carc_description': CARC_MAP.get(carc, ''),
            'adjustment_amount': amount,
            'adjustment_quantity': qty,
        })
        if summary is not None and carc and carc not in CARC_MAP:
            summary['unknown_carc_codes'].add(carc)

    return adjustments


# ---------------------------------------------------------------------------
# 835 extraction
# ---------------------------------------------------------------------------

def extract_payments(segments, file_name, component_sep=':'):
    """Extract all payment records from 835 segments."""
    payments = []
    current_payment = None
    current_svc = None
    payer_info = {}
    check_info = {}
    summary = {
        'warnings': [],
        'unknown_adjustment_groups': set(),
        'unknown_carc_codes': set(),
        'unknown_clp_status_codes': set(),
        'invalid_dates': 0,
    }

    for seg in segments:
        seg_id = seg[0]

        # ISA — Interchange header
        if seg_id == 'ISA' and len(seg) >= 16:
            pass  # metadata only

        # N1*PR — Payer identification
        elif seg_id == 'N1' and safe_get(seg, 1) == 'PR' and len(seg) >= 4:
            payer_info['payer_name'] = safe_get(seg, 2)
            if len(seg) >= 5:
                payer_info['payer_id'] = safe_get(seg, 4)

        # N1*PE — Payee (provider) identification
        elif seg_id == 'N1' and safe_get(seg, 1) == 'PE':
            pass  # provider info, can extract if needed

        # BPR — Financial information (check/payment method)
        elif seg_id == 'BPR' and len(seg) >= 2:
            amount = parse_amount(safe_get(seg, 2))
            check_info['payment_method_code'] = safe_get(seg, 4, '')
            if len(seg) >= 16:
                check_info['payment_date_bpr'] = parse_date(safe_get(seg, 16))

        # TRN — Reassociation trace (check/EFT number)
        elif seg_id == 'TRN' and len(seg) >= 3:
            check_info['check_number'] = safe_get(seg, 2)

        # DTM — Header-level dates
        elif seg_id == 'DTM' and current_payment is None and len(seg) >= 3:
            qual = safe_get(seg, 1)
            if qual == '405':
                check_info['production_date'] = parse_date(safe_get(seg, 2))

        # CLP — Claim payment information (starts a new payment record)
        elif seg_id == 'CLP' and len(seg) >= 5:
            if current_payment:
                payments.append(current_payment)

            status_code = safe_get(seg, 2)
            filing_code = safe_get(seg, 6, '')
            payer_claim_control_number = safe_get(seg, 7, '')
            if status_code and status_code not in CLP_STATUS_MAP:
                summary['unknown_clp_status_codes'].add(status_code)

            current_payment = {
                'payment': {
                    'patient_control_number': safe_get(seg, 1),
                    'claim_status_code': status_code,
                    'claim_status_desc': CLP_STATUS_MAP.get(status_code, ''),
                    'total_charge_amount': parse_amount(safe_get(seg, 3)),
                    'paid_amount': parse_amount(safe_get(seg, 4)),
                    'patient_responsibility': parse_amount(safe_get(seg, 5)),
                    'claim_filing_indicator_code': filing_code,
                    'payer_claim_control_number': payer_claim_control_number,
                    'payer_id': payer_info.get('payer_id', ''),
                    'payer_name': payer_info.get('payer_name', ''),
                    'check_number': check_info.get('check_number', ''),
                    'payment_date': check_info.get('payment_date_bpr'),
                    'payment_method_code': check_info.get('payment_method_code', ''),
                    'file_name': file_name,
                },
                'service_lines': [],
                'adjustments': [],
            }
            current_svc = None

        # CAS — Claim-level adjustments (before any SVC)
        elif seg_id == 'CAS' and current_payment and current_svc is None and len(seg) >= 4:
            for adj in parse_cas_adjustments(seg, summary):
                adj['level'] = 'claim'
                current_payment['adjustments'].append(adj)

        # SVC — Service line payment
        elif seg_id == 'SVC' and current_payment and len(seg) >= 4:
            proc_info = safe_get(seg, 1, '')
            proc_parts = split_composite(proc_info, component_sep)
            procedure_code = proc_parts[1] if len(proc_parts) >= 2 else proc_parts[0]

            current_svc = {
                'procedure_code': procedure_code,
                'modifier_1': proc_parts[2] if len(proc_parts) >= 3 else None,
                'charge_amount': parse_amount(safe_get(seg, 2)),
                'paid_amount': parse_amount(safe_get(seg, 3)),
                'revenue_code': safe_get(seg, 4, None) if len(seg) >= 5 else None,
                'units_paid': parse_amount(safe_get(seg, 5)) if len(seg) >= 6 else None,
                'adjustments': [],
            }
            current_payment['service_lines'].append(current_svc)

        # CAS — Service-level adjustments (after SVC)
        elif seg_id == 'CAS' and current_svc and len(seg) >= 4:
            for adj in parse_cas_adjustments(seg, summary):
                adj['level'] = 'line'
                current_svc['adjustments'].append(adj)

        # DTM — Dates within CLP context
        elif seg_id == 'DTM' and current_payment and len(seg) >= 3:
            qual = safe_get(seg, 1)
            date_val = parse_date(safe_get(seg, 2))
            if safe_get(seg, 2) and date_val is None:
                summary['invalid_dates'] += 1
            if qual == '573' or qual == '050':
                current_payment['payment']['payment_date'] = date_val or current_payment['payment'].get('payment_date')
            elif qual == '232':
                current_payment['payment']['statement_start'] = date_val
            elif qual == '233':
                current_payment['payment']['statement_end'] = date_val

        # NM1*QC — Patient name
        elif seg_id == 'NM1' and safe_get(seg, 1) == 'QC' and current_payment and len(seg) >= 4:
            current_payment['payment']['patient_last_name'] = safe_get(seg, 3)
            current_payment['payment']['patient_first_name'] = safe_get(seg, 4)

    # Don't forget the last payment
    if current_payment:
        payments.append(current_payment)

    parse_summary = {
        'warnings': summary['warnings'],
        'unknown_adjustment_groups': sorted(summary['unknown_adjustment_groups']),
        'unknown_carc_codes': sorted(summary['unknown_carc_codes']),
        'unknown_clp_status_codes': sorted(summary['unknown_clp_status_codes']),
        'invalid_dates': summary['invalid_dates'],
    }

    return payments, parse_summary


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def parse_835_file(file_path):
    """Parse a single 835 file and return structured data."""
    file_name = os.path.basename(file_path)
    segments, delimiters = parse_edi_file(file_path)
    component_sep = delimiters.get('component', ':')

    with open(file_path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    payments, parse_summary = extract_payments(segments, file_name, component_sep)

    return {
        'file_name': file_name,
        'file_type': '835',
        'file_hash': file_hash,
        'record_count': len(payments),
        'parse_summary': {
            **parse_summary,
            'segment_delimiter': delimiters.get('segment'),
            'element_delimiter': delimiters.get('element'),
            'component_delimiter': delimiters.get('component'),
        },
        'payments': payments,
    }


def parse_folder(folder_path):
    """Parse all 835 files in a folder."""
    results = []
    for fname in os.listdir(folder_path):
        if fname.upper().endswith(('.TXT', '.EDI', '.835', '.X12')):
            fpath = os.path.join(folder_path, fname)
            try:
                result = parse_835_file(fpath)
                results.append(result)
                print(f"Parsed {fname}: {result['record_count']} payment records")
            except Exception as e:
                print(f"Error parsing {fname}: {e}")
                results.append({
                    'file_name': fname,
                    'file_type': '835',
                    'error': str(e),
                    'payments': [],
                })
    return results


def main():
    parser = argparse.ArgumentParser(description='Parse 835 EDI remittance files')
    parser.add_argument('input', help='Input file or folder path')
    parser.add_argument('--output', '-o', help='Output JSON file path', default=None)
    args = parser.parse_args()

    if os.path.isdir(args.input):
        results = parse_folder(args.input)
    elif os.path.isfile(args.input):
        results = [parse_835_file(args.input)]
    else:
        print(f"Error: {args.input} not found")
        sys.exit(1)

    output_path = args.output or 'parsed_835_output.json'
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    total = sum(r.get('record_count', 0) for r in results)
    print(f"\nTotal: {len(results)} files, {total} payment records -> {output_path}")


if __name__ == '__main__':
    main()
