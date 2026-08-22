# Dayflow — Human Resource Management System

> **Every workday, perfectly aligned.**  
> Web-based HRMS for onboarding, profiles, attendance, leave, payroll, approvals, and audit — with self-service, approval-driven writes, and least-privilege RBAC.

**Stack (per §6 constraints):** MySQL 8 (InnoDB, utf8mb4) · Node + TypeScript + Express only · React + TypeScript + Vite · Plain CSS/CSS Modules (design tokens, no UI kit) · `mysql2`, `bcryptjs`, `jsonwebtoken`, `nodemailer`, `pdfkit`, `dotenv` only.

---

## 1. Setup in ≤5 commands

```bash
# 1 — clone / copy project and install
npm install
npm install --workspace=backend
npm install --workspace=frontend

# 2 — configure env (copy & edit if needed)
cp backend/.env.example backend/.env

# 3 — create DB + run migrations
mysql -u root -e "CREATE DATABASE IF NOT EXISTS dayflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run migrate --workspace=backend

# 4 — seed demo data (1 admin, 1 HR, 1 manager, 10 employees, 2 months attendance)
npm run seed --workspace=backend

# 5 — run (backend :4000, frontend :5173 with proxy)
npm run dev
# or separately:
# npm run dev --workspace=backend   → http://localhost:4000/api/health
# npm run dev --workspace=frontend  → http://localhost:5173
```

Build for prod:

```bash
npm run build --workspace=backend   # tsc → dist/
npm run build --workspace=frontend  # vite → dist/
node backend/dist/server.js
npx vite preview --workspace=frontend --port 4173
```

Test (leave-balance & payroll math — the two bug magnets):

```bash
npm test --workspace=backend
```

---

## 2. Env vars

| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | `4000` | Backend port |
| `NODE_ENV` | `development` | `development` uses jsonTransport for mail (logs to console) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `localhost:3306` / `root` / `dayflow` | MySQL connection |
| `JWT_SECRET` | — | HMAC for access token (15m) — change in prod (32+ chars) |
| `JWT_REFRESH_SECRET` | — | HMAC for refresh token (7d) |
| `JWT_EXPIRES_IN` | `15m` | Access expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh expiry |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |
| `STORAGE_PATH` | `./storage` | Local disk for uploads & payslip PDFs |
| `EMAIL_FROM` | `noreply@dayflow.local` | From address |

---

## 3. Architecture sketch

```
┌─────────────────┐      httpOnly cookies / JWT (Bearer)       ┌─────────────────────┐
│ React + Vite    │ ───────────────────────────────────────► │ Express + TS        │
│ plain CSS       │ ◄─────────────────────────────────────── │  /api/auth          │──► MySQL 8 (InnoDB)
│ tokens.css      │      JSON { data } / { error:{code}}     │  /api/employees     │    utf8mb4, DECIMAL(12,2),
│ useApi(fetch)   │                                          │  /api/attendance    │    FK RESTRICT, (emp,date) unique,
│ React Router    │                                          │  /api/leave         │    composite indexes, transactions
└─────────────────┘                                          │  /api/payroll       │    JSON columns for components
         ▲                                                   │  /api/reports      │
         │ proxy /api + /storage                             │  /api/holidays etc  │
         └───────────────────────────────────────────────────┘└─────────────────────┘
```

**Layering (backend):** `routes → middleware (auth, RBAC, rateLimit, audit) → controller (routes) → service (pure business rules) → repository (raw parameterized SQL in service, no ORM)`.  
**Frontend layers:** `pages/*` (route) + `context/AuthContext` + `utils/api` (thin fetch wrapper) + hand-rolled components: Button, Card, Modal, Table, Toast, Skeleton.

---

## 4. Roles & permissions (server-enforced, never trust client)

| Capability | Employee | HR Officer | Admin | Manager* |
|---|---|---|---:|---|
| view own profile/attendance/leave/payslips | ✅ | ✅ | ✅ | ✅ |
| view all employees | ❌ | ✅ | ✅ | reports only |
| approve leave/regularization | ❌ | ✅ | ✅ | direct reports |
| salary structures / payroll run | ❌ | ✅ if granted | ✅ | ❌ |
| manage roles/settings/holidays/audit | ❌ | read audit | ✅ | ❌ |

*Manager = `Employee.manager_id` self-reference; scoped via `manager_id == me`.

All API routes use `authMiddleware` + `requireRole(...)` + record-level ownership checks (`employeeId == session.userId`).

---

## 5. Key flows

**Company signup → first Admin:** `POST /api/auth/signup` creates `Company` (initials feed loginId) + default departments, leave types (Paid 18, Sick 7…), org settings, holidays. Returns JWT. **Employees are not self-registered** — Admin/HR `POST /api/auth/employees` auto-generates Login ID `[CC][FFLL][YYYY][NNNN]` (e.g. `OIJODO20220001`), serial resets per year per company, atomic via `join_serials`, emails temp password, forces change.

