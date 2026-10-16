import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { AcademicYear, Department, ImportJob, ImportRow, Section, Student, type IImportRow, type ImportRowData } from "@/server/db/models";
import type { Actor } from "@/server/auth/actor";
import { assertPermission, studentInScope } from "@/server/authz/policy";
import { AppError, invalid, isDuplicateKeyError } from "@/server/errors";
import { oid } from "@/server/ids";
import { cleanName, normalizeArabic } from "@/lib/arabic";
import { formatStudentCode } from "@/lib/codes";
import { departmentAllowedForYear } from "./academic";
import { dedupeKeyFor, reserveStudentSeqs } from "./students";
import { audit } from "./audit";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const BATCH_SIZE = 250;
const JOB_TTL_MS = 14 * 24 * 3600 * 1000;
const LEASE_MS = 60_000;

/** Column headers (Arabic) → field. Order defines the template. */
export const IMPORT_COLUMNS = [
  { key: "fullName", header: "الاسم الكامل", required: true, width: 36 },
  { key: "academicYear", header: "السنة الدراسية", required: true, width: 18 },
  { key: "department", header: "التخصص", required: false, width: 20 },
  { key: "section", header: "الشعبة", required: false, width: 12 },
  { key: "registrationNumber", header: "رقم القيد", required: false, width: 16 },
  { key: "notes", header: "ملاحظات", required: false, width: 30 },
] as const;
type ColKey = (typeof IMPORT_COLUMNS)[number]["key"];

/* ---------------- Template ---------------- */
export async function buildTemplate(collegeId?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Attendo nosait";
  const ws = wb.addWorksheet("الطلاب", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = IMPORT_COLUMNS.map((c) => ({ header: c.header + (c.required ? " *" : ""), key: c.key, width: c.width }));
  styleHeader(ws.getRow(1));
  ws.addRow({ fullName: "أحمد محمد علي حسن", academicYear: "الفرقة الأولى", department: "بدون تخصص", section: "", registrationNumber: "", notes: "" });
  ws.addRow({ fullName: "سارة محمود إبراهيم", academicYear: "الفرقة الثالثة", department: "التدريب الرياضي", section: "", registrationNumber: "2023001", notes: "" });

  const years = await AcademicYear.find(collegeId ? { college: oid(collegeId), active: true } : { active: true }).sort({ level: 1 }).lean();
  const depts = await Department.find(collegeId ? { college: oid(collegeId), active: true } : { active: true }).sort({ isGeneral: -1, name: 1 }).lean();
  const ref = wb.addWorksheet("القيم المسموحة", { views: [{ rightToLeft: true }] });
  ref.columns = [
    { header: "السنوات الدراسية", key: "y", width: 24 },
    { header: "سياسة التخصص", key: "p", width: 22 },
    { header: "التخصصات", key: "d", width: 24 },
  ];
  styleHeader(ref.getRow(1));
  const policy = { general_only: "بدون تخصص فقط", specialized: "تخصص إلزامي", any: "أي قسم" } as const;
  const n = Math.max(years.length, depts.length);
  for (let i = 0; i < n; i++) ref.addRow({ y: years[i]?.name ?? "", p: years[i] ? policy[years[i].specializationPolicy] : "", d: depts[i]?.name ?? "" });
  ref.addRow({});
  ref.addRow({ y: "ملاحظات: الحقول المعلمة بـ * إلزامية. طلاب السنوات (بدون تخصص فقط) يُسجلون تلقائيًا بدون تخصص." });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
}

/* ---------------- Parse & validate ---------------- */

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v && v.result != null) return cellText(v.result as ExcelJS.CellValue);
  }
  return "";
}

const headerKey = (h: string) => normalizeArabic(h.replace(/\*/g, ""));

export interface ParsedSheet {
  rows: { rowNumber: number; data: Partial<Record<ColKey, string>> }[];
}

