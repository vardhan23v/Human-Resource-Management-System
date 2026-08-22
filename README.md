<div align="center">

![Dayflow — Every workday, perfectly aligned.](docs/banner.png)

# Dayflow HRMS

**Every workday, perfectly aligned.**

A production-grade Human Resource Management System — employee directory, attendance, time off, payroll with PDF payslips, approvals, notifications and audit — built as a TypeScript monorepo and deployed serverless on Vercel.

[![Live demo](https://img.shields.io/badge/live-frontend--iota--two--70.vercel.app-5B5BF6?style=flat-square&logo=vercel&logoColor=white)](https://frontend-iota-two-70.vercel.app)
[![API](https://img.shields.io/badge/api-dayflow--api.vercel.app-111827?style=flat-square&logo=vercel&logoColor=white)](https://dayflow-api.vercel.app/api/health)
![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/mysql-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)
[![CI](https://github.com/vardhan23v/Human-Resource-Management-System/actions/workflows/ci.yml/badge.svg)](https://github.com/vardhan23v/Human-Resource-Management-System/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-24%20unit%20%2B%207%20e2e-0E9F6E?style=flat-square&logo=jest&logoColor=white)
![Version](https://img.shields.io/badge/version-2.2.0-7C3AED?style=flat-square)

[Live demo](#-live-demo) · [Quick start](#-quick-start) · [Architecture](#-architecture) · [API](#-api-reference) · [Domain rules](#-domain-rules) · [Deployment](#-deployment) · [Runbook](#-operations-runbook) · [Contributing](#-contributing)

</div>

---

## ✨ Live demo

| | URL | Notes |
|---|---|---|
| **App** | https://frontend-iota-two-70.vercel.app | React SPA, static build |
| **API** | https://dayflow-api.vercel.app | Express on Vercel Functions — [`/api/health`](https://dayflow-api.vercel.app/api/health) reports DB + driver status · interactive docs at [`/api/docs`](https://dayflow-api.vercel.app/api/docs) |

Sign in with any demo account (Login ID **or** email + password):

| Role | Email | Login ID | Password |
|---|---|---|---|
| Admin | `admin@dayflow.local` | `OIARME20220001` | `Password123` |
| HR | `hr@dayflow.local` | `OIPRSH20220002` | `Password123` |
| Manager | `vikram.singh@dayflow.local` | `OIVISI20220003` | `Password123` |
| Employee | `john.doe@dayflow.local` | `OIJODO20220004` | `Password123` |

> The demo DB is shared and periodically reset. Uploaded files on the demo are ephemeral (see [Deployment caveats](#caveats-on-serverless)).

---

## 🧭 What's inside

- **Employee directory** — search, departments, profiles with documents, skills and certifications; HR/Admin create employees (no self-registration) with auto-generated Login IDs and a forced first-login password change.
- **Attendance** — check-in/out with grace periods and late flags, half-day/present thresholds, calendar and heat-map views, regularization requests with approval.
- **Time off** — configurable leave types, live balances that exclude weekends/holidays, overlap detection, single- or multi-level approval, cancellation flow, approvals that sync straight into attendance.
- **Payroll** — effective-dated salary structures, component rules (Basic/HRA/Standard/Bonus/LTA/Fixed, PF, PT), prorated monthly runs, idempotent re-runs, finalization lock, PDF payslips.
- **Org admin** — work hours, week-off days, holidays, leave policies, departments.
- **Onboarding** — self-service checklist with progress ring (password, photo, contacts, emergency contact, documents, policy acknowledgement) and HR-generated offer-letter PDFs.
- **Manager team view** — who's in / on leave / not in yet, with inline leave and regularisation approvals.
- **Reports** — attendance summary per employee, leave utilisation, headcount by department, late arrivals; CSV export everywhere.
- **Bulk import** — CSV → employees with per-row results and temp passwords; template download.
- **Cross-cutting** — in-app + email notifications (Resend/SMTP), append-only audit log (actor, before/after, IP, UA), role-scoped dashboard, company branding (name + logo).
- **Power-user UX** — ⌘K command palette (people search + actions), keyboard shortcuts (`c`, `n`, `t`, `g`+key, `?`), mobile drawer, installable PWA, full dark mode.
- **UI** — hand-rolled design system (no UI kit), custom cursor, route transitions, staggered reveals, animated counters, toasts — all `prefers-reduced-motion` safe.

---

## 🚀 Quick start

**Prerequisites:** Node ≥ 20, MySQL 8.x, npm 9+.

```bash
git clone https://github.com/vardhan23v/Human-Resource-Management-System.git
cd Human-Resource-Management-System
npm install                                   # installs both workspaces

cp backend/.env.example backend/.env          # set DB_PASSWORD at minimum
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS dayflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

npm run migrate                               # applies backend/migrations/*.sql
npm run seed                                  # demo company: 1 admin, 1 HR, 1 manager, 10 employees, 2 months attendance
npm run dev                                   # API :4000 + Vite :5173 (proxies /api and /storage)
```

Open http://localhost:5173 and sign in with a [demo account](#-live-demo).

| Script (root) | What it does |
|---|---|
| `npm run dev` | Runs backend (`ts-node-dev`) and frontend (Vite) concurrently |
| `npm run build` | `tsc` for the API → `backend/dist`, `tsc && vite build` for the SPA → `frontend/dist` |
| `npm test` | Jest: leave/payroll engines + DB-free API contract tests (supertest) |
| `npm run e2e` | Playwright smoke suite against `BASE_URL` (defaults to production) — `npm run e2e:install` once for Chromium |
| `npm run migrate` / `npm run seed` | Schema + demo data against whatever `backend/.env` (or `DATABASE_URL`) points at |

---

## 🏗 Architecture

```mermaid
flowchart LR
  subgraph Client["Browser"]
    SPA["React 18 + Vite<br/>React Router · AuthContext · fetch wrapper"]
  end
  subgraph Vercel["Vercel"]
    FE["Static SPA<br/><code>frontend/</code>"]
    API["Express on Vercel Functions<br/><code>backend/api/index.ts</code>"]
  end
  DB[("MySQL 8<br/>Railway / any host")]
  Mail["SMTP / jsonTransport"]
  SPA -- "HTTPS · Bearer JWT · JSON" --> API
  FE -.serves.-> SPA
  API -- "mysql2 pool · parameterized SQL · transactions" --> DB
  API -. "nodemailer" .-> Mail
```

**Backend layering:** `routes → middleware (auth · RBAC · rate-limit · audit) → service (business rules, SQL) → MySQL`. No ORM — every query is hand-written, parameterized and lives next to the feature it serves.

**Frontend:** pages per route, a single `AuthContext`, a 40-line `api()` fetch wrapper with single-flight refresh-token retry, and a small component kit (`Toast`, `Skeleton`, `PageHeader`, `AnimatedNumber`, `CustomCursor`, `PageTransition`). Styling is plain CSS on design tokens — no Tailwind, no component library.

### Repository layout

```
.
├── backend/
│   ├── api/index.ts            # Vercel entry — exports the Express app
│   ├── migrations/001_initial.sql
│   ├── src/
│   │   ├── app.ts              # middleware, routes, error handler
│   │   ├── server.ts           # local long-running server (app.listen)
│   │   ├── config/env.ts       # env parsing (DATABASE_URL or DB_*), serverless defaults
│   │   ├── db/                 # pool, migrate, seed, serverless bootstrap
│   │   ├── middleware/         # auth (JWT), rateLimit, audit, errorHandler
│   │   ├── features/<name>/    # <name>.routes.ts + <name>.service.ts
│   │   ├── utils/              # errors, validators, helpers, json, mailer
│   │   └── __tests__/          # leave.test.ts, payroll.test.ts
│   └── vercel.json
├── frontend/
│   ├── src/
│   │   ├── pages/              # SignIn, SignUp, Directory, Profile, Attendance, Leave, Payroll, Settings, Notifications, Dashboard
│   │   ├── components/         # Header, Toast, CustomCursor, PageTransition, AuthHero, …
│   │   ├── hooks/              # useReveal, useRipple
│   │   ├── context/AuthContext.tsx
│   │   ├── utils/api.ts
│   │   └── styles/             # tokens.css (design tokens + motion), global.css
│   └── vercel.json             # SPA rewrite
├── docs/banner.png
└── package.json                # npm workspaces
```

### Design decisions

| Decision | Why |
|---|---|
| Raw SQL via `mysql2`, no ORM | Payroll and leave maths need explicit transactions and predictable queries; the schema is small enough that an ORM adds more than it removes. |
| JWT access (15 m) + rotating refresh (7 d) in `localStorage`, refresh tokens persisted server-side | Stateless API that still supports logout-everywhere; the SPA retries once on `401` via a single-flight refresh. |
| Login ID generated server-side, `[CC][FFLL][YYYY][NNNN]` | Human-readable, unique per company/year, allocated atomically through a `join_serials` counter row. |
| Soft lifecycle states, `FOREIGN KEY … RESTRICT` | HR data is never hard-deleted — audits and payslips must stay referentially intact. |
| Effective-dated `salary_structures`, `payslips` unique per (employee, month) | Salary history is preserved; payroll runs are idempotent and lockable with `finalized_at`. |
| Serverless bootstrap (`AUTO_MIGRATE`) | A fresh deployment becomes usable on its first request without a shell into the DB host. |
| CSS-only motion, `prefers-reduced-motion` kill switch | Zero animation dependencies; one media query disables everything for users who need it. |

---

## ⚙️ Configuration

All variables are read in [`backend/src/config/env.ts`](backend/src/config/env.ts); every one has a sane local default.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | `mysql://user:pass@host:3306/db[?ssl=true]`. Overrides the `DB_*` set below when present. |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | `localhost` `3306` `root` `""` `dayflow` | Discrete connection settings |
| `DB_SSL` | `false` | `true` for hosts that require TLS (Aiven, PlanetScale, TiDB). Railway's TCP proxy does **not**. |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | dev placeholders | **Must** be set in production — 32+ random chars each |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Token lifetimes |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allow-list. If any entry ends in `.vercel.app`, Vercel preview URLs are also allowed. |
| `STORAGE_PATH` | `./storage` (`/tmp/dayflow-storage` on Vercel) | Uploads and payslip PDFs |
| `AUTO_MIGRATE` | `false` | Apply `migrations/*.sql` on the first request if the schema is missing |
| `AUTO_SEED` | `false` | Also load the demo company during that bootstrap |
| `NODE_ENV` | `development` | Environment label (also used by Sentry) |
| `STORAGE_DRIVER` | `local` | `s3` for AWS S3 / Cloudflare R2 / MinIO — then set `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (R2/MinIO), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| `RESEND_API_KEY` / `SMTP_URL` | — | Email delivery. Neither set → emails are logged only (`/api/health` → `drivers.mail`) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | — | Shared rate limiting across serverless instances; memory fallback otherwise |
| `SENTRY_DSN` | — | Error monitoring; requests carry `X-Request-Id` for correlation |
| `EMAIL_FROM` | `noreply@dayflow.local` | Sender address |
| `PORT` | `4000` | Local server only |

Frontend: `VITE_API_URL` (build-time, no trailing slash). Unset → same-origin, which the Vite dev proxy handles.

---

## 📡 API reference

Base URL: `/api`. Every route except `auth/signup|login|refresh|forgot-password|reset-password` and `health` requires `Authorization: Bearer <accessToken>`. Responses are `{ data }` or `{ error: { code, message, details? } }`.

<details>
<summary><b>Auth</b> — <code>/api/auth</code></summary>

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/signup` | public | Creates company + first Admin, default departments/leave types/settings |
| POST | `/login` | public | `identifier` = Login ID or email |
| POST | `/refresh` | public | Rotates refresh token |
| POST | `/logout` | any | Revokes refresh token |
| GET | `/me` | any | Current user + employee/company context |
| POST | `/change-password` | any | Clears `must_change_password` |
| POST | `/forgot-password` · `/reset-password` | public | Token-based reset (token echoed in dev) |
| POST | `/employees` | ADMIN, HR | Creates user + employee, generates Login ID and temp password |
</details>

<details>
<summary><b>Employees</b> — <code>/api/employees</code></summary>

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/` | any (scoped) | `?search=&department=&page=&limit=` — employees see self, managers see reports, HR/Admin see all |
| GET | `/:id` · PATCH `/:id` | owner / HR / Admin | Field-level permissions enforced server-side |
| POST | `/:id/documents` | owner / HR / Admin | `multipart/form-data`, 5 MB cap |
| GET | `/:id/documents/:docId/download` | owner / HR / Admin | |
| POST / DELETE | `/:id/skills[/:skillId]` · `/:id/certifications[/:certId]` | owner / HR / Admin | |
| GET | `/departments/list` · POST `/departments` | any · ADMIN | |
</details>

<details>
<summary><b>Attendance</b> — <code>/api/attendance</code></summary>

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/check-in` · `/check-out` | any | One open session at a time; IP + UA recorded |
| GET | `/today` | any | Current state for the check-in widget |
| GET | `/` | scoped | `?date=` or `?month=` |
| GET | `/calendar` | scoped | Month grid / heat-map data |
| POST | `/regularizations` | any | Request a correction |
| GET | `/regularizations/list` | scoped | |
| POST | `/regularizations/:id/decide` | ADMIN, HR, MANAGER | `action: APPROVED \| REJECTED` |
</details>

<details>
<summary><b>Leave</b> — <code>/api/leave</code></summary>

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/types` · POST `/types` · PATCH `/types/:id` | any · ADMIN · ADMIN | |
| GET | `/balances` | scoped | `?year=` — computed live |
| GET | `/requests` · POST `/requests` | scoped · any | Overlap + balance validated |
| POST | `/requests/:id/cancel` | owner | Pending → cancelled; approved → cancellation requested |
| POST | `/requests/:id/decide` | ADMIN, HR, MANAGER | Approval writes `LEAVE` rows into attendance |
| GET | `/calendar` | scoped | Team leave calendar |
</details>

<details>
<summary><b>Payroll</b> — <code>/api/payroll</code></summary>

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/salary` | ADMIN, HR | Upsert effective-dated structure |
| GET | `/salary/:employeeId` | owner / HR / Admin | |
| GET | `/salary-structures/list` | ADMIN, HR | |
| POST | `/run` | ADMIN, HR | `{ month: 'YYYY-MM' }` — idempotent |
| POST | `/finalize` | ADMIN | Locks the month |
| GET | `/payslips` · `/payslips/:id` · `/payslips/:id/pdf` | scoped | PDF rendered with `pdfkit` |
</details>

<details>
<summary><b>Org, reports, notifications, audit, holidays</b></summary>

| Method | Path | Role |
|---|---|---|
| GET / PATCH | `/api/org-settings` | ADMIN |
| GET | `/api/holidays` · POST `/api/holidays` · DELETE `/api/holidays/:id` | any · ADMIN · ADMIN |
| GET | `/api/reports/dashboard-stats` · `/attendance-summary` · `/leave-utilization` · `/headcount` · `/late-arrivals` · `/export/attendance` | ADMIN, HR (manager-scoped where applicable) |
| GET | `/api/notifications` · POST `/:id/read` · POST `/read-all` | any |
| GET | `/api/audit-logs` | ADMIN (HR read) |
| GET | `/api/health` | public — `{ status, version, db: { host, port, name, ssl, fromUrl, serverless } }` |
</details>

**Error codes:** `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `DATABASE_UNAVAILABLE` 503 (includes the driver code, e.g. `ECONNREFUSED`) · `INTERNAL_ERROR` 500.
Rate limits are in-memory (login 20 / 15 min, auth 30 / 15 min) — move to Redis before scaling past one instance.

---

## 📐 Domain rules

### Roles

| Capability | Employee | Manager | HR | Admin |
|---|:--:|:--:|:--:|:--:|
| Own profile, attendance, leave, payslips | ✅ | ✅ | ✅ | ✅ |
| View all employees | — | direct reports | ✅ | ✅ |
| Approve leave / regularizations | — | direct reports | ✅ | ✅ |
| Create employees, salary structures, run payroll | — | — | ✅ | ✅ |
| Finalize payroll, org settings, holidays, leave types, departments | — | — | — | ✅ |
| Audit log | — | — | read | ✅ |

Manager scope is derived from `employees.manager_id`. Every route layers `authMiddleware` → `requireRole(...)` → record-level ownership checks; the client is never trusted.

### Attendance
- A day is **Present** at ≥ 8 h, **Half-day** at < 4 h (both configurable in org settings); arrivals after the grace period are flagged late.
- Timestamps are stored in UTC and rendered in the company timezone.
- Approved leave writes `LEAVE` attendance rows so payroll never double-counts.

### Leave
- Balances are computed on read: `allocation − approved days in year`, excluding week-off days and company holidays.
- Unpaid leave is always allowed; paid types reject when the balance is insufficient or dates overlap an existing request.
- `PENDING → APPROVED | REJECTED`, plus `CANCELLED` / `CANCELLATION_REQUESTED` for post-approval changes. Approval mode is `SINGLE` or `MULTI` per company.

### Payroll
- Default structure: Basic = 50 % of wage · HRA = 50 % of Basic · Standard = ₹4 167 · Bonus = 8.33 % of Basic · LTA = 8.33 % of Basic · Fixed = remainder. Deductions: PF 12 % of Basic (employee + employer), Professional Tax ₹200. All rates are configurable.
- Monthly run prorates gross by `payableDays / totalWorkingDays`, where payable days come from attendance (absent and unpaid leave reduce them).
- Re-running a month overwrites unfinalized payslips; `finalize` sets `finalized_at` and blocks further runs and attendance edits without Admin override.

### Login IDs
`[CC][FFLL][YYYY][NNNN]` → company initials · first two letters of first and last name · join year · per-company, per-year serial (`OIJODO20220004`). Allocated inside a transaction against `join_serials`.

---

## 🗄 Data model

Schema lives in `backend/migrations/*.sql` (MySQL 8, InnoDB, `utf8mb4`). `001` creates the base schema; later files are idempotent and tracked in a `schema_migrations` ledger, applied by `npm run migrate` or automatically by the serverless bootstrap (`AUTO_MIGRATE=true`).

`companies` · `departments` · `users` · `join_serials` · `employees` · `employee_documents` · `employee_skills` · `employee_certifications` · `attendances` *(unique employee_id, date)* · `holidays` · `leave_types` · `leave_balances` · `leave_requests` · `regularizations` · `salary_structures` *(unique employee_id, effective_from)* · `payslips` *(unique employee_id, month)* · `notifications` · `audit_logs` *(append-only)* · `org_settings` · `refresh_tokens` · `password_reset_tokens`

Conventions: money is `DECIMAL(12,2)`; dates/times are UTC `DATETIME`; JSON columns for payslip breakdowns and audit before/after snapshots (`parseJsonColumn` handles driver differences); every FK is indexed and `RESTRICT`ed.

---

## ☁️ Deployment

The monorepo deploys as **two Vercel projects**; MySQL is hosted anywhere reachable over TCP.

| Project | Root | Build | Production |
|---|---|---|---|
| `frontend` | `frontend/` | `tsc && vite build` → static | https://frontend-iota-two-70.vercel.app |
| `dayflow-api` | `backend/` | `@vercel/node` bundles `api/index.ts` | https://dayflow-api.vercel.app |

### First-time setup

```bash
# 1. Database — any MySQL 8 (Railway, Aiven, PlanetScale, TiDB Cloud, RDS). Copy its mysql:// URL.

# 2. API project
cd backend
vercel link --project dayflow-api
printf '%s' 'mysql://user:pass@host:port/db' | vercel env add DATABASE_URL production   # pipe → no interactive prompt
openssl rand -base64 48 | vercel env add JWT_SECRET production
openssl rand -base64 48 | vercel env add JWT_REFRESH_SECRET production
printf 'https://<frontend-domain>,http://localhost:5173' | vercel env add CORS_ORIGIN production
printf 'production' | vercel env add NODE_ENV production
printf 'true' | vercel env add AUTO_MIGRATE production
printf 'true' | vercel env add AUTO_SEED production          # omit for a real tenant
vercel --prod

# 3. Frontend project
cd ../frontend
vercel link --project frontend
printf 'https://<api-domain>' | vercel env add VITE_API_URL production
vercel --prod                                                # VITE_* is baked in at build time — redeploy after changing it
```

The first request to the API creates the schema (and seeds, if enabled). Check `GET /api/health` — `db.host` should be your MySQL host, not `localhost`.

### Caveats on serverless
- **Files are ephemeral unless `STORAGE_DRIVER=s3`.** With the default `local` driver, uploads and payslip PDFs land in `/tmp` and vanish on cold start (payslips are regenerated on demand). Point it at S3 / Cloudflare R2 for persistence — no code change.
- The MySQL pool is capped at **5 connections** on Vercel so a burst of cold starts can't exhaust a small hosted plan.
- Rate limiting is per-instance memory unless Upstash Redis is configured.
- `server.ts` (long-running) and `api/index.ts` (serverless) share the same `app` — run `node backend/dist/server.js` behind a reverse proxy if you'd rather deploy to a VM or container.

---

## 🔗 LinkedIn integration

Users can connect their own LinkedIn account (Profile → **LinkedIn** tab), see the profile LinkedIn returns for them, and publish posts from Dayflow. Official LinkedIn OAuth 2.0 / REST APIs only — no scraping, no unofficial endpoints, and tokens never leave the server.

```
LinkedIn OAuth (server-side, CSRF-protected state)
     ├── Profile information   ← Sign In with LinkedIn using OpenID Connect  (openid profile email → GET /v2/userinfo)
     │      ├── name, first / last name, picture, email, member id / URN
     │      └── public profile URL — NOT available (needs r_basicprofile, partner-only) → shown as "not provided"
     └── Share on LinkedIn      ← w_member_social  (POST /rest/posts)
            ├── text post
            ├── article / URL share
            └── image — not implemented (needs the Images API flow; document before enabling)
```

### 1. Create the LinkedIn app
1. https://www.linkedin.com/developers/apps → **Create app** (needs a LinkedIn Page to associate).
2. **Products** tab → request **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn** (both self-serve).
3. **Auth** tab → copy *Client ID* / *Client Secret*, and add the redirect URLs:
   - `http://localhost:4000/api/linkedin/callback` (local)
   - `https://dayflow-api.vercel.app/api/linkedin/callback` (production)

### 2. Environment variables (API)

| Variable | Required | Notes |
|---|---|---|
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | yes | From the Auth tab. Unset → the feature shows "not configured" and all routes 503. |
| `LINKEDIN_REDIRECT_URI` | yes | Must match the Auth tab **exactly** (scheme, host, path). |
| `FRONTEND_URL` | recommended | Where the callback sends the browser back (`/linkedin/return`). Defaults to the first `CORS_ORIGIN`. |
| `LINKEDIN_TOKEN_KEY` | optional | 32-byte hex/base64 key for encrypting stored tokens (AES-256-GCM). Defaults to a key derived from `JWT_SECRET`. |
| `LINKEDIN_API_VERSION` | optional | `YYYYMM` for the versioned Posts API (default `202601`). LinkedIn sunsets versions after ~1 year; a `426` response means bump it. |

Production (pipe values — never paste secrets into chat or commit them):
```bash
cd backend
printf '%s' '<client id>'     | vercel env add LINKEDIN_CLIENT_ID production
printf '%s' '<client secret>' | vercel env add LINKEDIN_CLIENT_SECRET production
printf 'https://dayflow-api.vercel.app/api/linkedin/callback' | vercel env add LINKEDIN_REDIRECT_URI production
printf 'https://frontend-iota-two-70.vercel.app' | vercel env add FRONTEND_URL production
vercel --prod
```
Local: add the same keys to `backend/.env`. The `linkedin_accounts` table is created by `npm run migrate` (migration `002_linkedin.sql`, idempotent) or automatically by the serverless bootstrap.

### 3. Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/linkedin/status` | user | `{ configured, connected, profile }` — never includes tokens |
| GET | `/api/linkedin/connect` | user | Returns the LinkedIn authorization URL (state = 10-min JWT bound to the user) |
| GET | `/api/linkedin/callback` | public | LinkedIn redirect target → exchanges code, stores profile + encrypted token, redirects to `FRONTEND_URL/linkedin/return?status=…` |
| POST | `/api/linkedin/disconnect` | user | Best-effort token revoke at LinkedIn, then deletes the row |
| POST | `/api/linkedin/posts` | user | `{ text (≤3000), url?, title? }` → publishes; returns `{ postUrn, url }` |

Error codes: `LINKEDIN_NOT_CONFIGURED` 503 · `LINKEDIN_NOT_CONNECTED` 400 · `LINKEDIN_INVALID_STATE` 400 · `LINKEDIN_DENIED` (callback) · `LINKEDIN_ALREADY_LINKED` 409 · `LINKEDIN_TOKEN_INVALID` 401 · `LINKEDIN_PERMISSION` 403 · `LINKEDIN_RATE_LIMITED` 429 · `LINKEDIN_API_VERSION` / `LINKEDIN_API_ERROR` 502 · `LINKEDIN_TIMEOUT` 504.

### 4. Testing
- **Disconnected / unconfigured:** open Profile → LinkedIn with the env vars unset — the card explains it's not configured; with them set it shows *Connect LinkedIn*.
- **OAuth failure:** hit `/api/linkedin/callback?state=bogus` → redirected to `/linkedin/return?status=error&code=LINKEDIN_INVALID_STATE`; decline on LinkedIn's consent screen → `code=LINKEDIN_DENIED`.
- **Connected:** after consent you land on the profile's LinkedIn tab with name, picture, URN and permissions; audit log records `LINKEDIN_CONNECT`.
- **Posting:** the composer publishes a text post; add a URL to test the article share. Errors (expired token, missing scope, rate limit) surface as toasts.

### 5. Limitations
- Access tokens last 60 days and standard apps get **no refresh token** — the UI shows *Connection expired* with a Reconnect button.
- Only the authenticated member's own profile is ever read; there is no lookup of other people.
- The LinkedIn picture URL is a short-lived CDN link — it's re-fetched on every reconnect.

## 🛠 Operations runbook

| Symptom | Likely cause | Fix |
|---|---|---|
| `DATABASE_UNAVAILABLE (ECONNREFUSED)` from the API | `DATABASE_URL` empty/invalid — API fell back to `localhost` | `vercel env rm DATABASE_URL production --yes`, re-add by **piping** the value (the interactive prompt can store an empty string), redeploy |
| `DATABASE_UNAVAILABLE (HANDSHAKE_NO_SSL_SUPPORT)` | `DB_SSL=true` against a non-TLS proxy (e.g. Railway) | Remove `DB_SSL` / `?ssl=true` |
| `DATABASE_UNAVAILABLE (ER_ACCESS_DENIED_ERROR)` locally | `DB_PASSWORD` missing from `backend/.env` | Set it (the file is git-ignored) |
| Sign-in works on the API but the SPA says "Cannot reach the server" | `VITE_API_URL` unset or changed without a rebuild | Set it, then `vercel --prod` in `frontend/` |
| CORS error in the browser | Frontend origin not in `CORS_ORIGIN` | Add it (comma-separated), redeploy the API |
| Tables missing after deploy | `AUTO_MIGRATE` not `true` | Set it, or run `DATABASE_URL=… npm run migrate` locally |
| Demo data on a real tenant | `AUTO_SEED=true` left on | Set to `false`; drop the seeded company |

Rotate a leaked DB password: regenerate it at the host → `vercel env rm DATABASE_URL production --yes` → re-add → `vercel --prod`.

---

## 🧪 Testing & quality

```bash
npm test                              # Jest: leave balance engine + payroll maths (14 tests)
npx tsc --noEmit -p backend           # strict type-check, API
npx tsc --noEmit -p frontend          # strict type-check, SPA
```

- TypeScript `strict` everywhere; `any` is tolerated only on raw DB rows.
- Tests target the two places where money or entitlement can silently go wrong: proration/rounding in payroll and weekend/holiday exclusion in leave balances.
- Security baseline: `helmet`, strict CORS allow-list, bcrypt password hashes, parameterized SQL only, rotating refresh tokens stored server-side, per-route RBAC plus ownership checks, consistent error envelope with no stack leakage, append-only audit trail.

---

## 🎨 Front-end design system

Tokens in [`frontend/src/styles/tokens.css`](frontend/src/styles/tokens.css) — colour (`--accent: #5B5BF6`, semantic success/warn/danger), radii, shadows, spacing, type (`Plus Jakarta Sans` display, `Inter` UI).

Motion is CSS-first and opt-out by default:

| Piece | Where |
|---|---|
| Custom cursor — dot + lagging ring, grows over interactive elements, becomes a caret over inputs; fine-pointer devices only | `components/CustomCursor.tsx` |
| Route transitions (fade + rise), scroll-to-top | `components/PageTransition.tsx` |
| Staggered reveals via `--i` custom property, scroll reveal with `IntersectionObserver` + `MutationObserver` for late-mounted content | `tokens.css`, `hooks/useReveal.ts` |
| Animated counters and bar growth on the dashboard | `components/AnimatedNumber.tsx`, `.bar-grow` |
| Button ripple (one document-level listener) and press states | `hooks/useRipple.ts` |
| Toast stack with progress bar | `components/Toast.tsx` (`useToast()`) |

`@media (prefers-reduced-motion: reduce)` disables every animation and transition in one rule.

---

## 🤝 Contributing

1. Branch from `main`; keep PRs focused (one feature or fix).
2. Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
3. New backend behaviour goes in `features/<name>/<name>.service.ts` with the route as a thin adapter; add a test if money, dates or permissions are involved.
4. `npm run build && npm test` must pass. Type errors are CI failures, not warnings.
5. Never commit `.env`, `.env.local`, or anything under `storage/`.

### Roadmap
- Image posts on LinkedIn (Images API), scheduled posts
- Refresh-token cache in Redis, device/session management UI
- SSO (SAML/OIDC), biometric integrations, tax filing — explicitly out of scope for v2

---

## 📄 License

No license file has been added yet — all rights reserved by default. Dayflow is a portfolio-grade reference implementation; review security and compliance requirements before using it with real employee data.
