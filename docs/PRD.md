# Attendo nosait — Product Requirements

Attendo nosait is an Arabic-first (RTL) web platform for managing university lecture attendance.
It targets one institution initially (Faculty of Physical Education / Sport Science) but the academic
structure (colleges, academic years, departments/specializations, sections) is data-driven so new
colleges and structures can be added without code changes.

## 1. Actors

| Actor | Authenticates? | Summary |
|---|---|---|
| Admin | Yes | Full control: academic structure, subjects, doctors, staff, students, settings, audit log, system reports. |
| Doctor | Yes | Works only inside subjects assigned to them: enrollment, lectures, attendance sessions, corrections, reports. |
| Staff — Class Leader | Yes | Scoped to an academic year (+ optional sections). Permissions configured individually by the Admin. |
| Staff — Specialization Leader | Yes | Scoped to a specialization (+ optional years/sections). Permissions configured individually. |
| Staff — Custom | Yes | Any other scoped helper role with a custom title and a custom permission set. |
| Student | **No** | Has no account. Uses the public inquiry page (student code) and the public check-in page of an open lecture. |

## 2. Functional scope

### Academic structure (Admin)
- Colleges, academic years (with a specialization policy), departments/specializations (one may be the
  "general / no specialization" department), sections/classes.
- Initial configuration (seed script): Faculty of Physical Education / Sport Science; years 1–4;
  departments: No Specialization, Sports Training, Teaching, Sports Administration.
- Years 1–2 use policy `general_only` (students forced to "No Specialization"); years 3–4 use
  `specialized` (must choose a non-general department). Enforced on the server for every write.

### Students (no accounts)
- Fields: full name, auto code `ST00001…`, college, academic year, department, optional section,
  optional university registration number, optional notes, status (active / archived).
- Codes are generated server-side from an atomic counter; never reused (gaps are allowed).
- Manual create/edit/archive/restore, search by name/code, filter by year/department/section/status.
- Excel import: template, upload, header validation, preview, per-row validation, duplicate detection
  (within file and against DB), batched commit with progress, summary, downloadable error report.
- Printable QR card per student (signed QR payload, see SECURITY.md).

### Subjects & enrollment
- Subject: name, unique code, description, college, eligibility (years / departments / sections),
  assigned doctors, optional subject assistants (staff), requires-approval flag, active flag.
- Enrollment: direct (admin/doctor) or via request (staff with `enrollment.request`) that the doctor
  approves/rejects when the subject requires approval. Bulk "enroll all eligible students" for doctors/admin.
- Every enrollment has `effectiveFrom`; lectures that start before it are not counted for that student.

### Lectures & attendance sessions
- Lecture = one attendance session: title/number, date, start/end (Africa/Cairo), venue, method,
  mode (manual / scheduled), opening/closing times, location + radius, status
  (scheduled → open → closed, or cancelled).
- Manual mode: doctor opens/closes. Scheduled mode: transitions are derived from server time
  (lazy reconciliation on every read + idempotent cron).
- Reschedule (only when not yet open) and cancel (cancelled lectures never count as absences).

### Attendance methods
- `location` — student self check-in on the lecture's check-in page; device location must be within radius.
- `qr` — student identification by the signed QR of the student card (self check-in requires the card QR;
  staff can scan it in the staff-assisted screen).
- `location_qr` — both conditions.
- `staff_only` — no self check-in; only staff-assisted marking.
- Staff-assisted marking (all methods): doctor / authorized leader / subject assistant searches by name or
  code or scans the QR and marks the student present (only while open, except doctor corrections).
- After closure only doctors (and admins) may change records; a reason is required; history is kept.

### Public pages
- `/inquiry`: student enters a code; sees masked name, enrolled subjects, attended / absent / excused,
  percentage, lecture-by-lecture history, upcoming lectures. Rate limited, generic errors, no caching,
  optional second factor (registration number) configurable in settings.
- `/checkin/[token]`: self check-in for an open lecture according to its method.

### Reports
- Subject report (per student: eligible, attended, excused, absences, percentage) with search, filters,
  sort, pagination, Excel export, print layout.
- Attendance matrix (students × lecture dates) with Excel export.
- Lecture report (attendance list of a single lecture) + export.
- Group report (academic year / department / section): per-subject summaries.
- System overview for admin: counts, today's sessions, open sessions, 14-day attendance trend.

## 3. Calculation rules
- Eligible lectures for a student in a subject = closed lectures of the subject whose start ≥ enrollment
  `effectiveFrom`, plus any closed lecture where the student has a record.
- Scheduled / open / cancelled lectures are never eligible (no absence before closure).
- attended = records with status `present`; excused = records with status `excused`;
  absences = eligible − attended − excused.
- percentage = attended ÷ (eligible − excused) × 100, rounded half-up to 1 decimal; shown as "—" when the
  denominator is 0.

## 4. Non-functional
- Next.js App Router on Vercel (serverless), MongoDB Atlas via Mongoose.
- Arabic default, full RTL, responsive (desktop sidebar, mobile drawer).
- Server-side authorization for every read and mutation; audit log for sensitive actions.
- No in-memory timers / local files in production.
