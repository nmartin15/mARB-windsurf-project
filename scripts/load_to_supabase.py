"""
mARB Health — Supabase Data Loader

Loads parsed EDI JSON output (from parse_837p.py, parse_835.py) into the
normalized Supabase database tables. Handles upsert logic and 835/837 matching.

Usage:
    python load_to_supabase.py <json_file> --type 837P|835 [--org-id <id>]

Prerequisites:
    pip install supabase python-dotenv
    Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
"""

import os
import sys
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
from claim_matching import match_claim_header
from pipeline_models import MATCH_STRATEGY_KEYS
from loader_persistence import (
    build_optional_payment_fields,
    clear_claim_children,
    clear_payment_children,
    upsert_claim_header,
    upsert_claim_payment,
)

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = (
    os.getenv('SUPABASE_SERVICE_KEY')
    or os.getenv('SUPABASE_ANON_KEY')
    or os.getenv('VITE_SUPABASE_ANON_KEY')
)
ML_MODEL_PATH = os.getenv('CLAIM_ACCEPTANCE_MODEL_PATH', 'models/claim_acceptance_model.joblib')


def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(
            "Error: Supabase credentials are required "
            "(SUPABASE_URL/SUPABASE_SERVICE_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)"
        )
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# 837 Loader
# ---------------------------------------------------------------------------

def load_837_file(client, file_data, org_id=None):
    """Load a parsed 837P/837I file into the database."""
    file_name = file_data['file_name']
    file_type = file_data['file_type']
    file_hash = file_data.get('file_hash', '')
    record_count = file_data.get('record_count', 0)

    # Check for duplicate file
    existing = client.table('edi_file_log').select('id').eq('file_hash', file_hash).execute()
    if existing.data:
        print(f"  Skipping {file_name} — already processed (hash match)")
        return {'skipped': True, 'reason': 'duplicate'}

    # Log the file
    file_log = client.table('edi_file_log').insert({
        'org_id': org_id,
        'file_name': file_name,
        'file_type': file_type,
        'file_hash': file_hash,
        'record_count': record_count,
        'status': 'processing',
    }).execute()
    file_log_id = file_log.data[0]['id'] if file_log.data else None

    loaded = 0
    errors = []
    loaded_claim_ids = []

    for claim_data in file_data.get('claims', []):
        try:
            claim_header_id = _load_single_claim(client, claim_data, org_id)
            loaded_claim_ids.append(claim_header_id)
            loaded += 1
        except Exception as e:
            errors.append(f"Claim {claim_data.get('claim', {}).get('claim_id', '?')}: {e}")

    # Optional ML scoring: if no model exists (common in early setups), skip quietly.
    try:
        _score_loaded_claims(client, loaded_claim_ids)
    except Exception as e:
        print(f"  Warning: claim scoring failed: {e}")

    # Update file log status
    status = 'processed' if not errors else 'processed'
    error_msg = '; '.join(errors[:5]) if errors else None
    if file_log_id:
        client.table('edi_file_log').update({
            'status': status,
            'error_message': error_msg,
        }).eq('id', file_log_id).execute()

    return {
        'loaded': loaded,
        'errors': errors,
        'quality': {
            'warnings': len(file_data.get('parse_summary', {}).get('warnings', [])),
            'invalid_dates': file_data.get('parse_summary', {}).get('invalid_dates', 0),
        },
    }


