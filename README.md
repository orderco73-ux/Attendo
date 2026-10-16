# Attendo nosait — نظام إدارة الحضور الجامعي

Arabic-first (RTL) university attendance platform: academic structure, students (no student accounts),
Excel import, subjects & enrollment, lecture scheduling, attendance sessions (manual / scheduled),
location / QR / staff-assisted attendance, public student inquiry, reports & Excel exports.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Radix primitives · MongoDB Atlas + Mongoose 9 · Vercel**.

Docs: [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [Security](docs/SECURITY.md) · [Plan & checklist](docs/IMPLEMENTATION_PLAN.md)

---

## 1. Quick start (local, no Atlas needed)

Requirements: Node.js ≥ 20.9 (tested on 24), npm.

```bash
npm install
npm run build
npm run dev:memory -- --prod     # or: npm run dev:memory   (dev mode, hot reload)
```

`dev:memory` starts an **in-memory MongoDB** (data under `.tmp/`, deleted on exit), seeds the initial
structure plus demo data, creates a local admin and starts Next on http://localhost:3000.

| Local demo account | Email | Password |
|---|---|---|
| Admin | `admin@demo.local` | `Admin@123456` |
| Doctor (subject PE101) | `doctor@demo.local` | `Demo@12345` |
| Class leader (first year) | `leader@demo.local` | `Demo@12345` |

These accounts exist only in the throw-away in-memory database. Never create them in production.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string (`mongodb+srv://…/attendo?retryWrites=true&w=majority`) |
| `AUTH_SECRET` | yes | ≥ 32 random chars — signs session cookies |
| `QR_SECRET` | yes | ≥ 32 random chars — signs student card QR codes (rotating it invalidates printed cards) |
| `CRON_SECRET` | yes (prod) | random string; Vercel Cron sends it as `Authorization: Bearer …` |
| `APP_TIMEZONE` | no | default `Africa/Cairo` |
| `APP_URL` | no | public base URL used in check-in QR links (falls back to the request host) |

Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## 3. MongoDB Atlas setup

1. Create a project and a cluster (M0 works for trials; M10+ recommended for production: backups, more connections).
2. **Database Access** → add a database user with *Read and write to any database* scoped to the `attendo` database
   (Advanced privileges → `readWrite@attendo`). Use a generated password.
3. **Network Access**:
   - Recommended: Vercel **Secure Compute** / static egress IPs (Pro/Enterprise) and allow-list only those IPs,
     or Atlas **Private Endpoint** where available.
   - If your plan has no static egress IPs, you must allow `0.0.0.0/0`; in that case keep a strong, unique DB
     password, the least-privilege `readWrite@attendo` user, and rotate credentials regularly. Do **not** use this as
     a default for other projects.
   - Add your own IP for running the CLI scripts from your machine.
4. **Connect → Drivers** → copy the SRV string, add the database name `attendo`, put it in `MONGODB_URI`.
5. Transactions are **not** required (all integrity relies on atomic ops + unique indexes), so any tier works.

## 4. Initialise the database & create the first admin

Run from your machine with `.env.local` pointing at the target database:

```bash
npm run db:indexes      # create/sync all indexes (also after upgrades that change indexes)
npm run seed            # idempotent: Faculty of Physical Education, years 1–4, 4 departments
npm run create-admin    # interactive; or set ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD
```

There is **no public endpoint** that creates administrators. `create-admin` needs direct database access
(`MONGODB_URI`), refuses to change the role of an existing non-admin, requires ≥ 12-character passwords, and
re-running it for an existing admin resets the password and revokes that admin's sessions.

## 5. Deploy to Vercel

1. Push the repository to GitHub/GitLab and **Import** it in Vercel (framework: Next.js; defaults are fine).
2. Project → Settings → **Environment Variables**: add `MONGODB_URI`, `AUTH_SECRET`, `QR_SECRET`, `CRON_SECRET`
   (and optionally `APP_TIMEZONE`, `APP_URL`) for **Production**. Use a *separate* database (or at least a separate
   database name) for **Preview** deployments.
3. Deploy. Then run section 4 against the production database.
4. Cron: `vercel.json` schedules `/api/cron/sessions` **daily** (works on every plan). On Pro you can change it
   to `*/5 * * * *`. Any external scheduler can call the same URL with `Authorization: Bearer $CRON_SECRET`.
   The cron only refreshes stored state: every page, report and check-in re-derives the session status from server
   time, so attendance is correct even if the cron is delayed or never runs.
5. Geolocation and the camera need HTTPS — Vercel provides it.

**Deployment status:** not yet deployed to Vercel or connected to a real Atlas cluster (no credentials were available
during development). The production build, lint, type checks, unit/integration tests and E2E tests pass locally
against an in-memory MongoDB.

## 6. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (needs `MONGODB_URI`) |
| `npm run dev:memory` | local run with in-memory DB + demo data (add `-- --prod` after `npm run build`) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Vitest unit + integration tests (in-memory MongoDB) |
| `npm run test:e2e` | Playwright E2E (run `npm run build` and `npx playwright install chromium` first) |
| `npm run seed` · `create-admin` · `db:indexes` | database bootstrap (section 4) |

## 7. Key behaviours

- **Student codes** `ST00001…` come from an atomic counter; never reused; gaps are possible (e.g. a rejected duplicate).
- **Duplicates**: registration number if present, otherwise the normalised Arabic full name per college (unique index).
- **Years 1–2** are forced to "بدون تخصص"; years 3–4 require a specialization — enforced on the server, configurable per year.
- **Absence** is counted only for closed sessions; cancelled sessions never count. Percentage =
  attended ÷ (eligible − excused) × 100, rounded half-up to one decimal.
- **After closure** only the subject's doctor (or an admin) can change attendance, with a mandatory reason; history is kept.
- **Location** checks are server-side (Haversine + accuracy limit) but browser location can be spoofed; use
  "Location + QR" or staff-assisted marking when stronger assurance is needed.

## 8. Manual testing checklist

- [ ] Admin: create college/year/department/section; year policy shown and enforced when adding students.
- [ ] Admin: create doctor; create subject with eligibility + doctor; doctor sees only that subject.
- [ ] Students: add manually (code generated), duplicate-name warning and override, edit, archive/restore, print QR card.
- [ ] Import: download template, upload with errors, preview tabs, import, re-upload same file → all rows "duplicate", download error report.
- [ ] Staff: create class leader with year scope; leader sees only that year; cannot open `/admin/*`.
- [ ] Enrollment: leader request → doctor approves in "طلبات التسجيل"; doctor "enroll all eligible".
- [ ] Lecture (manual): open → staff search/QR marking → "تحضير الكل" → close → correction requires reason → history popover.
- [ ] Lecture (scheduled): opens/closes by itself at the set times (reload the page around the times).
- [ ] Check-in (phone, HTTPS): location-only inside/outside radius, location denied message, QR method needs card scan, second student on same phone is refused.
- [ ] Cancel lecture → not counted in report/matrix/inquiry.
- [ ] Reports: filters, sort, below-threshold, Excel export, print layout; matrix + export; lecture export.
- [ ] Inquiry: valid code, unknown code (generic error), 6th failed attempt blocked; optional registration-number verification setting.
- [ ] Audit log shows logins, permission changes, corrections, security blocks.
- [ ] Mobile: navigation drawer, tables scroll inside cards (no page-level horizontal scroll).