**Attendance:** `checkIn → checkout must follow; one open at a time; auto-close at day end; Half-day <4h, Present ≥8h (configurable), late-flag after grace, UTC storage + org timezone render, IP/device audit, CSV export, heat-map.

**Leave engine:** Apply → `PENDING → APPROVED/REJECTED` (+ `CANCELLED`/`CANCELLATION_REQUESTED`). Balance computed live excluding weekends/holidays (configurable weekOffDays), overlap detection, Unpaid always allowed, multi-level toggle (`SINGLE`/`MULTI`), approval instantly syncs `attendances` LEAVE rows.

**Payroll:** Effective-dated `salary_structures` (history preserved). Spec §3A.4: Basic 50% wage, HRA 50% Basic, Standard 4167, Bonus 8.33% Basic, LTA 8.33% Basic, Fixed = remainder; PF 12% Basic (both sides), PT ₹200, all configurable. Monthly run prorates gross by `payableDays/totalDays` (payable derives from attendance; unpaid/absent reduces it), generates `payslips` with `breakdown` JSON + PDF via `pdfkit`, idempotent, `finalized_at` lock.

**Notifications & reports:** In-app + email (nodemailer jsonTransport in dev) for leave applied/decided, payslip published, security events; `reports/*` (attendance summary, leave utilization, headcount, late-arrivals, CSV exports, dashboard-stats).

---

## 6. Data model (MySQL DDL — `backend/migrations/001_initial.sql`)

Tables: `companies, departments, users, join_serials, employees, employee_documents, employee_skills, employee_certifications, attendances (unique employee_id,date), holidays, leave_types, leave_balances, leave_requests, regularizations, salary_structures (unique emp,effective_from), payslips (unique emp,month), notifications, audit_logs (append-only), org_settings, refresh_tokens, password_reset_tokens`. All money `DECIMAL(12,2)`, `DATETIME` UTC, FK `RESTRICT` (exits via lifecycle states, never hard-delete), indexes on every FK + `(employee_id, date)` & `(employee_id, month)`.

---

## 7. API

Base `http://localhost:4000/api`

| Group | Examples |
|-------|----------|
| Auth | `POST /auth/signup` `POST /auth/login` `POST /auth/refresh` `POST /auth/forgot-password` `POST /auth/change-password` `GET /auth/me` `POST /auth/employees` |
| Employees | `GET /employees?search=&page=` `GET /employees/:id` `PATCH /employees/:id` `POST /employees/:id/documents` `POST /employees/:id/skills` |
| Attendance | `POST /attendance/check-in|check-out` `GET /attendance/today` `GET /attendance?date=…&month=…` `POST /attendance/regularizations` |
| Leave | `GET /leave/types` `GET /leave/balances?year=` `POST /leave/requests` `POST /leave/requests/:id/decide` `GET /leave/calendar` |
| Payroll | `POST /payroll/salary` `POST /payroll/run` `POST /payroll/finalize` `GET /payroll/payslips` `GET /payroll/payslips/:id/pdf` |
| Other | `GET /holidays` `GET+PATCH /org-settings` `GET /notifications` `GET /reports/*` `GET /audit-logs` |

Rate limit: in-memory (login 20/15m, auth 30/15m) — swap to MySQL/Redis for multi-instance.

---

## 8. Dependency justification (§6 allow-list)

| Package | Why allowed |
|---------|-------------|
| `express` | Sole backend framework (per spec) |
| `mysql2` | Official MySQL driver |
| `bcryptjs` | Password hashing (spec: bcrypt/argon2; pure-JS avoids native build) |
| `jsonwebtoken` | JWT access+refresh (spec allows) |
| `nodemailer` | Email (spec) — `jsonTransport` in dev, no extra provider |
| `pdfkit` | Payslip PDF (one PDF lib allowed) |
| `dotenv` | Env loading |
| `cors`, `helmet`, `cookie-parser`, `multer`, `uuid` | Security & file upload essentials (minimal, documented) |
| `react`, `react-dom`, `react-router-dom`, `vite` | Frontend core (one router dep allowed) |

Validation, rate limiting, RBAC, pagination, audit logging, `useApi` — all in-house (no zod/joi, no TanStack Query).

Charts: hand-rolled SVG bars/lines; animations: CSS-only (no lib), respects `prefers-reduced-motion`; tokens in `frontend/src/styles/tokens.css`; motion: 150–250ms ease-out/in, staggered cards, skeleton shimmer, check-in pulse.

---

## 9. Demo credentials (after `npm run seed`)

| Role | Email / Login ID | Password |
|------|------------------|----------|
| Admin | `admin@dayflow.local` / `OIARME20220001` | `Password123` |
| HR | `hr@dayflow.local` / `OIPRSH20220002` | `Password123` |
| Manager | `vikram.singh@dayflow.local` / `OIVISI20220003` | `Password123` |
| Employee | `john.doe@dayflow.local` / `OIJODO20220004` | `Password123` |

Login supports **Login ID or Email** + password.

---

## 10. Security & quality

- `helmet`, `cors` credentials, httpOnly cookies, parameterized SQL, input validation, output encoding, `AppError` hierarchy → consistent `{ error:{code,message} }`, no stack leak, audit log (actor, action, entity, before/after, IP, UA).
- Paginated lists, indexed queries, P95 <300ms at 1k employees (target), daily backups via `mysqldump`, idempotent payroll (re-run safe + `finalized_at` lock).
- TypeScript strict, no `any` (except DB rows), feature-folder layout, shared types, small pure functions, early returns, ESLint+Prettier (commit config pending).

---

## 11. Out of scope (v2)

Biometrics, tax filing, OKRs, ATS, native mobile, SAML/OIDC — noted as future.

---

**Env:** Node 20+, MySQL 8.x (`utf8mb4`), macOS/Linux.  
**Why MySQL:** Owner hard constraint; schema uses `DATETIME` UTC, `DECIMAL` for money, transactions for payroll & leave balance updates.

## 12. Deployment (Vercel, two projects)

The frontend and the API deploy as **two separate Vercel projects** from this monorepo. The API runs as a serverless function (`backend/api/index.ts` exports the Express app); the frontend is a static Vite build.

| Project | Root directory | Production URL |
|---|---|---|
| `frontend` | `frontend/` | https://frontend-iota-two-70.vercel.app |
| `dayflow-api` | `backend/` | https://dayflow-api.vercel.app (see the Vercel dashboard for the exact alias) |

### 12.1 Hosted MySQL
Vercel has no database — create a MySQL 8 instance on any host (Aiven, Railway, PlanetScale, TiDB Cloud, AWS RDS). Most require TLS: set `DB_SSL=true` (or pass `?ssl=true` in `DATABASE_URL`).

### 12.2 API env vars (`dayflow-api` project → Settings → Environment Variables)
| Var | Value |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/dayflow?ssl=true` — **or** the discrete `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` |
| `DB_SSL` | `true` for hosted MySQL |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | two random 32+ char strings (`openssl rand -base64 32`) |
| `CORS_ORIGIN` | `https://frontend-iota-two-70.vercel.app,http://localhost:5173` (comma-separated; `*.vercel.app` previews are auto-allowed when a `.vercel.app` origin is listed) |
| `NODE_ENV` | `production` |
| `AUTO_MIGRATE` | `true` — on the first request the API applies `migrations/*.sql` if the `users` table is missing (`backend/src/db/bootstrap.ts`) |
| `AUTO_SEED` | `true` to also load the demo company/users on that first bootstrap (set to `false` for a real tenant) |

Via CLI from `backend/`: `vercel env add DATABASE_URL production` (repeat per var), then `vercel --prod`.

### 12.3 Migrate + seed the hosted DB manually (only if `AUTO_MIGRATE` is off)
```bash
cd backend && DATABASE_URL='mysql://user:pass@host:3306/dayflow?ssl=true' npm run migrate
cd backend && DATABASE_URL='mysql://user:pass@host:3306/dayflow?ssl=true' npm run seed
```

### 12.4 Frontend env var (`frontend` project)
`VITE_API_URL=https://<your-api-domain>.vercel.app` (no trailing slash). It's baked in at build time, so **redeploy the frontend after changing it**: `cd frontend && vercel --prod`.

### 12.5 Caveats on serverless
- **File storage is ephemeral.** Uploads and generated payslip PDFs are written to `/tmp` on the function instance and disappear on cold start. For persistent files, swap `multer.diskStorage` / `fs.createWriteStream` for an object store (S3/R2) — out of scope for v2.
- The MySQL pool is capped at 5 connections on Vercel (`backend/src/db/pool.ts`) to avoid exhausting small hosted plans.
- Access tokens expire in 15m; the frontend transparently refreshes once on a `401` (`frontend/src/utils/api.ts`).

## 13. UI motion system (v2.1)
- Custom cursor (dot + lagging ring, magnetic over interactive elements) — `frontend/src/components/CustomCursor.tsx`; fine-pointer only.
- Route transitions, staggered card reveals (`.fade-up` + `--i`), scroll reveal (`useReveal`), animated stat counters, button ripple, toasts (`useToast`).
- Everything honours `prefers-reduced-motion` — the kill switch in `frontend/src/styles/tokens.css` disables all animation/transition.