/** Parses an uploaded workbook buffer. Throws a validation error for malformed files or wrong headers. */
export async function parseWorkbook(buf: Buffer | ArrayBuffer): Promise<ParsedSheet> {
  const size = buf instanceof ArrayBuffer ? buf.byteLength : buf.length;
  if (size === 0) throw invalid("الملف فارغ");
  if (size > MAX_IMPORT_BYTES) throw invalid("حجم الملف يتجاوز 2 ميجابايت");
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  // xlsx files are zip archives ("PK")
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw invalid("الملف ليس بصيغة Excel (.xlsx) صالحة");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw invalid("تعذر قراءة الملف. تأكد أنه ملف Excel صالح بصيغة .xlsx");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw invalid("لا توجد ورقة عمل في الملف");
  if (ws.rowCount - 1 > MAX_IMPORT_ROWS) throw invalid(`عدد الصفوف يتجاوز الحد الأقصى (${MAX_IMPORT_ROWS})`);

  const header = ws.getRow(1);
  const colIndex: Partial<Record<ColKey, number>> = {};
  header.eachCell((cell, col) => {
    const k = headerKey(cellText(cell.value));
    const match = IMPORT_COLUMNS.find((c) => headerKey(c.header) === k);
    if (match) colIndex[match.key] = col;
  });
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !colIndex[c.key]).map((c) => c.header);
  if (missing.length) throw invalid(`أعمدة إلزامية غير موجودة: ${missing.join("، ")}. استخدم القالب المعتمد.`);

  const rows: ParsedSheet["rows"] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: Partial<Record<ColKey, string>> = {};
    let any = false;
    for (const c of IMPORT_COLUMNS) {
      const idx = colIndex[c.key];
      if (!idx) continue;
      const t = cellText(row.getCell(idx).value).trim().slice(0, 300);
      if (t) any = true;
      data[c.key] = t;
    }
    if (any) rows.push({ rowNumber, data });
  });
  if (rows.length === 0) throw invalid("لا توجد بيانات طلاب في الملف");
  if (rows.length > MAX_IMPORT_ROWS) throw invalid(`عدد الصفوف يتجاوز الحد الأقصى (${MAX_IMPORT_ROWS})`);
  return { rows };
}

/**
 * Validates parsed rows against the academic structure, actor scope and existing students,
 * then stores an ImportJob + ImportRows for preview. Nothing is created yet.
 */
