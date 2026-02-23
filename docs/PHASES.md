# Phases — Testing with Real EDI Files through Production

---

## What you actually have right now

| Piece | Status |
|-------|--------|
| Python 837P parser (`parse_837p.py`) | Written, outputs JSON |
| Python 835 parser (`parse_835.py`) | Written, outputs JSON |
| Supabase loader (`load_to_supabase.py`) | Written, loads JSON → Supabase tables |
| Original Colab parser (`read_edi_if_else_10152024_060625_v1.py`) | Produces DataFrames, no DB insert |
| Canonical schema (`00001_canonical_schema.sql`) | Written, normalized tables |
| RPC functions (`00002_rpc_functions.sql`) | Written, all 6 report functions |
| React dashboard | Works, queries Supabase |

**The pipeline exists on paper: 837/835 file → parser → JSON → loader → DB → dashboard.**  
**The gap: it has never been run end-to-end with real files.**

---

## Phase 1: Validate Parsers with Real EDI Files (local, no cloud)

**Goal:** Confirm `parse_837p.py` and `parse_835.py` produce correct, complete JSON from your real files.

**What you need:**
- 3–5 real 837P files (from a clearinghouse — Availity, Optum, WayStar, etc.)
- 1–3 matching 835 files (remittance for the same claims)
- Python 3.9+ installed locally

**Steps:**

1. **Run the 837P parser on each file**
   ```bash
   python scripts/parse_837p.py /path/to/real_837p_file.txt --output 837p_output.json
   ```

2. **Check the output manually**
   - Open `837p_output.json`
   - Verify: Does every claim have a `claim_id` (`clm_PatientControlNumber`)?
   - Verify: Do charge amounts match what the clearinghouse shows?
   - Verify: Are diagnosis codes (HI segments) parsed? Are dates (DTP 472, 232) present?
   - Verify: Are all claim lines (SV1) present with procedure codes and charges?
   - Verify: Does the sum of line charges = total claim charge amount?
   - Count: claims in output vs. claims you expect from the file

3. **Run the 835 parser on each remittance file**
   ```bash
   python scripts/parse_835.py /path/to/real_835_file.txt --output 835_output.json
   ```

4. **Check the 835 output**
   - Verify: Does each payment have a `claim_id` that matches an 837 claim?
   - Verify: Are paid amounts, allowed amounts, and patient responsibility populated?
   - Verify: Are CARC/RARC codes parsed for denials and adjustments?
   - Verify: Are payment dates present?

5. **Cross-check 837 ↔ 835**
   - For a few claims, manually verify: 837 billed amount → 835 paid amount → adjustment codes make sense

**What you'll likely find (and need to fix):**
- Edge cases in segment parsing (missing optional segments, unexpected delimiters)
- Files that use `^` as sub-element separator instead of `>`
- 837I files hitting the 837P parser (institutional vs. professional)
- Date formats or qualifier codes the parser doesn't handle
- Multi-file claims or split remittances

**Exit criteria:** Parsers produce valid JSON for all test files. Claim counts, amounts, and codes match what you see in the clearinghouse portal.

**Time:** 2–5 days depending on how many edge cases you hit.

---

## Phase 2: Validate Database Load (local Postgres)

**Goal:** Confirm the parsed JSON loads correctly into the schema and the dashboard can read it.

**What you need:**
- Local Postgres (Docker is easiest)
- The JSON output from Phase 1

**Steps:**

1. **Spin up local Postgres**
   ```bash
   docker run -d --name marb-pg \
     -e POSTGRES_DB=marb_health \
     -e POSTGRES_USER=marb \
     -e POSTGRES_PASSWORD=localtest \
     -p 5432:5432 \
     postgres:16
   ```

2. **Apply schema and functions**
   ```bash
   psql -h localhost -U marb -d marb_health -f supabase/migrations/00001_canonical_schema.sql
   psql -h localhost -U marb -d marb_health -f supabase/migrations/00002_rpc_functions.sql
   ```

3. **Modify `load_to_supabase.py` → `load_to_postgres.py`**
   - Replace the Supabase client with `psycopg2` or `pg8000` (direct Postgres)
   - Same insert logic, different connection method
   - Or: temporarily point Supabase URL at local Postgres via PostgREST if you want to test unchanged

4. **Load the 837 JSON**
   ```bash
   python scripts/load_to_supabase.py 837p_output.json --type 837P --org-id 1
   ```

5. **Load the 835 JSON**
   ```bash
   python scripts/load_to_supabase.py 835_output.json --type 835 --org-id 1
   ```

