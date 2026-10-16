import type { NextRequest } from "next/server";
import { searchParamsObject, withActor, xlsxResponse } from "@/server/http";
import { exportStudents } from "@/server/services/reports";
import { buildStudentFilter } from "@/server/services/students";
import { assertPermission } from "@/server/authz/policy";
import { audit } from "@/server/services/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return withActor(async (actor) => {
    assertPermission(actor, "students.view");
    const sp = searchParamsObject(req);
    const filter = buildStudentFilter({ q: sp.q, academicYear: sp.year, department: sp.department, section: sp.section, status: sp.status });
    const { buffer, fileName } = await exportStudents(actor, filter);
    await audit(actor, { action: "student.export", summary: "تصدير قائمة الطلاب", entityType: "student" });
    return xlsxResponse(buffer, fileName);
  });
}
