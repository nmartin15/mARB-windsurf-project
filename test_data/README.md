# Synthetic EDI Test Data

Raw EDI X12 5010 files — continuous stream format, no line breaks between segments.  
Delimiters: `*` element, `:` component, `~` segment terminator.  
ISA segments are fixed 106 characters.

## Volume

**150 claims** across 5 business days (Mon–Fri, Jan 13–17 2025).  
~30 claims per day — realistic for a 2–3 provider primary care practice.

## Files

| File | Type | Records | Notes |
|------|------|---------|-------|
| `837P_batch_001.txt` | 837P | 30 claims | Monday batch |
| `837P_batch_002.txt` | 837P | 30 claims | Tuesday batch |
| `837P_batch_003.txt` | 837P | 30 claims | Wednesday batch |
| `837P_batch_004.txt` | 837P | 30 claims | Thursday batch |
| `837P_batch_005.txt` | 837P | 30 claims | Friday batch |
| `835_remit_001.txt` | 835 | 20 payments | Palmetto GBA (Medicare) |
| `835_remit_002.txt` | 835 | 38 payments | BCBS of Tennessee |
| `835_remit_003.txt` | 835 | 25 payments | United Healthcare |
| `835_remit_004.txt` | 835 | 17 payments | Cigna |
| `835_remit_005.txt` | 835 | 25 payments | Aetna |
| `835_remit_006.txt` | 835 | 10 payments | Humana |
| `835_remit_007.txt` | 835 | 9 payments | Ambetter TN |
| `835_remit_008.txt` | 835 | 6 payments | TRICARE |

## Payer Mix

| Payer | Claims | % | Filing |
|-------|--------|---|--------|
| BCBS of Tennessee | ~38 | 25% | BL |
| United Healthcare | ~25 | 18% | CI |
| Medicare (Palmetto GBA) | ~20 | 15% | MC |
| Aetna | ~25 | 12% | CI |
| Cigna | ~17 | 10% | CI |
| Humana | ~10 | 10% | HM |
| Ambetter TN | ~9 | 5% | HM |
| TRICARE | ~6 | 5% | CH |

## Provider Organizations (3)

- Nashville Primary Care PLLC (NPI 1234567890)
- Midtown Family Medicine (NPI 2345678901)
- Cumberland Orthopedic Assoc (NPI 3456789012)

## Rendering Providers (5)

- Thompson, Rachel L — Family Medicine
- Patel, Anisha K — Endocrinology
- Garcia, Marcus D — Family Medicine
- Kim, Jenny S — Cardiology
- Abrams, Daniel T — Orthopedics

## Visit Types & CPT Mix

| Visit Type | Weight | Example CPTs |
|------------|--------|-------------|
| Simple office visit (99213) | 30% | 99213 ± add-ons |
| Moderate office visit (99214) | 25% | 99214 ± add-ons |
| Complex office visit (99215) | 10% | 99215 ± labs/EKG |
| Wellness/preventive (99395-96) | 12% | 99395, 99396 |
| Injection procedure | 8% | 99214 + 20610 |
| Urgent/injury visit | 5% | 99214 + imaging |
| Chronic care mgmt (99490) | 5% | 99490 |
| Behavioral health | 5% | 99214 + 96127 + 90834 |

Add-on pool: 87880, 36415, 85025, 80053, 83036, 80061, 93000, 94010, 96372, 71046, etc.

## Claim Outcomes

| Outcome | Count | % |
|---------|-------|---|
| Paid | 124 | 83% |
| Full Denial | 14 | 9% |
| Partial Denial | 12 | 8% |

### Denial Reason Codes
- **CO-197**: Precertification/authorization absent (~5% rate)
- **CO-16**: Lack of information needed for adjudication (~3%)
- **CO-18**: Duplicate claim (~2%)
- **CO-50**: Non-covered services (~2%)
- **CO-29**: Timely filing expired (~1%)
- **OA-23**: Charges included in another service (partial denials)

### Adjustment Codes on Paid Claims
- **CO-45**: Contractual obligation (on virtually all paid claims)
- **PR-1**: Deductible
- **PR-2**: Coinsurance
- **PR-3**: Copayment

## Other Data Features
- ~12% of claims carry prior authorization numbers (REF*G1)
- Onset dates (DTP*439) on injury/procedure visits
- Initial treatment dates (DTP*454) on chronic care claims
- Modifier 25 on E&M with same-day procedures
- 1–6 service lines per claim, 1–5 diagnosis codes
- 60 unique last names, 30 male + 30 female first names
- 14 TN cities, varied street addresses

## Regenerating

```bash
python scripts/generate_test_edi.py --claims 150 --days 5 --outdir test_data
```

Increase volume for load testing:
```bash
python scripts/generate_test_edi.py --claims 500 --days 20 --outdir test_data_large
```

## Running Parsers

```bash
python scripts/parse_837p.py test_data/ -o test_data/parsed_837p_all.json
python scripts/parse_835.py test_data/ -o test_data/parsed_835_all.json
```
