# Implementation plan & checklist

Legend: [x] done · [~] partial · [ ] not started

## Conventions
- TypeScript strict; path alias `@/*` → `src/*`.
- Business logic in `src/server/services`; authorization in `src/server/authz/policy.ts`; server actions in
  `src/server/actions` are thin wrappers (`run()` → `ActionResult<T>`).
- Route handlers (`src/app/api`) only for uploads, file downloads, cron and public check-in (`withActor()` helper).
- UI strings in Arabic; code, comments and docs in English.
- Dates stored UTC; parsed/formatted with `src/lib/time.ts` in `APP_TIMEZONE`.
- Every sensitive mutation writes an audit entry via `services/audit.ts#audit`.

## Phase 0 — Architecture & planning
- [x] Repository inspected (empty), architecture, data model, security model
- [x] PRD, ARCHITECTURE, DATABASE, SECURITY, IMPLEMENTATION_PLAN, README

## Phase 1 — Foundation & design system
- [x] Next.js 16.4 + TS strict + Tailwind v4 + ESLint 9 flat config + Vitest 5 + Playwright
- [x] Tokens (white/blue palette, success/warning/error), IBM Plex Sans Arabic, `dir="rtl"`, Radix DirectionProvider
- [x] Primitives: button, input/textarea, native select, label, checkbox, switch, badge, card, table, skeleton,
      progress, dialog, sheet, dropdown, tabs, popover, toasts (sonner)
- [x] Shell: sidebar, mobile drawer, user menu; page header, sections, stat strip, empty states, filter bar,
      URL pagination, sort headers, confirm dialogs (with reason), loading/error/not-found states, print styles

## Phase 2 — MongoDB & authentication
- [x] Cached connection, 16 models with indexes, `db:indexes` script
- [x] bcrypt, HS256 JWT cookie + DB `sessionVersion` revocation, login rate limit + account lock, logout, change password
- [x] `create-admin` CLI (no public endpoint), idempotent `seed`
- [x] Authorization service (permissions, student scope filter, subject access levels)
- [x] Tests: session token, policy-driven scope tests

## Phase 3 — Academic structure & admin
- [x] Colleges, years (specialization policy), departments (general dept), sections
- [x] Subjects with eligibility + doctor assignment; doctor/admin accounts; activation
- [x] Admin overview (counts, today's lectures, open sessions, pending tasks, 14-day trend chart, activity)
- [x] Settings page, audit log page, system-wide sessions page

## Phase 4 — Students & Excel import
- [x] Atomic code reservation, manual create/edit/archive/restore, search (normalised Arabic) & filters, export
- [x] Duplicate strategy (registration number / normalised name) with unique index + explicit same-name override
- [x] Template, upload (2 MB / 5,000 rows, header + zip signature checks), preview with tabs, leased batched commit
      (resumable, concurrency-safe), totals, downloadable error report
- [x] Printable student QR card (HMAC-signed payload)
- [x] Tests: concurrent code generation, concurrent duplicate imports, malformed files

## Phase 5 — Staff & scoped permissions
- [x] Staff CRUD (kind, title, 9 permission keys, college/years/departments/sections scope, activation, password reset)
- [x] Scoped navigation, dashboards, lists, imports, reports; subject assistants
- [x] Tests: cross-scope read/edit/create denied, no-permission denied, out-of-scope marking denied

## Phase 6 — Enrollment & lectures
- [x] Direct, selected and bulk ("all eligible") enrollment with `effectiveFrom`; staff requests; approve/reject (per-subject and global page); removal
- [x] Lecture create (with weekly repeat), edit with status-dependent locking, cancel with reason, manual open/close/reopen
- [x] Scheduled mode with lazy reconciliation + idempotent cron endpoint (`vercel.json`)

## Phase 7 — Attendance engine
- [x] Public self check-in: location / QR / location+QR / staff-only, accuracy limit, device rule, rate limit
- [x] Staff-assisted marking: name/code search + camera QR scanner (jsQR)
- [x] Attendance sheet with filters, "mark all present", doctor corrections with mandatory reason + history
- [x] Rotating check-in link, large QR projector view
- [x] Tests: open/closed rules, duplicates under concurrency, corrections, scheduled transitions, check-in rules

## Phase 8 — Student inquiry
- [x] Public page, masked name, per-subject stats, lecture history, upcoming lectures
- [x] Rate limits (IP + failed lookups), generic errors, audit on blocking, optional registration-number verification

## Phase 9 — Reports & exports
- [x] Subject report (search, year/department/threshold/date filters, sort, pagination, totals, print, Excel)
- [x] Attendance matrix (+ Excel), lecture export, students export, group/summary report
- [x] Calculation tests (`computeStats`, percentage rounding)

## Phase 10 — QA & deployment
- [x] `npm run lint` (0 errors), `npm run typecheck`, `npm run build` — passing
- [x] Vitest: 31 tests passing (unit + integration on in-memory MongoDB)
- [x] Playwright: 7 E2E tests passing (auth, admin student creation, doctor full session, leader scope, inquiry, mobile overflow, RTL)
- [x] README: Atlas, Vercel, env vars, bootstrap, cron, manual testing checklist
- [ ] Real deployment to Vercel + Atlas — **blocked on credentials** (see README §5)

## Known limitations / next steps
1. Deploy: create Atlas cluster + Vercel project, set env vars, run `db:indexes`, `seed`, `create-admin`.
2. Browser geolocation and static student QR cards are not tamper-proof (documented); a rotating per-session QR
   shown on the projector could be added for stronger presence proof.
3. Imports are capped at 5,000 rows per file (split larger lists); uploaded files are not retained (only parsed rows, 14-day TTL).
4. The admin trend chart uses current enrollment `effectiveFrom` dates; enrollments removed later are not included historically.
5. Rate limiting is per IP (MongoDB-backed); institutions behind a single NAT may want to raise limits in `services/inquiry.ts` / `attendance.ts`.

## Handoff notes
- Local verification: `npm run build && npm run dev:memory -- --prod`, demo accounts in README §1.
- Tests use `.tmp/` on the project drive for mongod data (the OS temp drive may be too small).