def _load_single_claim(client, claim_data, org_id):
    """Insert a single claim with all related records."""
    claim = claim_data['claim']
    claim['org_id'] = org_id

    claim_payload = {
        'org_id': org_id,
        'claim_id': claim.get('claim_id', ''),
        'claim_type': claim.get('claim_type', 'professional'),
        'file_name': claim.get('file_name'),
        'file_type': claim.get('file_type'),
        'total_charge_amount': _to_decimal(claim.get('total_charge_amount')),
        'claim_status': 'submitted',
        'facility_type_code': claim.get('facility_type_code'),
        'facility_type_desc': claim.get('facility_type_desc'),
        'facility_code_qualifier': claim.get('facility_code_qualifier'),
        'claim_frequency_type_code': claim.get('claim_frequency_type_code'),
        'claim_frequency_type_desc': claim.get('claim_frequency_type_desc'),
        'assignment_code': claim.get('assignment_code'),
        'assignment_desc': claim.get('assignment_desc'),
        'benefits_assignment': claim.get('benefits_assignment'),
        'release_of_info_code': claim.get('release_of_info_code'),
        'claim_filing_indicator_code': claim.get('claim_filing_indicator_code'),
        'claim_filing_indicator_desc': claim.get('claim_filing_indicator_desc'),
        'payer_responsibility_code': claim.get('payer_responsibility_code'),
        'payer_responsibility_desc': claim.get('payer_responsibility_desc'),
        'payer_id': claim.get('payer_id'),
        'payer_name': claim.get('payer_name'),
        'prior_auth_number': claim.get('prior_auth_number'),
        'prior_auth_status': claim.get('prior_auth_status', 'none'),
    }
    header_id, is_existing_header = upsert_claim_header(client, claim_payload)

    # Idempotent reload behavior: replace claim children when header already exists.
    if is_existing_header:
        clear_claim_children(client, header_id)

    # Insert claim lines
    line_id_map = {}
    for line in claim_data.get('lines', []):
        line_result = client.table('claim_lines').insert({
            'claim_header_id': header_id,
            'line_number': line.get('line_number', 1),
            'procedure_code': line.get('procedure_code'),
            'procedure_qualifier': line.get('procedure_qualifier'),
            'modifier_1': line.get('modifier_1'),
            'modifier_2': line.get('modifier_2'),
            'modifier_3': line.get('modifier_3'),
            'modifier_4': line.get('modifier_4'),
            'revenue_code': line.get('revenue_code'),
            'charge_amount': _to_decimal(line.get('charge_amount')),
            'unit_count': _to_decimal(line.get('unit_count')),
            'unit_measurement_code': line.get('unit_measurement_code'),
            'place_of_service_code': line.get('place_of_service_code'),
        }).execute()
        if line_result.data:
            line_id_map[line.get('line_number', 1)] = line_result.data[0]['id']

    # Insert diagnoses
    for dx in claim_data.get('diagnoses', []):
        client.table('claim_diagnoses').insert({
            'claim_header_id': header_id,
            'diagnosis_code': dx.get('diagnosis_code', ''),
            'diagnosis_type': dx.get('diagnosis_type', 'other'),
            'code_qualifier': dx.get('code_qualifier'),
            'sequence_number': dx.get('sequence_number', 1),
        }).execute()

    # Insert header-level dates
    for dt in claim_data.get('dates_header', []):
        client.table('claim_dates').insert({
            'claim_header_id': header_id,
            'date_qualifier': dt.get('date_qualifier', ''),
            'date_qualifier_desc': dt.get('date_qualifier_desc'),
            'date_format_qualifier': dt.get('date_format_qualifier'),
            'date_value': dt.get('date_value', ''),
            'parsed_date': dt.get('parsed_date'),
        }).execute()

    # Insert line-level dates
    for dt in claim_data.get('dates_line', []):
        line_id = line_id_map.get(dt.get('line_number'))
        client.table('claim_dates').insert({
            'claim_header_id': header_id,
            'claim_line_id': line_id,
            'date_qualifier': dt.get('date_qualifier', ''),
            'date_qualifier_desc': dt.get('date_qualifier_desc'),
            'date_format_qualifier': dt.get('date_format_qualifier'),
            'date_value': dt.get('date_value', ''),
            'parsed_date': dt.get('parsed_date'),
        }).execute()

    # Insert providers
    for prov in claim_data.get('providers', []):
        client.table('claim_providers').insert({
            'claim_header_id': header_id,
            'provider_role': prov.get('provider_role', 'other'),
            'entity_identifier_code': prov.get('entity_identifier_code'),
            'entity_type_qualifier': prov.get('entity_type_qualifier'),
            'npi': prov.get('npi'),
            'tax_id': prov.get('tax_id'),
            'id_code_qualifier': prov.get('id_code_qualifier'),
            'last_or_org_name': prov.get('last_or_org_name'),
            'first_name': prov.get('first_name'),
            'middle_name': prov.get('middle_name'),
            'taxonomy_code': prov.get('taxonomy_code'),
        }).execute()

    # Insert references
    for ref in claim_data.get('references', []):
        client.table('claim_references').insert({
            'claim_header_id': header_id,
            'reference_qualifier': ref.get('reference_qualifier', ''),
            'reference_qualifier_desc': ref.get('reference_qualifier_desc'),
            'reference_value': ref.get('reference_value'),
        }).execute()

    return header_id


