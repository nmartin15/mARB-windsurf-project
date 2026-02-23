# HIPAA Backend Options — Startup Budget, Strong BAA, No Anon PHI

You need: **strong BAA**, **no anonymous or broad access to PHI/PII**, and **startup-friendly cost**. Below are realistic options and a recommended path.

---

## Why move off Supabase for this

- HIPAA on Supabase = **Enterprise / sales contact**, fixed monthly HIPAA fee on top of plan. Not transparent or cheap for early stage.
- Your app currently exposes PostgREST (anon key) and has had permissive RLS. For “no non-access to PHI” you want **no client → database direct access**; everything through an API you control.
- Migrations and schema split (canonical vs `healthcare_claims`) add friction. A clean backend gives you one place to own schema and access.

So: **Supabase isn’t “wrong,” but for “strong BAA + no anon PHI on a budget,” there are simpler and cheaper paths.**

---

## Option comparison (high level)

| Option | BAA | PHI access model | Relative cost | Complexity |
|--------|-----|------------------|---------------|------------|
| **Neon Postgres + your API** | ✅ Self-serve (Scale plan) | DB only from your backend; no client→DB | Low (usage-based; HIPAA currently no extra, later ~15%) | Medium (you add API + auth) |
| **Google Cloud (Cloud SQL + Cloud Run)** | ✅ Standard GCP BAA | Same: API-only access to DB | Low–medium (same pricing, no HIPAA surcharge) | Medium |
| **AWS (RDS + Lambda/App Runner)** | ✅ AWS BAA | Same | Low (free tier / small instances) | Medium–high |
| **Supabase HIPAA** | ✅ (contact sales) | Need to lock down RLS and avoid anon on PHI | Higher (Pro + HIPAA fee) | Low if you stay, but cost + sales |

**Google Health / Healthcare API:**  
That’s for **FHIR, HL7v2, DICOM** (interop, health data exchange). For **EDI 837/835 → analytics** you don’t need it. Use **Google Cloud** (Cloud SQL, Cloud Run, etc.) under the normal BAA; no need for Healthcare API unless you add FHIR later.

---

## Recommended: Neon + thin API (best fit for “cheaper, strong BAA, no anon PHI”)

**Why Neon fits you:**

1. **BAA:** Self-serve HIPAA on **Scale** plan; accept BAA in the console. No sales call.
2. **Cost:** Usage-based (compute + storage). Small workload = small bill. HIPAA currently no extra fee; later ~15% surcharge (they notify in advance).
3. **No anon PHI:** Neon’s **Data API is not HIPAA-covered**. So you **don’t** expose Neon to the browser. You run a **small backend** that is the only thing that talks to Neon. That gives you “no non-access to PHI” by design.
4. **Postgres:** Same schema and SQL you have today; migrations move over (e.g. `healthcare_claims` + RPCs or normalized tables).
5. **Migrations:** You own one Postgres; no Supabase-specific migration split. Clean slate.

**Architecture:**

```
Browser (React)
    → Your API (Node or Python on Railway / Render / Fly / Cloud Run)
        → Auth (see below)
        → Neon Postgres (HIPAA project, private; no client connection)
```

- **Auth:** You need a BAA-covered identity provider if auth touches PHI or is in-scope for your compliance. Options: **Auth0** (Okta) with BAA (confirm with them), **Firebase Auth / Identity Platform** under GCP BAA if you host API on GCP, or **Cognito** if you go AWS. For “login only” and no PHI in auth, many use Auth0 or Clerk and accept that auth itself may not be in BAA scope (verify with your counsel).
- **API:** Thin REST or tRPC in **Node (Express/Fastify)** or **Python (FastAPI)**. It runs your existing logic (dashboard aggregates, payment velocity, trend data, revenue leakage). No PostgREST; you control every endpoint and audit.
- **Hosting for API:** Railway, Render, Fly.io, or Cloud Run. Pick one that fits your BAA/compliance (e.g. GCP Cloud Run is under GCP BAA).

**What you’d do:**

1. Create a **Neon** org, enable HIPAA, accept BAA, create a HIPAA project (no Data API for PHI).
2. Apply your schema to Neon (single source of truth: either `healthcare_claims` + current RPCs or normalized `claim_headers`/…).
3. Build a small API that:
   - Authenticates users (via Auth0 / Firebase / Cognito),
   - Exposes only the endpoints the dashboard needs (claims list, aggregates, payment velocity, trend, revenue leakage),
   - Connects to Neon with a server-side connection string (never in the client).
4. Point the React app at your API instead of Supabase; remove `@supabase/supabase-js` from data access (or keep it only for file storage elsewhere if needed).
5. Host API + frontend (e.g. React on Vercel/Netlify/Cloud Storage; API on Railway/Render/Cloud Run).

