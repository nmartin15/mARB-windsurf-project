# GCP One-Vendor Setup — mARB Health

Everything under one Google Cloud BAA: database, API, auth, file storage, frontend hosting.  
No Supabase. No anon PHI. Startup budget.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Google Cloud (one BAA covers all of this)               │
│                                                          │
│  ┌──────────────┐     ┌────────────────────────────┐    │
│  │ Cloud Storage │     │ Cloud Run (API)             │    │
│  │ + CDN         │     │   Node/Express or           │    │
│  │ (React SPA)   │     │   Python/FastAPI            │    │
│  └──────┬───────┘     │                              │    │
│         │   HTTPS      │   ┌─────────────┐           │    │
│         └──────────────►   │ Identity    │           │    │
│                        │   │ Platform    │           │    │
│  Browser ──HTTPS──────►│   │ (Auth)      │           │    │
│                        │   └──────┬──────┘           │    │
│                        │          │ JWT verify        │    │
│                        │   ┌──────▼──────┐           │    │
│                        │   │ Cloud SQL   │           │    │
│                        │   │ PostgreSQL  │           │    │
│                        │   │ (private IP)│           │    │
│                        │   └─────────────┘           │    │
│                        └────────────────────────────┘    │
│                                                          │
│  ┌───────────────────────────┐                          │
│  │ Cloud Storage (private)    │                          │
│  │ (EDI files / attachments)  │                          │
│  └───────────────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Key point:** The browser **never** talks to Cloud SQL. All PHI flows through your API on Cloud Run, which verifies the user's JWT and queries Postgres on a private network. No anon key, no PostgREST, no client-side DB access.

---

## GCP Services and What Replaces What

| Current (Supabase) | GCP replacement | BAA covered | Notes |
|---------------------|-----------------|-------------|-------|
| Supabase Postgres | **Cloud SQL for PostgreSQL** | Yes | Private IP; only Cloud Run connects |
| Supabase Auth | **Identity Platform** (Firebase Auth under the hood) | Yes | Email/password, Google, SAML/OIDC; JWTs |
| Supabase PostgREST | **Cloud Run** (your API) | Yes | You write the endpoints; full control |
| Supabase Storage | **Cloud Storage** (private bucket) | Yes | Signed URLs for uploads/downloads |
| Supabase RPC functions | **SQL functions in Cloud SQL** | Yes | Same PL/pgSQL; called from your API |
| Frontend hosting | **Cloud Storage + Cloud CDN** or **Firebase Hosting** | Yes | Static SPA |

---

## Estimated Monthly Cost (startup / early stage)

Prices verified against GCP pricing pages (us-central1, February 2026).

| Service | Spec | How calculated | Est. cost |
|---------|------|----------------|-----------|
| Cloud SQL (PostgreSQL) | `db-f1-micro` (shared vCPU, 0.6 GB RAM, 10 GB SSD) | Compute: $0.0105/hr × 730 hrs = $7.67. SSD: $0.17/GiB/mo × 10 GiB = $1.70. | **$9.37/mo** |
| Cloud Run (API) | Min 0 instances, 256 MB / 1 vCPU | Free tier: 2M requests/mo, 360k vCPU-sec, 180k GiB-sec. A few users = well within free tier. | **$0/mo** |
| Identity Platform (Auth) | Email/password login | Free tier: 50,000 MAU. | **$0/mo** |
| Cloud Storage | React build (~5 MB) + EDI files + attachments; under 1 GB total | $0.02/GB/mo. | **<$0.10/mo** |
| Cloud CDN | Low traffic SPA | $0.0075/10k requests + $0.02–0.08/GiB egress. | **$0.50–2/mo** |
| Secret Manager | DB password, API keys (~3 secrets) | 6 active versions free, 10k access ops free. | **$0/mo** |
| **Total** | | | **~$10–12/mo** |

**No HIPAA surcharge.** GCP charges the same pricing whether you're under a BAA or not.

**Important caveats:**
- `db-f1-micro` is a **shared-core** instance and is **not covered by the Cloud SQL SLA**. Fine for dev/MVP. For production with uptime guarantees, use a dedicated-core instance (see scaling below).
- Cloud Run free tier resets monthly and is per billing account. If you have other GCP projects using Cloud Run, you share the free tier.
- Network egress beyond 1 GiB/mo (Cloud Run) or within-region is free; cross-region egress is additional.

**Scaling up (when you need to):**

