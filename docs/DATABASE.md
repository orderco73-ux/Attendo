# Database design (MongoDB + Mongoose)

All models live in `src/server/db/models`. All collections have `timestamps: true`.

## Collections

### users
| field | notes |
|---|---|
| name, email (unique, lowercase) | |
| passwordHash | bcrypt (cost 12) |
| role | `admin` \| `doctor` \| `staff` |
| active | inactive users cannot log in; existing sessions are rejected |
| sessionVersion | incremented on password reset / deactivation → revokes sessions |
| staff.title | free text (e.g. "قائد دفعة") |
| staff.kind | `class_leader` \| `specialization_leader` \| `custom` |
| staff.permissions[] | permission keys (see SECURITY.md) |
| staff.scope | `{ college, academicYears[], departments[], sections[] }` — empty array = all within college |
| failedLogins, lockedUntil, lastLoginAt | |
Indexes: `email` unique, `role`.

### colleges
`name`, `code` (unique), `active`.

### academicyears
`college`, `name`, `level` (1..n), `specializationPolicy` (`general_only` \| `specialized` \| `any`), `active`.
Unique: `(college, level)`.

### departments
`college`, `name`, `code`, `isGeneral` (the "No Specialization" department), `active`.
Unique: `(college, code)`. Partial unique: one `isGeneral: true` per college.

### sections
`college`, `academicYear`, `department?`, `name`, `active`. Unique `(academicYear, name)`.

### counters
`_id` (e.g. `student`), `seq`. Code reservation uses `findOneAndUpdate({_id}, {$inc: {seq: n}}, {upsert, new})`
which is atomic; a batch reserves `n` consecutive numbers at once.

### students
| field | notes |
|---|---|
| code | `ST` + 5+ digits, **unique**, immutable |
| seq | numeric part (for sorting) |
| fullName, nameKey | `nameKey` = normalised Arabic name for search & matching |
| registrationNumber? | university number (optional) |
| college, academicYear, department, section? | refs |
| status | `active` \| `archived` (never hard-deleted; codes never reused) |
| dedupeKey? | unique sparse — see matching strategy |
| notes?, createdBy, archivedAt? | |
Indexes: `code` unique, `dedupeKey` unique sparse, `(college, academicYear, department, status)`, `nameKey`, `seq`.

#### Duplicate matching strategy
1. If `registrationNumber` exists → `dedupeKey = reg:<collegeId>:<normalised regNo>`.
2. Otherwise → `dedupeKey = name:<collegeId>:<nameKey>`.
The unique index guarantees that two concurrent imports (or a repeat import of the same list) cannot create
the same student twice: the second insert fails with E11000 and the row is reported as "duplicate of STxxxxx".
When a genuinely different student shares a full name, an authorized user creates them manually with
"different student with the same name" confirmed — the record is then stored without a name-based key.

### subjects
`name`, `code` (unique), `description`, `college`, `eligibility { academicYears[], departments[], sections[] }`
(empty = any), `doctors[]` (assignment), `assistants[]` (staff users helping in this subject),
`requiresEnrollmentApproval`, `active`.
Doctor assignment is embedded (`doctors[]`, indexed multikey) rather than a separate SubjectAssignment
collection: assignments have no attributes of their own and are always read together with the subject.

### subjectenrollments
`subject`, `student`, `status` (`pending` \| `approved` \| `rejected` \| `removed`), `effectiveFrom`,
`requestedBy`, `decidedBy`, `decidedAt`, `note`.
Unique `(subject, student)`; index `(subject, status)`, `(student, status)`.

### lectures (= attendance sessions)
| field | notes |
|---|---|
| subject, title, number? | |
| startsAt, endsAt | UTC; `endsAt > startsAt` validated |
| venue | |
| status | `scheduled` \| `open` \| `closed` \| `cancelled` |
| attendance.mode | `manual` \| `scheduled` |
| attendance.method | `location` \| `qr` \| `location_qr` \| `staff_only` |
| attendance.opensAt / closesAt | required for scheduled mode |
| attendance.location `{lat,lng}`, radiusM | required for location methods |
| attendance.checkinToken | random URL token for the public check-in page (unique sparse) |
| openedAt, closedAt, cancelledAt, cancelReason, createdBy | |
Indexes: `(subject, startsAt)`, `(status, attendance.mode, attendance.opensAt)`, `(status, attendance.closesAt)`, `startsAt`.
A lecture and its attendance session have a 1:1 lifecycle, so they share one document (no separate
AttendanceSession collection), which keeps status transitions atomic.

### attendancerecords
`lecture`, `subject` (denormalised), `student`, `status` (`present` \| `absent` \| `excused`),
`source` (`self_checkin` \| `staff` \| `doctor_correction`), `markedBy?`, `markedAt`, `distanceM?`,
`deviceId?`, `history[] { at, by, from, to, source, reason }`.
**Unique `(lecture, student)`** — prevents duplicate attendance under concurrency (upsert with
`$setOnInsert`). Indexes: `(subject, student)`, `(lecture, deviceId)`, `(student)`.

### importjobs / importrows
`importjobs`: `createdBy`, `fileName`, `status` (`ready` \| `processing` \| `completed` \| `cancelled`),
`totals`, `lease { owner, until }`, `expiresAt` (TTL 14 days).
`importrows`: `job`, `rowNumber`, `data`, `status` (`valid` \| `invalid` \| `duplicate` \| `created` \| `failed`),
`errors[]`, `student?`, `dedupeKey?`, `expiresAt` (TTL). Unique `(job, rowNumber)`.
Uploaded files are parsed in memory and never written to disk; only the parsed rows are stored temporarily.

### auditlogs
`actor`, `actorName`, `action`, `entityType`, `entityId`, `summary`, `meta`, `ip`, `createdAt`.
Indexes: `createdAt`, `(entityType, entityId)`, `actor`, `action`.

### ratelimits
`key`, `count`, `expiresAt` (TTL index). Fixed-window counters for login, inquiry and check-in.

### settings
`key` (unique), `value` (mixed). See `src/server/services/settings.ts` for defaults.

## Transactions
Not required: all concurrency-sensitive writes rely on single-document atomic operations and unique indexes,
so the app works on any Atlas tier (and standalone mongod in tests).

## Index management
`npm run db:indexes` runs `syncIndexes()` for every model (use after deployments that change indexes).
`autoIndex` is disabled in production.