6. **Verify data in the database**
   ```sql
   -- Claims loaded?
   SELECT count(*) FROM claim_headers WHERE file_name IS NOT NULL;

   -- Lines loaded?
   SELECT ch.claim_id, count(cl.id) as line_count
   FROM claim_headers ch
   JOIN claim_lines cl ON cl.claim_header_id = ch.id
   GROUP BY ch.claim_id;

   -- Dates loaded?
   SELECT claim_header_id, date_qualifier, date_value, parsed_date
   FROM claim_dates LIMIT 20;

   -- Payments loaded? (835)
   SELECT ch.claim_id, cp.paid_amount, cp.payment_date
   FROM claim_payments cp
   JOIN claim_headers ch ON cp.claim_header_id = ch.id;

   -- Adjustments loaded?
   SELECT ca.carc_code, ca.carc_description, ca.adjustment_amount
   FROM claim_adjustments ca LIMIT 20;

   -- RPC functions work?
   SELECT * FROM get_payment_velocity(NULL, '6M');
   SELECT * FROM get_trend_data(NULL, '6M');
   SELECT * FROM get_ar_aging(NULL);
   SELECT * FROM get_denial_summary(NULL, '6M');
   SELECT * FROM get_payer_performance(NULL, '6M');
   SELECT * FROM get_clean_claim_rate(NULL, '6M');
   ```

7. **Check for problems**
   - NULLs where you expect values (bad field mapping)
   - Duplicate claims (upsert not working)
   - RPC functions returning empty (date joins failing, qualifier mismatches)
   - Amounts not matching (decimal/string conversion)