| Stage | Cloud SQL | Compute cost | + Storage (10 GB SSD) | Cloud Run | Est. total |
|-------|-----------|-------------|----------------------|-----------|------------|
| MVP | `db-f1-micro` (shared, 0.6 GB) | $7.67/mo | $1.70 | Free tier | **~$10–12/mo** |
| Small production | `db-g1-small` (shared, 1.7 GB) | $25.55/mo | $1.70 | Free tier | **~$28–30/mo** |
| Dedicated (SLA-backed) | 1 vCPU, 3.75 GiB (Enterprise) | $0.0413/hr vCPU + $0.007/GiB-hr mem = ~$49.24/mo | $1.70 | ~$5–15/mo | **~$56–66/mo** |
| HA production | 1 vCPU, 3.75 GiB, HA | ~$98.50/mo | $3.40 (HA doubles) | ~$5–15/mo | **~$107–117/mo** |

---

## Step-by-Step Setup

### Phase 1: GCP project + BAA (Day 1)

1. **Create a GCP project**
   ```
   gcloud projects create marb-health-prod --name="mARB Health"
   gcloud config set project marb-health-prod
   ```

2. **Enable billing** — link a billing account in the Console.

3. **Accept the HIPAA BAA**
   - Go to **Console → Settings → Privacy compliance** (or visit `https://console.cloud.google.com/iam-admin/settings`)
   - Review and accept the **HIPAA Business Associate Addendum**. This covers all BAA-eligible services in the project.

4. **Enable APIs**
   ```
   gcloud services enable \
     sqladmin.googleapis.com \
     run.googleapis.com \
     identitytoolkit.googleapis.com \
     secretmanager.googleapis.com \
     storage.googleapis.com \
     cloudresourcemanager.googleapis.com
   ```

---

### Phase 2: Cloud SQL (database)

1. **Create the instance** (smallest production-capable)
   ```
   gcloud sql instances create marb-db \
     --database-version=POSTGRES_16 \
     --tier=db-f1-micro \
     --region=us-central1 \
     --storage-type=SSD \
     --storage-size=10GB \
     --availability-type=zonal \
     --no-assign-ip \
     --network=default
   ```
   `--no-assign-ip` = private IP only (no public internet access).

2. **Create the database and user**
   ```
   gcloud sql databases create marb_health --instance=marb-db
   gcloud sql users create marb_api --instance=marb-db --password=<STRONG_PASSWORD>
   ```

3. **Store the password in Secret Manager**
   ```
   echo -n "<STRONG_PASSWORD>" | \
     gcloud secrets create db-password --data-file=- --replication-policy=automatic
   ```

4. **Apply schema** — connect via Cloud SQL Auth Proxy (or Cloud Shell) and run:
   - `00001_canonical_schema.sql` (your existing canonical migration)
   - `00002_rpc_functions.sql` (your existing RPC functions)

   From Cloud Shell:
   ```
   gcloud sql connect marb-db --user=marb_api --database=marb_health
   ```
   Then paste or `\i` your SQL files.

---

### Phase 3: Identity Platform (auth)

1. **Enable Identity Platform** in the Console:
   - Go to **Console → Identity Platform → Getting Started**
   - Enable Email/Password provider (and Google, SAML, etc. as needed)

