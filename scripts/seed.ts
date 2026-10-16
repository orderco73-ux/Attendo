/**
 * Idempotent initial configuration: Faculty of Physical Education, years 1–4 and the four departments.
 * Safe to run multiple times (only inserts what is missing).
 *
 *   npm run seed
 *   npm run seed -- --demo   # also creates demo doctor/leader/students/subject (local only!)
 */
import "dotenv/config";
import { config } from "dotenv";
import mongoose from "mongoose";

config({ path: ".env.local", override: false });

async function main() {
  const { connectDB } = await import("../src/server/db/connect");
  const models = await import("../src/server/db/models");
  const { ensureInitialStructure } = await import("../src/server/services/academic");

  await connectDB();
  for (const m of Object.values(models)) {
    if (typeof m === "function" && "syncIndexes" in m) await (m as mongoose.Model<unknown>).syncIndexes();
  }
  const college = await ensureInitialStructure();
  console.log(`✔ Initial structure ready (college ${college.code}).`);

  if (process.argv.includes("--demo")) {
    if (process.env.NODE_ENV === "production" || /mongodb\+srv/.test(process.env.MONGODB_URI ?? "")) {
      if (!process.argv.includes("--force")) throw new Error("Refusing to create demo data on a remote/production database (add --force to override).");
    }
    await seedDemo(college._id);
  }
  await mongoose.disconnect();
}

async function seedDemo(collegeId: mongoose.Types.ObjectId) {
  const { User, AcademicYear, Department, Student, Subject, Enrollment } = await import("../src/server/db/models");
  const { hashPassword } = await import("../src/server/auth/password");
  const { reserveStudentSeqs, dedupeKeyFor } = await import("../src/server/services/students");
  const { formatStudentCode } = await import("../src/lib/codes");
  const { normalizeArabic } = await import("../src/lib/arabic");

  const pw = await hashPassword("Demo@12345");
  const years = await AcademicYear.find({ college: collegeId }).sort({ level: 1 }).lean();
  const depts = await Department.find({ college: collegeId }).lean();
  const gen = depts.find((d) => d.isGeneral)!;
  const trn = depts.find((d) => d.code === "TRN")!;

  const upsertUser = async (email: string, doc: Record<string, unknown>) =>
    (await User.findOne({ email })) ?? (await User.create({ email, passwordHash: pw, ...doc }));
  const doctor = await upsertUser("doctor@demo.local", { name: "د. أحمد السيد", role: "doctor" });
  await upsertUser("leader@demo.local", {
    name: "محمد قائد الفرقة الأولى",
    role: "staff",
    staff: { kind: "class_leader", title: "قائد الفرقة الأولى", permissions: ["students.view", "students.create", "students.edit", "attendance.view", "attendance.mark", "reports.view", "enrollment.request"], scope: { college: collegeId, academicYears: [years[0]._id], departments: [], sections: [] } },
  });

  const first = ["أحمد", "محمد", "محمود", "علي", "يوسف", "عمر", "سارة", "مريم", "نور", "فاطمة", "خالد", "هبة"];
  const last = ["حسن", "إبراهيم", "عبد الله", "مصطفى", "سعيد", "عادل", "كمال", "رمضان"];
  const people: { name: string; year: (typeof years)[number]; dept: typeof gen }[] = [];
  for (let i = 0; i < 40; i++) {
    const year = years[i % 4];
    people.push({ name: `${first[i % first.length]} ${last[(i * 3) % last.length]} ${first[(i + 5) % first.length]}`, year, dept: year.level <= 2 ? gen : trn });
  }
  let created = 0;
  for (const p of people) {
    const key = dedupeKeyFor(collegeId, p.name);
    if (await Student.exists({ dedupeKey: key })) continue;
    const seq = await reserveStudentSeqs(1);
    await Student.create({ code: formatStudentCode(seq), seq, fullName: p.name, nameKey: normalizeArabic(p.name), college: collegeId, academicYear: p.year._id, department: p.dept._id, dedupeKey: key });
    created++;
  }
  let subject = await Subject.findOne({ code: "PE101" });
  if (!subject) {
    subject = await Subject.create({ name: "فسيولوجيا الرياضة", code: "PE101", college: collegeId, eligibility: { academicYears: [years[0]._id], departments: [], sections: [] }, doctors: [doctor._id], requiresEnrollmentApproval: true });
  }
  const eligible = await Student.find({ academicYear: years[0]._id, status: "active" }).select("_id").lean();
  for (const s of eligible) {
    await Enrollment.updateOne({ subject: subject._id, student: s._id }, { $setOnInsert: { status: "approved", effectiveFrom: new Date(Date.now() - 30 * 86400000), decidedBy: doctor._id, decidedAt: new Date() } }, { upsert: true });
  }
  console.log(`✔ Demo data: ${created} students, subject PE101, doctor@demo.local / leader@demo.local (password Demo@12345).`);
}

main().catch(async (e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});
