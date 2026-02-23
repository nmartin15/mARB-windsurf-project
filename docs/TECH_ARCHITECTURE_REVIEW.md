# Tech Architecture Review — mARB Health

This document reviews the current technology choices for the RCM analytics platform and when they are (or aren’t) the right fit.

---

## Current Stack Summary

| Layer | Choice | Role |
|-------|--------|------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind, Recharts, TanStack Table | SPA dashboard, charts, claims list, messaging |
| **Backend** | Supabase (PostgreSQL + PostgREST + Auth + Storage) | Database, API, auth, file storage |
| **Client–server** | Direct: browser → Supabase with anon key | No separate API server |
| **EDI** | Python 3 + Pandas (script in `scripts/`) | Parse 837/835 → DataFrames (no DB insert in repo) |
| **Data load** | DataImport (CSV/Excel via UI) + implied Python → ? | No automated EDI → DB pipeline in repo |

---

## What’s Working Well

1. **React + TypeScript + Vite** — Solid, standard choice for a dashboard; good DX and ecosystem.
2. **PostgreSQL** — Right fit for relational claims data, reporting, and RPCs (payment velocity, trend data).
3. **Supabase Auth** — You use it for login and messaging (e.g. `auth.uid()` in RLS for threads). Fits the product.
4. **Python for EDI** — Parsing 837/835 is string/segment-heavy; Python + Pandas is a reasonable choice; can stay as a separate pipeline.
5. **Schema intent** — Normalized claim headers/lines/dates/diagnoses and org-scoped design in the canonical migration are good for multi-tenant RCM.

So the **direction** (Postgres, React, Python for EDI) is sound. The main questions are **how** you use Supabase and **how** you handle PHI and production safety.

---

## Concerns

### 1. No backend API — browser talks directly to Supabase

- **Current:** All data access is from the SPA via `@supabase/supabase-js` (anon key in the client).
- **Implications:**
  - Every table/column you expose to PostgREST is visible to anyone who can use the anon key (e.g. from built JS).
  - You rely entirely on RLS for security. Misconfiguration (e.g. permissive policies) = data leak.
  - Harder to add central audit logging, rate limiting, or request validation.
- **For healthcare/PHI:** Many teams prefer an API layer (Node, Python, etc.) so the DB is never directly exposed and access is easier to audit and lock down.

**Verdict:** Acceptable for internal/MVP if RLS is strict and anon is not used for PHI in production. For HIPAA or external customers, a backend API in front of Postgres is the safer long-term choice.

---

### 2. RLS and anon access on claim data

In `00001_canonical_schema.sql`:

- Authenticated users can read/insert/update **all** claim data (`USING (true)`). There is no `org_id` (or similar) filter in RLS, so multi-tenant isolation is only “in app layer for now.”
- **Anon** is explicitly granted SELECT on claim tables (“Also allow anon read for development”):

  ```sql
  CREATE POLICY "Anon read claims" ON claim_headers FOR SELECT TO anon USING (true);
  ```

- If the frontend is ever used without login (or with anon key in production), **anyone with the anon key can read all claims** (including PHI).

**Verdict:** For any production or PHI scenario, remove anon read on claim tables and add RLS that restricts by `org_id` (or equivalent) so tenants only see their own data.

---

### 3. Schema split: canonical vs. app and RPCs

- **Canonical migrations** (`00001`, `00002`): Define `claim_headers`, `claim_lines`, `claim_dates`, etc. (no `healthcare_claims`).
- **App and docs:** Dashboard and components query **`healthcare_claims`** and RPCs like `get_payment_velocity` / `get_trend_data`. Those RPCs and the `healthcare_claims` table live only in **archived** migrations.
- So you have two possible states:
  - **A:** Project where archived migrations were applied → `healthcare_claims` exists and app works.
  - **B:** New project with only 00001/00002 → no `healthcare_claims`, no those RPCs → app would break.

**Verdict:** You need a single source of truth: either (1) canonical = `healthcare_claims` + current RPCs (and 00001 becomes the “legacy” or is updated to add them), or (2) canonical = normalized `claim_headers`/… and you migrate the app and RPCs to use that schema and retire `healthcare_claims`. Right now the architecture is inconsistent.

---

### 4. EDI → database pipeline is undefined

- README: “Python parsers extract structured data” → “Data is loaded into … PostgreSQL via Supabase.”
- In the repo: Python script produces DataFrames; there is **no** Supabase/Postgres insert step (no `supabase-py` or direct PG write).
- DataImport is CSV/Excel via UI, not raw EDI.