export async function createImportJob(actor: Actor, fileName: string, buf: Buffer, collegeId: string) {
  assertPermission(actor, "students.import");
  const { rows } = await parseWorkbook(buf);
  const college = oid(collegeId);

  const [years, depts, sections] = await Promise.all([
    AcademicYear.find({ college, active: true }).lean(),
    Department.find({ college, active: true }).lean(),
    Section.find({ college, active: true }).lean(),
  ]);
  if (!years.length) throw invalid("لا توجد سنوات دراسية مفعلة لهذه الكلية");
  const yearByName = new Map(years.map((y) => [normalizeArabic(y.name), y]));
  const deptByName = new Map(depts.flatMap((d) => [[normalizeArabic(d.name), d] as const, [normalizeArabic(d.code), d] as const]));
  const general = depts.find((d) => d.isGeneral);

  const seenInFile = new Map<string, number>();
  const prepared: Omit<IImportRow, "_id" | "job" | "expiresAt">[] = [];

  for (const r of rows) {
    const errors: string[] = [];
    const fullName = cleanName(r.data.fullName ?? "");
    const regNo = r.data.registrationNumber?.trim() || "";
    const data: ImportRowData = {
      fullName,
      registrationNumber: regNo || undefined,
      academicYear: r.data.academicYear,
      department: r.data.department,
      section: r.data.section,
      notes: r.data.notes || undefined,
      collegeId: String(college),
    };
    if (fullName.length < 5 || fullName.split(" ").length < 2) errors.push("الاسم الكامل مطلوب (ثنائي على الأقل)");
    if (fullName.length > 150) errors.push("الاسم أطول من 150 حرفًا");

    const year = r.data.academicYear ? yearByName.get(normalizeArabic(r.data.academicYear)) : undefined;
    if (!r.data.academicYear) errors.push("السنة الدراسية مطلوبة");
    else if (!year) errors.push(`السنة الدراسية "${r.data.academicYear}" غير معروفة`);

    let dept = r.data.department ? deptByName.get(normalizeArabic(r.data.department)) : undefined;
    if (year) {
      if (year.specializationPolicy === "general_only") {
        if (dept && !dept.isGeneral) errors.push(`طلاب ${year.name} يجب أن يكونوا بدون تخصص`);
        dept = general;
        if (!dept) errors.push("قسم \"بدون تخصص\" غير مُعد");
      } else if (!r.data.department) errors.push("التخصص مطلوب لهذه السنة");
      else if (!dept) errors.push(`التخصص "${r.data.department}" غير معروف`);
      else if (!departmentAllowedForYear(year, dept)) errors.push(`التخصص "${dept.name}" غير مسموح لـ ${year.name}`);
    }
    if (year) data.academicYearId = String(year._id);
    if (dept) data.departmentId = String(dept._id);

    if (r.data.section && year) {
      const sec = sections.find(
        (s) =>
          normalizeArabic(s.name) === normalizeArabic(r.data.section!) &&
          String(s.academicYear) === String(year._id) &&
          (!s.department || (dept && String(s.department) === String(dept._id))),
      );
      if (!sec) errors.push(`الشعبة "${r.data.section}" غير موجودة لهذه السنة`);
      else data.sectionId = String(sec._id);
    }

    if (year && dept && !studentInScope(actor, { college, academicYear: year._id, department: dept._id, section: data.sectionId ?? null }))
      errors.push("خارج نطاق صلاحياتك");

    let dedupeKey: string | null = null;
    let status: IImportRow["status"] = errors.length ? "invalid" : "valid";
    if (fullName) {
      dedupeKey = dedupeKeyFor(college, fullName, regNo || null);
      const prev = seenInFile.get(dedupeKey);
      if (prev && status === "valid") {
        status = "duplicate";
        errors.push(`مكرر داخل الملف (نفس بيانات الصف ${prev})`);
      } else if (!prev && status === "valid") seenInFile.set(dedupeKey, r.rowNumber);
    }
    prepared.push({ rowNumber: r.rowNumber, data, status, errors, dedupeKey, student: null, studentCode: null });
  }

  // Duplicates against existing students (batched lookups).
  const keys = prepared.filter((p) => p.status === "valid" && p.dedupeKey).map((p) => p.dedupeKey!);
  for (let i = 0; i < keys.length; i += 1000) {
    const existing = await Student.find({ dedupeKey: { $in: keys.slice(i, i + 1000) } }).select("dedupeKey code").lean();
    const byKey = new Map(existing.map((e) => [e.dedupeKey!, e.code]));
    for (const p of prepared) {
      if (p.status === "valid" && p.dedupeKey && byKey.has(p.dedupeKey)) {
        p.status = "duplicate";
        p.errors.push(`الطالب موجود بالفعل بالكود ${byKey.get(p.dedupeKey)}`);
      }
    }
  }

  const count = (s: IImportRow["status"]) => prepared.filter((p) => p.status === s).length;
  const expiresAt = new Date(Date.now() + JOB_TTL_MS);
  const job = await ImportJob.create({
    createdBy: actor.oid,
    fileName: fileName.slice(0, 200),
    status: "ready",
    totals: { rows: prepared.length, valid: count("valid"), invalid: count("invalid"), duplicate: count("duplicate"), created: 0, failed: 0 },
    expiresAt,
  });
  for (let i = 0; i < prepared.length; i += 1000) {
    await ImportRow.insertMany(
      prepared.slice(i, i + 1000).map((p) => ({ ...p, job: job._id, expiresAt })),
      { ordered: false },
    );
  }
  await audit(actor, {
    action: "import.validate",
    summary: `رفع ملف استيراد ${fileName}: ${prepared.length} صف`,
    entityType: "import",
    entityId: job._id,
    meta: job.totals,
  });
  return String(job._id);
}