# ---------------------------------------------------------------------------
# 835 Loader
# ---------------------------------------------------------------------------

def load_835_file(client, file_data, org_id=None):
    """Load a parsed 835 file into the database."""
    file_name = file_data['file_name']
    file_hash = file_data.get('file_hash', '')
    record_count = file_data.get('record_count', 0)

    # Check for duplicate
    existing = client.table('edi_file_log').select('id').eq('file_hash', file_hash).execute()
    if existing.data:
        print(f"  Skipping {file_name} — already processed (hash match)")
        return {'skipped': True, 'reason': 'duplicate'}

    file_log = client.table('edi_file_log').insert({
        'org_id': org_id,
        'file_name': file_name,
        'file_type': '835',
        'file_hash': file_hash,
        'record_count': record_count,
        'status': 'processing',
    }).execute()
    file_log_id = file_log.data[0]['id'] if file_log.data else None

    loaded = 0
    errors = []
    matched_counts = {key: 0 for key in MATCH_STRATEGY_KEYS}
    recon = {
        'total_charge_amount': 0.0,
        'total_paid_amount': 0.0,
        'total_adjustment_amount': 0.0,
    }

    for payment_data in file_data.get('payments', []):
        try:
            payment_result = _load_single_payment(client, payment_data, org_id)
            loaded += 1
            strategy = payment_result.get('match_strategy', 'unmatched')
            matched_counts[strategy] = matched_counts.get(strategy, 0) + 1
            recon['total_charge_amount'] += payment_result.get('charge_amount', 0.0)
            recon['total_paid_amount'] += payment_result.get('paid_amount', 0.0)
            recon['total_adjustment_amount'] += payment_result.get('adjustment_amount', 0.0)
        except Exception as e:
            pcn = payment_data.get('payment', {}).get('patient_control_number', '?')
            errors.append(f"Payment {pcn}: {e}")

    if file_log_id:
        client.table('edi_file_log').update({
            'status': 'processed',
            'error_message': '; '.join(errors[:5]) if errors else None,
        }).eq('id', file_log_id).execute()

    return {
        'loaded': loaded,
        'errors': errors,
        'match_summary': matched_counts,
        'reconciliation': recon,
        'quality': {
            'warnings': len(file_data.get('parse_summary', {}).get('warnings', [])),
            'invalid_dates': file_data.get('parse_summary', {}).get('invalid_dates', 0),
            'unknown_adjustment_groups': len(file_data.get('parse_summary', {}).get('unknown_adjustment_groups', [])),
            'unknown_carc_codes': len(file_data.get('parse_summary', {}).get('unknown_carc_codes', [])),
        },
    }