**Verdict:** The “right” architecture (EDI → Python → DB) is only partially implemented. You need either: a small backend (or script) that takes Python output and writes to Postgres (e.g. via Supabase client or `psycopg2`), or a documented manual step (e.g. export CSV → DataImport). Until then, EDI ingestion is a gap.

---

### 5. HIPAA / PHI

- Product handles claims and identifiers (patient, provider, payer) → **PHI**.
- Supabase Cloud: BAA availability and HIPAA eligibility are not automatic; you must confirm with Supabase and possibly use specific plans/regions.
- Even with a BAA, exposing anon-key access to PHI (see #2) is not acceptable for HIPAA.

**Verdict:** For HIPAA you need: BAA with Supabase (or another provider), no anon read on PHI, strict RLS (and ideally an API layer), and full audit logging. Current setup is not there yet.

---

## Is Supabase the Right Choice?

**Use Supabase when:**

- You want to move fast with Postgres + Auth + optional Storage and Realtime.
- You’re okay with the client talking to PostgREST and relying on RLS (or you add an API later).
- You’re internal/MVP or you’re willing to lock down RLS and remove anon on PHI and (if needed) add a backend.

**Reconsider or constrain Supabase when:**

- You need **HIPAA** and strict control over PHI: then you need BAA, no anon access to PHI, and likely an API in front of the DB.
- You want **no client–DB direct access** ever: then use Supabase as “Postgres + Auth” only and put all data access behind your own API (Node, Python, etc.).
- You outgrow PostgREST (e.g. complex workflows, heavy server-side logic): then a dedicated backend is natural; Supabase can remain the DB (and Auth if you like).

**Bottom line:** Supabase is a **reasonable** choice for this product **if** you:

1. Treat it as “Postgres + Auth” and either (a) accept direct client access with very strict RLS and no anon on claims, or (b) introduce a backend API and stop exposing claim tables to the client.
2. Resolve the schema split (canonical vs. `healthcare_claims` and RPCs).
3. Add a defined EDI → DB path (script or backend).
4. For HIPAA: get a BAA, remove anon read on PHI, and add audit/compliance controls.

---

## Alternatives (if you step away from Supabase)

- **Postgres + your own API + your own auth**  
  - More work, full control. Use when you need strict compliance or don’t want the client to talk to the DB at all.

- **Postgres on another host (e.g. Neon, RDS) + Supabase Auth only**  
  - Keeps Auth, moves DB and API to your stack. Possible if you want to avoid Supabase for data.

- **Different DB (e.g. SQL Server)**  
  - Only if you have a strong reason (e.g. existing enterprise stack). Postgres is a good fit for this app.

---

## Recommended Next Steps (in order)

1. **Security (immediate)**  
   - Remove anon SELECT on all claim-related tables in production (or use a separate “prod” migration that drops those policies).  
   - Add RLS that filters by `org_id` (or equivalent) so authenticated users only see their org’s data.

2. **Schema consistency**  
   - Decide: one schema to rule them all. Either bring `healthcare_claims` + current RPCs into the canonical migrations and document that, or migrate app and RPCs to `claim_headers`/… and deprecate `healthcare_claims`.

3. **EDI → DB**  
   - Add a small loader (Python script with `supabase-py` or `psycopg2`, or a backend endpoint that accepts parsed JSON/CSV) so the path “EDI file → Python → database” is real and documented.

4. **Compliance (if HIPAA is required)**  
   - Confirm BAA with Supabase (or plan to move PHI behind a compliant backend).  
   - No anon access to PHI; audit logging for access to claims/PHI.

5. **Optional: API layer**  
   - If you want to stop exposing the DB to the client, introduce a thin backend (e.g. Node or Python) that talks to Postgres and Supabase Auth; frontend calls your API only. Supabase can stay as DB + Auth.

---

## Summary

| Question | Answer |
|----------|--------|
| Is the overall direction wrong? | **No.** Postgres + React + Python for EDI is sound. |
| Is Supabase wrong? | **No**, but use it with strict RLS, no anon on PHI, and a clear plan for HIPAA if needed. |
| What’s the main risk? | Anon read on claims (PHI) and no org-scoped RLS. |
| What’s the main gap? | Schema split (canonical vs. `healthcare_claims`/RPCs) and no implemented EDI → DB pipeline. |
| Should you rip out Supabase? | Only if you decide you need an API layer and don’t want the client to touch the DB at all, or if Supabase can’t meet your HIPAA/BAA requirements. |

Tightening security and resolving the schema and EDI pipeline will make the current architecture solid for v1 and scalable toward stricter compliance later.

---

**For a HIPAA-focused alternative (strong BAA, no anon PHI, startup budget), see [HIPAA_BACKEND_OPTIONS.md](./HIPAA_BACKEND_OPTIONS.md).**