/* ---------------- Read job ---------------- */

async function loadJob(actor: Actor, jobId: string) {
  assertPermission(actor, "students.import");
  const job = await ImportJob.findById(oid(jobId)).lean();
  // Only the uploader (or an admin) may see or run a job.
  if (!job || (actor.role !== "admin" && String(job.createdBy) !== actor.id)) throw new AppError("NOT_FOUND");
  return job;
}

export async function getImportJob(actor: Actor, jobId: string, opts: { status?: string; page?: number } = {}) {
  const job = await loadJob(actor, jobId);
  const filter: Record<string, unknown> = { job: job._id };
  if (opts.status && ["valid", "invalid", "duplicate", "created", "failed"].includes(opts.status)) filter.status = opts.status;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = 50;
  const [rows, total] = await Promise.all([
    ImportRow.find(filter).sort({ rowNumber: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ImportRow.countDocuments(filter),
  ]);
  return { job, rows, total, page, pageSize };
}

export async function listImportJobs(actor: Actor) {
  assertPermission(actor, "students.import");
  const filter = actor.role === "admin" ? {} : { createdBy: actor.oid };
  return ImportJob.find(filter).sort({ createdAt: -1 }).limit(20).lean();
}

/* ---------------- Commit in batches ---------------- */

/**
 * Processes the next batch of valid rows. Safe to call repeatedly and concurrently:
 *  - a lease on the job prevents two workers processing simultaneously;
 *  - the unique dedupeKey index makes any duplicate insert fail instead of creating a second student.
 */
export async function processImportBatch(actor: Actor, jobId: string) {
  const job0 = await loadJob(actor, jobId);
  if (job0.status === "completed" || job0.status === "cancelled") return { done: true, totals: job0.totals };

  const owner = randomUUID();
  const now = new Date();
  const job = await ImportJob.findOneAndUpdate(
    {
      _id: job0._id,
      status: { $in: ["ready", "processing"] },
      $or: [{ lease: null }, { "lease.until": { $lt: now } }],
    },
    { $set: { status: "processing", lease: { owner, until: new Date(now.getTime() + LEASE_MS) } } },
    { returnDocument: "after" },
  );
  if (!job) return { done: false, busy: true, totals: job0.totals };

  try {
    const batch = await ImportRow.find({ job: job._id, status: "valid" }).sort({ rowNumber: 1 }).limit(BATCH_SIZE).lean();
    if (batch.length === 0) {
      const totals = await recountTotals(job._id);
      await ImportJob.updateOne({ _id: job._id, "lease.owner": owner }, { $set: { status: "completed", completedAt: new Date(), lease: null, totals } });
      await audit(actor, { action: "import.complete", summary: `اكتمل الاستيراد: ${totals.created} طالب جديد`, entityType: "import", entityId: job._id, meta: totals });
      return { done: true, totals };
    }

    const firstSeq = await reserveStudentSeqs(batch.length);
    const docs = batch.map((r, i) => {
      const seq = firstSeq + i;
      return {
        _id: new Types.ObjectId(),
        code: formatStudentCode(seq),
        seq,
        fullName: r.data.fullName,
        nameKey: normalizeArabic(r.data.fullName),
        registrationNumber: r.data.registrationNumber || null,
        college: oid(r.data.collegeId),
        academicYear: oid(r.data.academicYearId),
        department: oid(r.data.departmentId),
        section: r.data.sectionId ? oid(r.data.sectionId) : null,
        status: "active" as const,
        dedupeKey: r.dedupeKey!,
        notes: r.data.notes,
        createdBy: actor.oid,
      };
    });

    const failedIdx = new Set<number>();
    try {
      await Student.insertMany(docs, { ordered: false });
    } catch (err) {
      const writeErrors = (err as { writeErrors?: { index: number; err?: { code?: number }; code?: number }[] }).writeErrors;
      if (!writeErrors) throw err;
      for (const we of writeErrors) failedIdx.add(we.index);
    }

    const ops = [];
    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      if (!failedIdx.has(i)) {
        ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: { status: "created", student: docs[i]._id, studentCode: docs[i].code } } } });
      } else {
        const existing = await Student.findOne({ dedupeKey: r.dedupeKey }).select("code").lean();
        ops.push({
          updateOne: {
            filter: { _id: r._id },
            update: existing
              ? { $set: { status: "duplicate" }, $push: { errors: `الطالب موجود بالفعل بالكود ${existing.code}` } }
              : { $set: { status: "failed" }, $push: { errors: "تعذر حفظ الصف" } },
          },
        });
      }
    }
    if (ops.length) await ImportRow.bulkWrite(ops as Parameters<typeof ImportRow.bulkWrite>[0]);
    const totals = await recountTotals(job._id);
    await ImportJob.updateOne({ _id: job._id, "lease.owner": owner }, { $set: { lease: null, totals } });
    return { done: false, totals };
  } catch (err) {
    await ImportJob.updateOne({ _id: job._id, "lease.owner": owner }, { $set: { lease: null } });
    if (isDuplicateKeyError(err)) throw new AppError("CONFLICT", "تعارض أثناء الاستيراد، أعد المحاولة");
    throw err;
  }
}

