import mongoose, { type Types } from "mongoose";
import { connectDB } from "@/server/db/connect";
import * as models from "@/server/db/models";
import { toActor, type Actor } from "@/server/auth/actor";
import { ensureInitialStructure } from "@/server/services/academic";
import type { Permission } from "@/lib/constants";

export async function setupDb() {
  await connectDB();
  await Promise.all((Object.values(models) as unknown[]).filter((m) => typeof m === "function" && "syncIndexes" in m).map((m) => (m as mongoose.Model<unknown>).syncIndexes()));
}

export async function resetDb() {
  const cols = await mongoose.connection.db!.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}

export async function seedStructure() {
  const college = await ensureInitialStructure();
  const years = await models.AcademicYear.find({ college: college._id }).sort({ level: 1 }).lean();
  const depts = await models.Department.find({ college: college._id }).lean();
  const byCode = (c: string) => depts.find((d) => d.code === c)!;
  return { college, years, gen: byCode("GEN"), trn: byCode("TRN"), tch: byCode("TCH"), adm: byCode("ADM") };
}

let n = 0;
export async function makeUser(role: "admin" | "doctor" | "staff", staff?: { permissions: Permission[]; scope: { college: Types.ObjectId; academicYears?: Types.ObjectId[]; departments?: Types.ObjectId[]; sections?: Types.ObjectId[] } }): Promise<Actor> {
  n++;
  const u = await models.User.create({
    name: `${role} ${n}`,
    email: `${role}${n}@test.local`,
    role,
    passwordHash: "$2b$04$abcdefghijklmnopqrstuuJ0Yh3E8ZkC9l1sH0yM2v9w8o1B2c3d4",
    staff: staff
      ? {
          kind: "class_leader" as const,
          permissions: staff.permissions,
          scope: { college: staff.scope.college, academicYears: staff.scope.academicYears ?? [], departments: staff.scope.departments ?? [], sections: staff.scope.sections ?? [] },
        }
      : null,
  });
  return toActor(u);
}
