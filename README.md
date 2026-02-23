# mARB Health

Revenue Cycle Management (RCM) analytics platform for healthcare providers. Processes real EDI 837/835 claim and remittance data to provide actionable insights on payment velocity, denial patterns, revenue leakage, and accounts receivable aging.

## Start Here

- `docs/837_JOURNEY_SPEC.md` — single source of truth for the 837 -> parser -> DB -> frontend journey.
- `docs/EDI_PARSING_CONTRACT.md` — parser/loader contract rules and failure semantics.

## Target Market

**v1:** Physician practices and clinics (CMS-1500 / 837P professional claims)
**Roadmap:** Scalable to hospitals and health systems (UB-04 / 837I institutional claims)

## Architecture

```
EDI Files (from clearinghouses)
    ├── 837P (Professional Claims)
    ├── 837I (Institutional Claims)
    └── 835  (Remittance Advice / Payments)
            │
            ▼
    Python EDI Parsers (scripts/)
            │
            ▼
    Supabase / PostgreSQL
            │
            ▼
    React Dashboard (src/)
        ├── Claims Explorer
        ├── Payment Velocity
        ├── A/R Aging
        ├── Denial Analysis
        ├── Payer Performance
        ├── Revenue Leakage
        ├── Clean Claim Rate
        └── Dispute Messaging
```

## Data Flow

1. EDI files arrive from clearinghouses (Availity, Optum, WayStar, etc.)
2. Files are uploaded through the web UI (v1) or ingested via API (future)
3. Python parsers extract structured data from raw EDI segments
4. Data is loaded into the normalized PostgreSQL schema via Supabase
5. React dashboard queries the data through Supabase RPCs and direct queries

For the strict operational journey and quality gates, see `docs/837_JOURNEY_SPEC.md`.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Recharts, TanStack Table
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **EDI Processing:** Python 3, Pandas
- **Export:** ExcelJS (.xlsx), jsPDF (.pdf), CSV

## Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- Supabase account (or local Supabase via Docker)

### Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Your Supabase anonymous key

### Install & Run

```bash
# Frontend
npm install
npm run dev

# Python EDI parsers
pip install -r requirements.txt
```

### Database Setup

Apply the canonical schema to your Supabase project:

1. Go to Supabase Dashboard > SQL Editor
2. Run `supabase/migrations/00001_canonical_schema.sql`
3. Run `supabase/migrations/00002_rpc_functions.sql`

## Testing (Backend/Data)

Run Python backend/data tests:

```bash
# All non-DB unit tests
pytest -m "not db and not integration"

# DB-backed tests (requires DATABASE_URL)
export DATABASE_URL=postgresql://user:pass@localhost:5432/marb_health_test
pytest -m "db or integration" -v

# Full suite with coverage for pipeline scripts
pytest --cov=scripts --cov-report=term-missing
```

## Demo Runbook (837 Journey)

Use the journey runner to validate the complete 837 -> parser -> DB -> frontend data path.

### Quick local journey (no DB load required)

```bash
python scripts/run_837_demo_journey.py --claims 250 --days 10
```

### Strict journey (required for full demo sign-off)

This mode fails unless migrations, DB load, and related journey checks can run.

```bash
python scripts/run_837_demo_journey.py --claims 250 --days 10 --apply-migrations --load-db --require-db-load
```

Prerequisites for strict mode:
- `DATABASE_URL` set to a PostgreSQL connection string with DDL privileges
- `.env` contains Supabase credentials used by loader/scoring scripts

Run output:
- A timestamped folder under `test_data/demo_journey/`
- `journey_report.json` with pass/fail status, parse/load/scoring summaries, and model metrics

## Project Structure

```
├── src/
│   ├── pages/           # Route-level components
│   ├── components/      # Reusable UI components
│   │   ├── charts/      # Chart components
│   │   ├── messaging/   # Dispute messaging system
│   │   ├── reports/     # Report components
│   │   └── ui/          # Generic UI elements
│   ├── lib/             # Supabase client setup
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Shared utilities
├── scripts/             # Python EDI parsers and data loaders
├── supabase/
│   └── migrations/      # Canonical database schema
├── docs/                # Architecture and EDI documentation
└── public/              # Static assets
```

## Recent Updates (Real EDI Compatibility)

Dashboard and database have been updated for **real EDI data** (not synthetic):

- All dashboard components filter for real EDI (`file_name IS NOT NULL`).
- RPCs `get_payment_velocity(period)` and `get_trend_data(period)` use `claim_header_dates` and EDI date format (CCYYMMDD).
- Normalized tables: `claim_lines`, `claim_diagnoses`, `claim_header_dates`, `claim_line_dates`, `claim_providers`, `claim_provider_taxonomy`.
- IDs are VARCHAR to match EDI output. See `docs/ARCHITECTURE.md` and `docs/EDI_PARSING_CONTRACT.md` for the current compatibility and schema contract details.

## Key Concepts

- **837P:** Professional claim (physician/clinic), maps to CMS-1500 form
- **837I:** Institutional claim (hospital), maps to UB-04 form
- **835:** Electronic Remittance Advice — payment and denial information from payers
- **CARC:** Claim Adjustment Reason Code — why an adjustment was made
- **RARC:** Remittance Advice Remark Code — additional context for adjustments
- **Clearinghouse:** Intermediary that routes claims between providers and payers

## License

Proprietary — All rights reserved.