**Rough cost (early stage):**  
Neon Scale (light usage) often **$20–70/month**; API host **$5–25/month**. **Total ~$30–100/month** and no anon PHI.

---

## Alternative: Google Cloud (Cloud SQL + Cloud Run)

If you prefer one vendor and a well-known BAA:

- **BAA:** Google’s standard [HIPAA BAA](https://cloud.google.com/terms/hipaa-baa) covers [many products](https://cloud.google.com/security/compliance/hipaa), including **Cloud SQL** and **Cloud Run**. Same pricing as non-HIPAA (no surcharge).
- **Setup:** Cloud SQL (PostgreSQL) + Cloud Run (container or source deploy for your API) + Identity Platform or Firebase Auth. React can be on Firebase Hosting or Cloud Storage + CDN.
- **PHI:** Only your API talks to Cloud SQL; no client direct access. “No non-access to PHI” by design.
- **Cost:** `db-f1-micro` + Cloud Run (free tier) + Identity Platform (free tier) = **~$10–12/month** early on (verified against GCP pricing, us-central1). Scales up with usage; no HIPAA surcharge.

**Good if:** You want everything (DB, API, auth) under one BAA and one bill, and are fine with GCP.

---

## Alternative: AWS (minimal)

- **BAA:** AWS signs a BAA; RDS, Lambda, API Gateway, etc. can be used for HIPAA when configured correctly.
- **Setup:** RDS (PostgreSQL), Lambda or App Runner for API, Cognito for auth. Frontend on S3 + CloudFront.
- **Cost:** Free tier (12 months) can cover small RDS + some Lambda; after that still often **~$40–100/month** for a minimal setup.

**Good if:** You’re already in AWS or want to stay there; slightly more config than Neon + Railway or GCP.

---

## What to avoid for “strong BAA, no anon PHI”

- **Supabase with anon key and open RLS on PHI** — Doesn’t meet “no non-access to PHI.” If you stay on Supabase, you’d need to remove all anon access to claim data and lock RLS to authenticated + org-scoped only, and still may pay Enterprise + HIPAA fee.
- **Clerk / typical “startup” auth only** — Many don’t offer BAA; fine for non-PHI, but for strict HIPAA you need a BAA-covered IdP or to scope PHI so it never touches auth (and document that).
- **Google Cloud Healthcare API** — Overkill for EDI 837/835 analytics; use normal GCP (Cloud SQL, Cloud Run) instead.

---

## Recommended path (concrete)

1. **Choose backend stack**
   - **Option A (recommended):** Neon (HIPAA) + Node or Python API on Railway/Render/Fly or Cloud Run. Strong BAA, no anon PHI, low cost.
   - **Option B:** GCP only: Cloud SQL + Cloud Run + Identity Platform. One BAA, one vendor.

2. **Consolidate schema**
   - Pick one schema (e.g. `healthcare_claims` + current RPC logic, or normalized `claim_headers`/…) and apply it in the new Postgres. No Supabase-specific split.

3. **Implement API**
   - Endpoints: auth-protected only; return exactly what the dashboard needs. No raw table access from the client.

4. **Auth**
   - Use Auth0 (confirm BAA) or GCP Identity Platform / Cognito if you want auth under the same BAA as the rest.

5. **Migrate**
   - Export data from Supabase (if any production data); load into Neon or Cloud SQL. Point React at the new API. Retire Supabase for PHI.

6. **EDI pipeline**
   - Keep Python EDI parser; have it output to CSV/JSON and either:
     - Import via your API (authenticated, audit-logged), or
     - A small batch job (same backend or separate script) that writes to Postgres with server credentials only.

---

## Summary

| Your goal | Best fit |
|-----------|----------|
| Cheaper than Supabase HIPAA | **Neon + your API** (or GCP minimal) |
| Strong BAA, no anon PHI | **Any option above** with “API-only DB access” (Neon, GCP, or AWS) |
| “Google Health” | Use **GCP (Cloud SQL + Cloud Run)** under standard BAA; skip Healthcare API unless you need FHIR/HL7 |
| Robust but not overkill | **Neon + thin API** or **GCP Cloud SQL + Cloud Run** — both are robust and startup-sized |

**Bottom line:** For startup budget + strong BAA + no non-access to PHI, the best setup is **Neon (HIPAA) + a thin backend API** that is the only thing talking to Postgres, with auth from a BAA-covered or counsel-approved provider. GCP is a solid one-vendor alternative. Supabase can work if you lock it down and accept higher cost and sales; it’s not the best fit for your current constraints.
