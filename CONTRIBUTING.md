# Contributing to Dayflow

Thanks for helping build Dayflow. This guide gets you from clone to merged PR in under an hour.

## 1. One-time setup (≈5 min)
```bash
git clone https://github.com/vardhan23v/Human-Resource-Management-System.git
cd Human-Resource-Management-System
npm install
cp backend/.env.example backend/.env        # set DB_PASSWORD for your local MySQL
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS dayflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run migrate && npm run seed
npm run dev                                  # API :4000 · SPA :5173
```
Sign in with `admin@dayflow.local` / `Password123` (see README for other demo roles).

No local MySQL? Point `backend/.env` at any hosted MySQL via `DATABASE_URL=mysql://…`.

## 2. Branch → PR flow
1. Pick an issue (or open one). Comment "taking this" so two people don't do the same thing.
2. Branch from `main`: `git checkout -b feat/<short-name>` (or `fix/`, `docs/`, `test/`).
3. Commit with **Conventional Commits**: `feat: payroll table uses DataTable`, `fix: contrast on LinkedIn card in dark mode`, `test: CSV import modal e2e`.
4. Before pushing, run the same checks CI runs:
   ```bash
   npx tsc --noEmit -p backend && npm run build --workspace=frontend && npm test
   ```
5. Push and open a PR against `main`. Fill in *what / why / how tested*; attach a screenshot for UI changes (light **and** dark mode).
6. One approval + green CI → squash-merge. Keep PRs small (one issue each).

## 3. Where things live
| You want to… | Look in |
|---|---|
| Add/modify an API route | `backend/src/features/<area>/<area>.routes.ts` (thin) + `<area>.service.ts` (logic, SQL) |
| Validate a request body | `backend/src/utils/schemas.ts` (Zod) + `validate()` middleware |
| Change the schema | new idempotent file `backend/migrations/NNN_*.sql` (never edit `001`) |
| Add a page | `frontend/src/pages/*.tsx` + route in `frontend/src/App.tsx` + nav link in `components/Header.tsx` / `MobileNav.tsx` |
| Reusable UI | `frontend/src/components/` — use `Modal`, `FormField`, `PasswordInput`, `EmptyState`, `Avatar`, `PageHeader` before writing new ones |
| Colours / spacing / motion | `frontend/src/styles/tokens.css` (never hard-code colours — use `var(--…)` so dark mode keeps working) |
| Tests | `backend/src/__tests__/*.test.ts` (Jest) · `e2e/*.spec.ts` (Playwright, `npm run e2e`) |
| API docs | `backend/src/docs/openapi.ts` — update when you add a route |

## 4. Code conventions
- TypeScript `strict`; `any` only on raw DB rows.
- Every query parameterised (`?` placeholders). Never string-concatenate user input into SQL.
- Every route: `authMiddleware` → `requireRole(...)` where relevant → ownership check in the service.
- Errors: throw `AppError` subclasses; never `res.status(500)` by hand.
- UI: tokens only, `fade-up`/`reveal` for motion, works at 375 px and in dark mode, keyboard reachable.
- No secrets in code or commits. `.env*` is git-ignored; production values go in Vercel env vars.

## 5. Good first issues
See the **good first issue** label on GitHub. Each one names the files to touch and the acceptance criteria.

## 6. Team
| Name | GitHub | Focus |
|---|---|---|
| Sree Vardhan V | @vardhan23v | Architecture, backend, deployment |
| Srujan Pattar | _add handle_ | Frontend components & tests |
| Thirshul | _add handle_ | UX polish, docs, e2e |
