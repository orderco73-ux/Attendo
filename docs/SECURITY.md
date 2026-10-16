# Security

## Authentication (staff only)
- Passwords hashed with bcrypt (cost 12). Minimum length 8.
- Session: HS256 JWT signed with `AUTH_SECRET` (≥ 32 chars) stored in cookie `attendo_session`
  (`httpOnly`, `secure` in production, `sameSite=lax`, `path=/`), lifetime 12 h.
- Every request re-loads the user: inactive users or a changed `sessionVersion` invalidate the token
  (logout everywhere on password reset / deactivation / role change).
- Login rate limit: 10 attempts per IP per 15 min + account lock for 15 min after 5 consecutive failures.
  Responses are generic ("بيانات الدخول غير صحيحة").
- No public sign-up and no endpoint that creates admins. The first admin is created with
  `npm run create-admin` (CLI, needs `MONGODB_URI`) — see README.

## Authorization model
| Role | Data access |
|---|---|
| admin | everything |
| doctor | subjects where `doctors` contains the user; students enrolled (or requested) in those subjects; their lectures & records |
| staff | `staff.permissions` ∩ `staff.scope` (college + years + departments + sections). Subject assistants additionally get attendance marking in that subject's open lectures |

Staff permission keys:
`students.view`, `students.create`, `students.edit`, `students.import`, `students.archive`,
`attendance.view`, `attendance.mark`, `reports.view`, `enrollment.request`.

Rules enforced in `src/server/authz/policy.ts` and services:
- Every mutation re-fetches the target document and checks it against the actor (prevents IDOR).
- Student queries for staff are always AND-ed with `studentScopeFilter(actor)`.
- Leaders can mark attendance only for students in scope, enrolled in the subject, and only while the
  lecture is effectively **open**. They cannot open/close sessions or edit settings.
- After closure only the subject's doctor (or admin) can change records; a reason is mandatory; each
  change appends to `history` and writes an audit log entry.
- Changing a student's academic placement (year / department) requires `students.edit` and the server
  enforces the year's specialization policy.

## Public endpoints
| Endpoint | Protection |
|---|---|
| `/inquiry` (server action) | 20 lookups / 10 min per IP, 5 failed lookups / 10 min per IP then block; generic "not found" message; `Cache-Control: no-store`; masked name (first two names); no IDs or personal data; failures beyond threshold are written to the audit log (`security.inquiry_blocked`). Optional second factor (registration number) via settings |
| `/api/checkin` | 30 requests / 10 min per IP; lecture must be effectively open and the token valid; student must be active and enrolled; method checks performed server-side; one student per device per lecture (httpOnly device cookie) |

## Student QR
The QR payload is `ATD1.<code>.<sig>` where `sig = base64url(HMAC-SHA256(QR_SECRET, code))[0..16]`.
A typed code is not enough for QR-based methods; the signed payload proves possession of the issued card,
**not** physical presence. QR cards are printed by authorised staff; the public inquiry page never shows QR.

## Location
Browser geolocation is client-reported and can be spoofed (developer tools, mock-location apps).
The server validates coordinate ranges, reported accuracy (`maxLocationAccuracyM` setting) and the Haversine
distance to the configured venue. Use `location_qr` or staff-assisted attendance for stronger assurance.
Geolocation requires HTTPS (Vercel provides it).

## Other controls
- Security headers (next.config): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` limiting camera/geolocation to self,
  HSTS.
- Server Actions include Next's built-in Origin check; upload route handlers also verify `Origin`.
- Upload limits: 2 MB, `.xlsx` only, 5,000 rows, header validation; parsed in memory.
- Internal errors are logged server-side; clients get generic Arabic messages.
- Secrets only in environment variables: `MONGODB_URI`, `AUTH_SECRET`, `QR_SECRET`, `CRON_SECRET`.
- Audit log covers: logins (success/failure), user/staff changes, permission changes, structure changes,
  student create/edit/archive/import, enrollment decisions, lecture open/close/cancel/reschedule,
  attendance corrections, settings changes.
