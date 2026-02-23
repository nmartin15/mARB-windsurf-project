# Database Migrations

## Canonical Schema

This project uses a single canonical schema approach instead of incremental migrations.

### Active Migrations

| File | Description |
|------|-------------|
| `00001_canonical_schema.sql` | Complete database schema — all tables, indexes, RLS policies, and grants |
| `00002_rpc_functions.sql` | All RPC functions used by the dashboard and reports |
| `20260221_01_add_claim_payment_matching_fields.sql` | Additive 835/837 claim matching audit columns for `claim_payments` |
| `20260221_02_pipeline_safe_index_hardening.sql` | Additive index hardening for pipeline upserts, matching, and dashboard date joins |
| `20260221_03_pipeline_preflight_audit.sql` | Read-only preflight checks for duplicates, orphans, matching ambiguity, and quality signals |
| `20260221_04_guarded_natural_key_uniqueness.sql` | Conditional uniqueness enforcement for loader natural keys (skips when duplicates exist) |

### How to Apply

1. Open Supabase Dashboard > SQL Editor
2. Run `00001_canonical_schema.sql` first
3. Run `00002_rpc_functions.sql` second
4. Run any dated additive migrations in timestamp order

### Preflight Audit (Read-Only)

- Execute `20260221_03_pipeline_preflight_audit.sql` before any strict uniqueness rollout.
- For cleanup logic, sequencing, and re-run criteria, use `PHASE1B_RUNBOOK.md` as the single operational source of truth.

## Migration Policy (Pipeline Compatibility)

- Keep `00001_canonical_schema.sql` and `00002_rpc_functions.sql` as the canonical baseline.
- Use dated migrations for forward-only, additive changes (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Do not rename or drop schema objects that are consumed by:
  - `scripts/load_to_supabase.py`
  - `scripts/claim_matching.py`
  - dashboard/report RPCs in `00002_rpc_functions.sql`
- If a breaking change is required, introduce a compatibility layer first (for example, `*_v2` RPC functions or bridge views), migrate callers, then deprecate old objects.

### Archived Migrations

The `archived_migrations/` folder contains 76+ legacy migrations that were consolidated into the canonical schema. They are kept for reference only and should not be applied.