async function recountTotals(jobId: Types.ObjectId) {
  const agg = await ImportRow.aggregate<{ _id: string; n: number }>([{ $match: { job: jobId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
  const m = Object.fromEntries(agg.map((a) => [a._id, a.n])) as Record<string, number>;
  const created = m.created ?? 0;
  return {
    rows: Object.values(m).reduce((a, b) => a + b, 0),
    valid: (m.valid ?? 0) + created,
    invalid: m.invalid ?? 0,
    duplicate: m.duplicate ?? 0,
    created,
    failed: m.failed ?? 0,
  };
}

export async function cancelImportJob(actor: Actor, jobId: string) {
  const job = await loadJob(actor, jobId);
  if (job.status === "completed") throw invalid("لا يمكن إلغاء استيراد مكتمل");
  await ImportJob.updateOne({ _id: job._id, status: { $ne: "completed" } }, { $set: { status: "cancelled", lease: null } });
}

/* ---------------- Error report ---------------- */
export async function buildErrorReport(actor: Actor, jobId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const job = await loadJob(actor, jobId);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الأخطاء", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "رقم الصف", key: "row", width: 10 },
    { header: "الحالة", key: "status", width: 14 },
    { header: "الأسباب", key: "errors", width: 60 },
    ...IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width })),
  ];
  styleHeader(ws.getRow(1));
  const labels: Record<string, string> = { invalid: "مرفوض", duplicate: "مكرر", failed: "فشل" };
  const cursor = ImportRow.find({ job: job._id, status: { $in: ["invalid", "duplicate", "failed"] } }).sort({ rowNumber: 1 }).lean().cursor();
  for await (const r of cursor) {
    ws.addRow({
      row: r.rowNumber,
      status: labels[r.status] ?? r.status,
      errors: r.errors.join(" | "),
      fullName: r.data.fullName,
      academicYear: r.data.academicYear,
      department: r.data.department,
      section: r.data.section,
      registrationNumber: r.data.registrationNumber,
      notes: r.data.notes,
    });
  }
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `import-errors-${String(job._id).slice(-6)}.xlsx` };
}
