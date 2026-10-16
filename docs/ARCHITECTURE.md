# Architecture

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Server Components + Server Actions) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui-style components (Radix primitives), lucide-react icons |
| Forms | react-hook-form + zod |
| Database | MongoDB Atlas + Mongoose |
| Auth | Custom: bcryptjs password hashing, HS256 JWT (jose) in an httpOnly cookie, DB-verified session version |
| Excel | exceljs |
| QR | `qrcode` (generation), `jsqr` (in-browser scanning) |
| Charts | recharts |
| Dates | date-fns + @date-fns/tz (institution timezone `Africa/Cairo`) |
| Tests | Vitest + mongodb-memory-server (unit/integration), Playwright (E2E) |
| Hosting | Vercel (functions + cron) |

## Folder structure
```
src/
  app/
    (auth)/login              staff login
    (app)/                    authenticated shell (sidebar + topbar)
      dashboard               role-aware overview
      admin/…                 colleges, structure, subjects, doctors, staff, settings, audit, sessions
      students/…              list, create, edit, import, QR card
      subjects/…              doctor/admin subject workspace (students, lectures, requests, reports)
      lectures/[id]           session control + staff-assisted attendance + attendance sheet
      reports/…               report hub (subject, group)
      enrollment-requests     staff requests / doctor reviews
    (public)/inquiry          student attendance inquiry (no login)
    (public)/checkin/[token]  student self check-in (no login)
    api/                      file downloads/uploads, cron, check-in
  components/
    ui/                       design-system primitives
    layout/                   shell, sidebar, mobile nav, page header
    shared/                   data table, filters, pagination, empty states, confirm dialogs, QR scanner…
  server/
    db/                       connection cache + models/
    auth/                     password, session token, current user
    authz/                    permission catalog, policy checks, scope filters
    services/                 business logic (one file per domain)
    actions/                  thin "use server" wrappers: parse input → service → ActionResult
  lib/                        shared isomorphic utils (time, geo, arabic normalisation, codes, validation schemas)
tests/                        vitest unit + integration tests
e2e/                          playwright tests
scripts/                      create-admin, seed, sync-indexes, dev in-memory DB
```

## Request flow
1. `src/proxy.ts` (Next 16 proxy, formerly middleware) does an *optimistic* redirect to `/login` when no session
   cookie exists on protected paths. It is **not** the security boundary.
2. Server Components call `requireUser()` which verifies the JWT, loads the user from MongoDB, checks
   `active` and `sessionVersion`. Result is memoised per request with `React.cache`.
3. Data is read through services that receive the `Actor` and apply authorization + scope filters.
4. Mutations are Server Actions in `server/actions/*`. Each action: `requireUser()` → zod parse →
   service call (which enforces authorization) → `revalidatePath` → `ActionResult`.
5. Route handlers (`app/api/*`) are used where a Server Action is unsuitable: file downloads (xlsx),
   multipart upload of imports, cron, public check-in (needs request IP / device cookie).

## Authorization service
`server/authz` is the single place for permission logic:
- `permissions.ts` — catalog of staff permission keys + Arabic labels.
- `policy.ts` — `can(actor, perm)`, `assert*` helpers, `studentScopeFilter(actor)` (returns a Mongo filter
  restricting students to the actor's scope), `subjectAccess(actor, subject)` (doctor / assistant / scoped
  staff / admin), `assertStudentInScope`, etc.
Services never trust ids from the client: every document fetched by id is checked against the actor.

## Attendance session lifecycle
`lib/session-status.ts#effectiveStatus(lecture, now)` is a pure function:
- cancelled / closed → unchanged.
- manual mode → stored status.
- scheduled mode → `now < opensAt` ⇒ scheduled, `opensAt ≤ now < closesAt` ⇒ open, `now ≥ closesAt` ⇒ closed.

`services/lectures#reconcileLectures(filter)` persists transitions with two conditional `updateMany` calls
(idempotent). It runs:
- lazily before any lecture list / report / check-in / dashboard read, and
- from `/api/cron/sessions` (Vercel Cron, protected by `CRON_SECRET`).
Therefore correctness never depends on cron timing; cron only keeps stored state fresh.

## Imports (serverless-safe)
1. `POST /api/imports` (≤ 2 MB, ≤ 5,000 rows): parse, validate, detect duplicates, store an `ImportJob` and
   `ImportRow` documents (status valid / invalid / duplicate). Nothing is created yet.
2. Preview page lists rows with reasons.
3. Commit: the browser calls `processImportBatch(jobId)` repeatedly; each call claims a lease on the job
   (atomic `findOneAndUpdate`), processes ≤ 250 rows (reserves a code range with one `$inc`, `insertMany`
   unordered; unique `dedupeKey` index rejects concurrent duplicates), and returns progress. Each call is
   far below serverless time limits and the job can be resumed.
4. Error report is generated on demand as xlsx.

## Timezone
`APP_TIMEZONE` (default `Africa/Cairo`). All timestamps stored as UTC `Date`. Form inputs (date + time)
are interpreted in the institution timezone on the server (`@date-fns/tz`). All formatting uses the same zone.

## Deployment
- Vercel project, Node.js runtime for all routes that touch MongoDB.
- MongoDB connection cached on `globalThis` across warm invocations (`server/db/connect.ts`).
- `vercel.json` defines the reconciliation cron.