**What you'll likely find:**
- Field mapping mismatches between parser JSON keys and `load_to_supabase.py` expectations
- `parsed_date` column not populated (loader may not convert CCYYMMDD strings to DATE)
- `claim_payments` not linked to `claim_headers` (835 claim IDs don't match 837 claim IDs — this is a known EDI problem; payers sometimes use their own claim numbers)
- RPC functions return empty because date joins fail

**Exit criteria:** All 6 RPC functions return data. Claim counts, amounts, and denial codes in the DB match the source files.

**Time:** 2–4 days.

---

## Phase 3: Dashboard End-to-End (local, still no cloud)

**Goal:** See real EDI data in the React dashboard.

**What you need:**
- Local Postgres from Phase 2 (with real data loaded)
- React app running locally

**Steps:**

1. **Point the React app at local Postgres**
   - Option A: Run Supabase locally via Docker (`supabase start`) and point at it
   - Option B (better, since you're moving to GCP): Build the Cloud Run API locally and point React at `localhost:8080`

2. **Start the dashboard**
   ```bash
   npm run dev
   ```

3. **Verify every dashboard component with real data**

   | Component | What to check |
   |-----------|--------------|
   | Metric cards (Total Claims, Total Amount, Avg Claim, Approval Rate) | Numbers match what you calculated from the raw files |
   | Payment Velocity chart | Has data points; days-to-payment values are reasonable (not negative, not 999) |
   | Trend Analysis chart (A/R aging buckets) | Claims distributed across 0-30, 31-60, 61-90, 91+ based on service dates |
   | Filing Indicator chart | Groups by payer type (MC=Medicaid, BL=BCBS, etc.) |
   | Claims list | All loaded claims appear; click-through shows detail |
   | Claim detail | Lines, diagnoses, dates, providers, payments all populated |
   | Revenue Leakage report | Shows claims where billed > paid or status = denied |
   | A/R Aging report | Payers listed with amounts in correct aging buckets |
   | Denial Analysis report | CARC codes listed with counts and amounts |
   | Payer Performance report | Reimbursement rate, denial rate, avg days to pay per payer |
   | Clean Claim Rate report | Monthly rate shown |

4. **Test edge cases**
   - Period filter (1M, 3M, 6M, 1Y) — does data change?
   - Empty state — what happens with no 835 data? (payment velocity should be empty, not broken)
   - Single-claim file — does everything still work?

**Exit criteria:** Every dashboard component renders real data correctly. No blank charts, no NaN, no negative days-to-payment.

**Time:** 1–3 days.

---

## Phase 4: GCP Setup + Migration

**Goal:** Move from local Postgres to Cloud SQL; deploy API and frontend.

**What you need:**
- GCP account with billing
- See `docs/GCP_SETUP_GUIDE.md` for full commands

**Steps:**

1. **GCP project + BAA** (1 hour)
   - Create project, accept HIPAA BAA, enable APIs

2. **Cloud SQL** (1–2 hours)
   - Create `db-f1-micro` instance (private IP)
   - Create database and user
   - Apply `00001_canonical_schema.sql` and `00002_rpc_functions.sql`
   - Load the same real EDI data you tested in Phase 2

3. **Build and deploy API** (2–4 days)
   - Node/Express or Python/FastAPI
   - Endpoints for: dashboard data, claims list, claim detail, all 6 report RPCs, messaging, file upload
   - Firebase JWT auth middleware on every route
   - Deploy to Cloud Run

4. **Identity Platform** (30 min)
   - Enable email/password provider
   - Create your test user

5. **Migrate React app** (2–3 days)
   - Replace `@supabase/supabase-js` calls with `fetch` to your API
   - Replace Supabase Auth with Firebase Auth SDK
   - Update env vars

6. **Deploy frontend** (1 hour)
   - Firebase Hosting or Cloud Storage + CDN

7. **Re-run all Phase 3 checks against the deployed version**

**Exit criteria:** Dashboard at `https://your-domain.com` shows real EDI data. Login works. No Supabase dependency.

**Time:** 1–2 weeks.

---

## Phase 5: EDI Pipeline (automated ingestion)

**Goal:** A repeatable, audited path from "new EDI file" to "data in dashboard."

**Steps:**

1. **Modify `load_to_supabase.py` → `load_to_cloudsql.py`**
   - Replace Supabase client with Cloud SQL Python Connector (`cloud-sql-python-connector[pg8000]`)
   - Same logic; different connection

2. **Create an upload endpoint in your API**
   ```
   POST /api/edi/upload
   - Accepts: raw EDI file (837P, 837I, or 835)
   - Steps: save to Cloud Storage → run parser → load to Cloud SQL → return result
   - Auth: requires valid JWT + appropriate role
   ```

3. **Or: batch script for bulk processing**
   ```bash
   python scripts/parse_837p.py /path/to/new_files/ --output batch.json
   python scripts/load_to_cloudsql.py batch.json --type 837P --org-id 1
   ```

4. **Add to `edi_file_log`** — the loader already does this (duplicate detection via file hash)

5. **Test the full cycle**
   - Upload a new 837P file → see new claims in dashboard within seconds
   - Upload the matching 835 → see payment data appear

**Exit criteria:** New EDI files can be ingested without touching the database directly. `edi_file_log` tracks what's been processed.

**Time:** 2–4 days.

---

## Phase 6: Production Hardening

**Goal:** Ready for real users with real PHI.

| Item | What | How |
|------|------|-----|
| **Cloud SQL upgrade** | Move to dedicated-core (`db-custom-1-3840` or HA) | `gcloud sql instances patch` |
| **Backups** | Automated daily backups + point-in-time recovery | Enable in Cloud SQL settings |
| **Audit logging** | Cloud Audit Logs (admin activity is auto; enable data access logs) | Console → Logging → Audit Logs |
| **Custom domain** | `app.marbhealth.com` | Firebase Hosting or Load Balancer + SSL |
| **Rate limiting** | Prevent abuse on the API | Express middleware or Cloud Armor |
| **Error monitoring** | Catch API errors and slow queries | Cloud Error Reporting + Cloud Monitoring |
| **User management** | Create real user accounts, roles (admin, viewer, billing) | Identity Platform + custom claims or a `user_roles` table |
| **Org-scoped access** | API filters data by `org_id` from the user's JWT | Add org_id to Firebase custom claims; API reads it |
| **CI/CD** | Auto-deploy on push | Cloud Build → Cloud Run (or GitHub Actions) |
| **Penetration test** | Third-party security assessment | Required for many HIPAA audits |
| **BAA documentation** | Record that BAA is accepted, what services are in scope | Keep in compliance folder |

**Time:** 1–2 weeks spread out.

---

## Summary: What You Need for Each Stage

### Testing with real 837/835 files (Phases 1–3)

| Need | Cost |
|------|------|
| Python 3.9+ | Free |
| 3–5 real 837P files + 1–3 real 835 files | From your clearinghouse |
| Docker (local Postgres) | Free |
| Your existing parsers, schema, and React app | Already written |
| **Total** | **$0, 2–3 weeks of work** |

### Production (Phases 4–6)

| Need | Cost |
|------|------|
| GCP project with BAA | $0 to set up |
| Cloud SQL (`db-f1-micro` for launch, upgrade later) | $9.37/mo |
| Cloud Run (API) | ~$0–3/mo |
| Identity Platform | $0 |
| Cloud Storage + Hosting | ~$0.50/mo |
| Custom domain + SSL | ~$12/yr |
| Cloud Run API code (Node or Python) | You build it |
| React migration (Supabase → API) | You build it |
| **Total infra** | **~$10–13/mo** |
| **Total build time** | **~3–4 weeks (Phases 4–6)** |

### Overall timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Validate parsers | 2–5 days | Week 1 |
| 2. Validate DB load | 2–4 days | Week 2 |
| 3. Dashboard end-to-end | 1–3 days | Week 2–3 |
| 4. GCP setup + migration | 1–2 weeks | Week 3–5 |
| 5. EDI pipeline | 2–4 days | Week 5–6 |
| 6. Production hardening | 1–2 weeks | Week 6–8 |
| **Total to production** | | **~6–8 weeks** |