2. **Get your config** — Console shows `apiKey`, `authDomain`, and `projectId`. These go into your React app (they're public; no secrets).

3. **Frontend:** Replace `@supabase/supabase-js` auth calls with **Firebase Auth SDK**:
   ```
   npm install firebase
   ```

   ```typescript
   // src/lib/auth.ts
   import { initializeApp } from 'firebase/app';
   import {
     getAuth,
     signInWithEmailAndPassword,
     signOut,
     onAuthStateChanged,
     type User,
   } from 'firebase/auth';

   const app = initializeApp({
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_GCP_PROJECT_ID,
   });

   export const auth = getAuth(app);

   export async function login(email: string, password: string) {
     return signInWithEmailAndPassword(auth, email, password);
   }

   export async function logout() {
     return signOut(auth);
   }

   export function onAuthChange(callback: (user: User | null) => void) {
     return onAuthStateChanged(auth, callback);
   }

   export async function getIdToken(): Promise<string | null> {
     const user = auth.currentUser;
     if (!user) return null;
     return user.getIdToken();
   }
   ```

4. **API calls from React:** Attach the JWT to every request:
   ```typescript
   // src/lib/api.ts
   import { getIdToken } from './auth';

   const API_BASE = import.meta.env.VITE_API_URL; // Cloud Run URL

   async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
     const token = await getIdToken();
     const res = await fetch(`${API_BASE}${path}`, {
       ...options,
       headers: {
         'Content-Type': 'application/json',
         ...(token ? { Authorization: `Bearer ${token}` } : {}),
         ...options?.headers,
       },
     });
     if (!res.ok) {
       throw new Error(`API error: ${res.status} ${res.statusText}`);
     }
     return res.json();
   }

   // Dashboard
   export const getDashboardData = (period: string) =>
     apiFetch<DashboardResponse>(`/api/dashboard?period=${period}`);

   // Payment velocity (replaces supabase.rpc('get_payment_velocity'))
   export const getPaymentVelocity = (period: string) =>
     apiFetch<PaymentVelocityData[]>(`/api/reports/payment-velocity?period=${period}`);

   // Trend data (replaces supabase.rpc('get_trend_data'))
   export const getTrendData = (period: string) =>
     apiFetch<TrendData[]>(`/api/reports/trend?period=${period}`);

   // AR aging (replaces supabase.rpc('get_ar_aging'))
   export const getARaging = () =>
     apiFetch<ARAgingData[]>('/api/reports/ar-aging');

   // Denials (replaces supabase.rpc('get_denial_summary'))
   export const getDenialSummary = (period: string) =>
     apiFetch<DenialData[]>(`/api/reports/denials?period=${period}`);

   // Payer performance (replaces supabase.rpc('get_payer_performance'))
   export const getPayerPerformance = (period: string) =>
     apiFetch<PayerData[]>(`/api/reports/payer-performance?period=${period}`);

   // Clean claim rate (replaces supabase.rpc('get_clean_claim_rate'))
   export const getCleanClaimRate = (period: string) =>
     apiFetch<CleanClaimData[]>(`/api/reports/clean-claim-rate?period=${period}`);

   // Claims list (replaces supabase.from('claim_headers').select())
   export const getClaims = (params?: Record<string, string>) =>
     apiFetch<ClaimHeader[]>(`/api/claims?${new URLSearchParams(params)}`);

   // Claim detail (replaces multiple supabase.from() calls)
   export const getClaimDetail = (id: string) =>
     apiFetch<ClaimDetail>(`/api/claims/${id}`);

   // Data import (replaces supabase.from().insert())
   export const importClaims = (data: ImportPayload) =>
     apiFetch<ImportResult>('/api/import', {
       method: 'POST',
       body: JSON.stringify(data),
     });
   ```

---

### Phase 4: Cloud Run API (backend)

This is the new piece. A thin API that owns all DB access.

**Option A: Node + Express** (closest to your current TypeScript stack)

Project structure:
```
api/
├── package.json
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts          # Express app entry
    ├── middleware/
    │   └── auth.ts       # Firebase JWT verification
    ├── db.ts             # pg Pool to Cloud SQL
    └── routes/
        ├── dashboard.ts
        ├── claims.ts
        ├── reports.ts
        ├── messaging.ts
        └── import.ts
```

Key files:

```typescript
// api/src/db.ts
import pg from 'pg';

export const pool = new pg.Pool({
  host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
});
```

```typescript
// api/src/middleware/auth.ts
import admin from 'firebase-admin';

admin.initializeApp();

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = header.split('Bearer ')[1];
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

```typescript
// api/src/routes/reports.ts  (example: replaces supabase.rpc calls)
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/payment-velocity', async (req, res) => {
  const period = (req.query.period as string) || '6M';
  const { rows } = await pool.query(
    'SELECT * FROM get_payment_velocity($1, $2)',
    [null, period]  // org_id null for now; add from req.user later
  );
  res.json(rows);
});

router.get('/trend', async (req, res) => {
  const period = (req.query.period as string) || '6M';
  const { rows } = await pool.query(
    'SELECT * FROM get_trend_data($1, $2)',
    [null, period]
  );
  res.json(rows);
});

router.get('/ar-aging', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM get_ar_aging($1)', [null]);
  res.json(rows);
});

router.get('/denials', async (req, res) => {
  const period = (req.query.period as string) || '6M';
  const { rows } = await pool.query(
    'SELECT * FROM get_denial_summary($1, $2)',
    [null, period]
  );
  res.json(rows);
});

router.get('/payer-performance', async (req, res) => {
  const period = (req.query.period as string) || '6M';
  const { rows } = await pool.query(
    'SELECT * FROM get_payer_performance($1, $2)',
    [null, period]
  );
  res.json(rows);
});

router.get('/clean-claim-rate', async (req, res) => {
  const period = (req.query.period as string) || '6M';
  const { rows } = await pool.query(
    'SELECT * FROM get_clean_claim_rate($1, $2)',
    [null, period]
  );
  res.json(rows);
});