def _load_single_payment(client, payment_data, org_id):
    """Insert a single payment record with service lines and adjustments."""
    pmt = payment_data['payment']
    pcn = pmt.get('patient_control_number', '')
    payer_claim_control_number = pmt.get('payer_claim_control_number', '')
    total_adjustment_amount = 0.0

    # Try to match to an existing claim using multiple strategies.
    match_result = match_claim_header(
        client,
        pcn,
        payer_claim_control_number,
    )
    claim_header_id = match_result.claim_header_id
    match_strategy = match_result.strategy
    match_reason_code = match_result.reason_code

    # If matched, update the claim header with payment info
    if claim_header_id:
        paid = _to_decimal(pmt.get('paid_amount'))
        status = 'denied' if pmt.get('claim_status_code') == '4' else 'paid' if paid and paid > 0 else 'partial'
        client.table('claim_headers').update({
            'paid_amount': paid,
            'patient_responsibility': _to_decimal(pmt.get('patient_responsibility')),
            'claim_status': status,
        }).eq('id', claim_header_id).execute()
    else:
        strategy_label = match_strategy or 'unmatched'
        print(
            f"  Warning: could not match 835 payment "
            f"(CLP01={pcn or 'empty'}, CLP07={payer_claim_control_number or 'empty'}) "
            f"using strategy={strategy_label}"
        )

    payment_payload = {
        'claim_header_id': claim_header_id,
        'org_id': org_id,
        'file_name': pmt.get('file_name'),
        'patient_control_number': pcn,
        'claim_status_code': pmt.get('claim_status_code'),
        'claim_status_desc': pmt.get('claim_status_desc'),
        'total_charge_amount': _to_decimal(pmt.get('total_charge_amount')),
        'paid_amount': _to_decimal(pmt.get('paid_amount')),
        'patient_responsibility': _to_decimal(pmt.get('patient_responsibility')),
        'payer_id': pmt.get('payer_id'),
        'payer_name': pmt.get('payer_name'),
        'check_number': pmt.get('check_number'),
        'payment_date': pmt.get('payment_date'),
        'payment_method_code': pmt.get('payment_method_code'),
        'claim_filing_indicator_code': pmt.get('claim_filing_indicator_code'),
        **build_optional_payment_fields(
            client,
            payer_claim_control_number=payer_claim_control_number,
            match_strategy=match_strategy,
            match_reason_code=match_reason_code,
        ),
    }
    payment_id, is_existing_payment = upsert_claim_payment(client, payment_payload)

    if is_existing_payment:
        clear_payment_children(client, payment_id)

    # Insert claim-level adjustments
    for adj in payment_data.get('adjustments', []):
        adj_amount = _to_decimal(adj.get('adjustment_amount'))
        if adj_amount is not None:
            total_adjustment_amount += adj_amount
        client.table('claim_adjustments').insert({
            'claim_payment_id': payment_id,
            'adjustment_group_code': adj.get('adjustment_group_code', 'OA'),
            'adjustment_group_desc': adj.get('adjustment_group_desc'),
            'carc_code': adj.get('carc_code', ''),
            'carc_description': adj.get('carc_description'),
            'adjustment_amount': adj_amount,
            'adjustment_quantity': adj.get('adjustment_quantity'),
        }).execute()

    # Insert service lines and their adjustments
    for svc in payment_data.get('service_lines', []):
        svc_result = client.table('claim_payment_lines').insert({
            'claim_payment_id': payment_id,
            'procedure_code': svc.get('procedure_code'),
            'modifier_1': svc.get('modifier_1'),
            'charge_amount': _to_decimal(svc.get('charge_amount')),
            'paid_amount': _to_decimal(svc.get('paid_amount')),
            'revenue_code': svc.get('revenue_code'),
            'units_paid': _to_decimal(svc.get('units_paid')),
        }).execute()

        svc_line_id = svc_result.data[0]['id'] if svc_result.data else None

        for adj in svc.get('adjustments', []):
            adj_amount = _to_decimal(adj.get('adjustment_amount'))
            if adj_amount is not None:
                total_adjustment_amount += adj_amount
            client.table('claim_adjustments').insert({
                'claim_payment_id': payment_id,
                'claim_payment_line_id': svc_line_id,
                'adjustment_group_code': adj.get('adjustment_group_code', 'OA'),
                'adjustment_group_desc': adj.get('adjustment_group_desc'),
                'carc_code': adj.get('carc_code', ''),
                'carc_description': adj.get('carc_description'),
                'adjustment_amount': adj_amount,
                'adjustment_quantity': adj.get('adjustment_quantity'),
            }).execute()

    return {
        'match_strategy': match_strategy or 'unmatched',
        'match_reason_code': match_reason_code,
        'charge_amount': _to_decimal(pmt.get('total_charge_amount')) or 0.0,
        'paid_amount': _to_decimal(pmt.get('paid_amount')) or 0.0,
        'adjustment_amount': total_adjustment_amount,
    }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _to_decimal(value):
    """Convert a value to float for database insertion."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _score_loaded_claims(client, claim_header_ids):
    if not claim_header_ids:
        return
    if not Path(ML_MODEL_PATH).exists():
        return

    from score_claims import score_claim_ids

    total = score_claim_ids(
        client,
        claim_header_ids=[int(cid) for cid in claim_header_ids],
        model_path=ML_MODEL_PATH,
    )
    if total:
        print(f"  Scored {total} claim(s) with model: {ML_MODEL_PATH}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Load parsed EDI data into Supabase')
    parser.add_argument('json_file', help='Path to parsed JSON output file')
    parser.add_argument('--type', required=True, choices=['837P', '837I', '835'],
                        help='EDI file type')
    parser.add_argument('--org-id', type=int, default=None,
                        help='Organization ID for multi-tenancy')
    args = parser.parse_args()

    with open(args.json_file, 'r') as f:
        data = json.load(f)

    client = get_client()

    if not isinstance(data, list):
        data = [data]

    total_loaded = 0
    total_errors = []
    aggregate_match = {key: 0 for key in MATCH_STRATEGY_KEYS}
    aggregate_recon = {
        'total_charge_amount': 0.0,
        'total_paid_amount': 0.0,
        'total_adjustment_amount': 0.0,
    }
    aggregate_quality = {
        'warnings': 0,
        'invalid_dates': 0,
        'unknown_adjustment_groups': 0,
        'unknown_carc_codes': 0,
    }

    for file_data in data:
        print(f"Loading {file_data.get('file_name', 'unknown')}...")

        if args.type in ('837P', '837I'):
            result = load_837_file(client, file_data, args.org_id)
        else:
            result = load_835_file(client, file_data, args.org_id)

        if result.get('skipped'):
            print(f"  Skipped: {result.get('reason')}")
        else:
            total_loaded += result.get('loaded', 0)
            total_errors.extend(result.get('errors', []))
            print(f"  Loaded: {result.get('loaded', 0)} records")
            quality = result.get('quality', {})
            for key in aggregate_quality:
                aggregate_quality[key] += quality.get(key, 0)

            if args.type == '835':
                for key in aggregate_match:
                    aggregate_match[key] += result.get('match_summary', {}).get(key, 0)
                recon = result.get('reconciliation', {})
                for key in aggregate_recon:
                    aggregate_recon[key] += recon.get(key, 0.0)

    print(f"\nDone. Total loaded: {total_loaded}, Errors: {len(total_errors)}")
    print(
        "Quality summary: "
        f"warnings={aggregate_quality['warnings']}, "
        f"invalid_dates={aggregate_quality['invalid_dates']}, "
        f"unknown_adjustment_groups={aggregate_quality['unknown_adjustment_groups']}, "
        f"unknown_carc_codes={aggregate_quality['unknown_carc_codes']}"
    )
    if args.type == '835':
        print(
            "Match summary: "
            f"clp01={aggregate_match['clp01']}, "
            f"clp07_original_claim_id={aggregate_match['clp07_original_claim_id']}, "
            f"clp07_ref={aggregate_match['clp07_ref']}, "
            f"unmatched={aggregate_match['unmatched']}"
        )
        print(
            "Reconciliation summary: "
            f"charged={aggregate_recon['total_charge_amount']:.2f}, "
            f"paid={aggregate_recon['total_paid_amount']:.2f}, "
            f"adjustments={aggregate_recon['total_adjustment_amount']:.2f}"
        )
    if total_errors:
        print("Errors:")
        for err in total_errors[:10]:
            print(f"  - {err}")


if __name__ == '__main__':
    main()