export default router;
```

```typescript
// api/src/routes/claims.ts  (replaces supabase.from('claim_headers'))
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const { rows } = await pool.query(
    `SELECT * FROM claim_headers
     WHERE file_name IS NOT NULL
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const [header, lines, diagnoses, dates, providers, payments] = await Promise.all([
    pool.query('SELECT * FROM claim_headers WHERE id = $1', [id]),
    pool.query('SELECT * FROM claim_lines WHERE claim_header_id = $1 ORDER BY line_number', [id]),
    pool.query('SELECT * FROM claim_diagnoses WHERE claim_header_id = $1 ORDER BY sequence_number', [id]),
    pool.query('SELECT * FROM claim_dates WHERE claim_header_id = $1', [id]),
    pool.query('SELECT * FROM claim_providers WHERE claim_header_id = $1', [id]),
    pool.query('SELECT * FROM claim_payments WHERE claim_header_id = $1', [id]),
  ]);
  if (header.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...header.rows[0],
    lines: lines.rows,
    diagnoses: diagnoses.rows,
    dates: dates.rows,
    providers: providers.rows,
    payments: payments.rows,
  });
});

export default router;
```

```typescript
// api/src/index.ts
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth';
import reportsRouter from './routes/reports';
import claimsRouter from './routes/claims';

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
app.use(express.json());
app.use(requireAuth);

app.use('/api/reports', reportsRouter);
app.use('/api/claims', claimsRouter);

const port = parseInt(process.env.PORT || '8080');
app.listen(port, () => console.log(`API listening on ${port}`));
```

**Dockerfile:**
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
ENV PORT=8080
CMD ["node", "dist/index.js"]
```

**Deploy to Cloud Run:**
```bash
# From api/ directory
gcloud run deploy marb-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances marb-health-prod:us-central1:marb-db \
  --set-env-vars "DB_NAME=marb_health,DB_USER=marb_api,CLOUD_SQL_CONNECTION_NAME=marb-health-prod:us-central1:marb-db" \
  --set-secrets "DB_PASSWORD=db-password:latest" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 256Mi \
  --cpu 1
```

Cloud Run auto-connects to Cloud SQL via Unix socket (private, no public IP). The `--add-cloudsql-instances` flag handles this.

---

### Phase 5: File storage (replaces Supabase Storage)

1. **Create a private bucket**
   ```
   gcloud storage buckets create gs://marb-health-files \
     --location=us-central1 \
     --uniform-bucket-level-access
   ```

2. **Upload/download via signed URLs** from your API:
   ```typescript
   // api/src/routes/files.ts
   import { Storage } from '@google-cloud/storage';
   const storage = new Storage();
   const bucket = storage.bucket('marb-health-files');

   router.post('/upload-url', async (req, res) => {
     const { filename } = req.body;
     const file = bucket.file(`uploads/${req.user.uid}/${filename}`);
     const [url] = await file.getSignedUrl({
       version: 'v4',
       action: 'write',
       expires: Date.now() + 15 * 60 * 1000, // 15 min
       contentType: 'application/octet-stream',
     });
     res.json({ uploadUrl: url });
   });
   ```

   The browser uploads directly to Cloud Storage via the signed URL; no file content passes through your API. The bucket is private; files can't be accessed without a signed URL.

---

### Phase 6: Frontend hosting

**Option A: Cloud Storage + CDN** (simplest, cheapest)
```bash
# Build
npm run build

# Create public bucket for SPA
gcloud storage buckets create gs://marb-health-app \
  --location=us-central1 \
  --uniform-bucket-level-access

# Make public
gcloud storage buckets add-iam-policy-binding gs://marb-health-app \
  --member=allUsers --role=roles/storage.objectViewer

# Upload
gcloud storage cp -r dist/* gs://marb-health-app/

# Set index and 404 (SPA routing)
gcloud storage buckets update gs://marb-health-app \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html
```

Add Cloud CDN via a Load Balancer for HTTPS + custom domain, or use **Firebase Hosting** (also under GCP BAA) which handles CDN + custom domain + HTTPS automatically:

**Option B: Firebase Hosting** (easier custom domain + HTTPS)
```bash
npm install -g firebase-tools
firebase init hosting  # point to dist/
firebase deploy
```

---

### Phase 7: EDI pipeline (Python → Cloud SQL)

Your Python EDI parser stays as-is. Add a small loader script:

```python
# scripts/load_to_cloudsql.py
import os
import pg8000
from google.cloud.sql.connector import Connector

connector = Connector()

def get_connection():
    return connector.connect(
        os.environ["CLOUD_SQL_CONNECTION_NAME"],  # project:region:instance
        "pg8000",
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        db=os.environ["DB_NAME"],
    )

conn = get_connection()
cursor = conn.cursor()

# Example: insert claim headers from DataFrame
def load_claim_headers(df):
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO claim_headers (claim_id, total_charge_amount, file_name, ...)
            VALUES (%s, %s, %s, ...)
            ON CONFLICT (claim_id) DO NOTHING
        """, (row['clm_PatientControlNumber'], row['clm_TotalClaimChargeAmount'], row['file_name'], ...))
    conn.commit()
```

Run locally or as a Cloud Run Job (batch). The Cloud SQL Python Connector handles auth and private networking.

Add to `requirements.txt`:
```
pandas>=2.0.0,<3
cloud-sql-python-connector[pg8000]>=1.0.0
```

---

## Migration Path: What Changes in the React App

| What | Now (Supabase) | After (GCP) |
|------|----------------|-------------|
| `import { supabase } from '../lib/supabase'` | Direct Supabase client | **Remove.** Use `src/lib/api.ts` (fetch-based) |
| `supabase.auth.signInWithPassword()` | Supabase Auth | `signInWithEmailAndPassword(auth, ...)` from Firebase |
| `supabase.auth.getUser()` | Supabase Auth | `auth.currentUser` from Firebase |
| `supabase.auth.signOut()` | Supabase Auth | `signOut(auth)` from Firebase |
| `supabase.from('claim_headers').select()` | PostgREST | `GET /api/claims` via `apiFetch` |
| `supabase.rpc('get_payment_velocity', ...)` | PostgREST RPC | `GET /api/reports/payment-velocity?period=...` |
| `supabase.rpc('get_trend_data', ...)` | PostgREST RPC | `GET /api/reports/trend?period=...` |
| `supabase.from('messages').select()` | PostgREST | `GET /api/messaging/threads/:id/messages` |
| `supabase.storage.from('secure_attachments')` | Supabase Storage | Cloud Storage signed URLs via `POST /api/files/upload-url` |
| `safeQuery(...)` wrapper | Supabase error handling | Standard fetch error handling in `apiFetch` |
| RLS policies | In Supabase Postgres | **Replaced by API auth middleware** (no direct DB from client) |
| `.env` vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_GCP_PROJECT_ID` |

---

## What You Keep As-Is

- **React app** (pages, components, charts, Tailwind, Recharts, TanStack Table) — just swap data-fetching layer
- **Schema** (`00001_canonical_schema.sql`) — apply to Cloud SQL verbatim
- **RPC functions** (`00002_rpc_functions.sql`) — apply to Cloud SQL; API calls them via `SELECT * FROM function_name()`
- **Python EDI parser** (`scripts/`) — unchanged; add Cloud SQL connector for loading
- **TypeScript types** — same interfaces, just sourced from API instead of Supabase

---

## Security Checklist

- [ ] BAA accepted in GCP Console
- [ ] Cloud SQL: private IP only, no public IP
- [ ] Cloud Run: requires Firebase JWT on every request
- [ ] No Supabase anon key anywhere
- [ ] No direct browser → database connection
- [ ] Cloud Storage buckets: private (signed URLs only)
- [ ] Secret Manager for DB password and any API keys
- [ ] Cloud Audit Logs enabled (on by default for admin activity)
- [ ] Disable any GCP APIs you don't use
- [ ] Don't put PHI in metadata, resource names, or logs (per GCP HIPAA guidance)

---

## Timeline Estimate

| Phase | Work | Time |
|-------|------|------|
| 1. GCP project + BAA | Console setup | 1 hour |
| 2. Cloud SQL | Create instance, apply schema | 1–2 hours |
| 3. Identity Platform | Enable, get config | 30 min |
| 4. Cloud Run API | Write routes, deploy | 2–4 days (main work) |
| 5. File storage | Bucket + signed URL endpoint | 2–3 hours |
| 6. Frontend hosting | Deploy build | 1 hour |
| 7. React migration | Swap Supabase → API calls + Firebase Auth | 2–3 days |
| 8. EDI loader | Add Cloud SQL connector to Python | 3–4 hours |
| **Total** | | **~1–2 weeks** |

The bulk is Phase 4 (API) and Phase 7 (React migration). The API is straightforward since your RPC functions already contain the business logic — the API just calls them and returns JSON.
