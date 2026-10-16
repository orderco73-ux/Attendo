import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, withActor } from "@/server/http";
import { createImportJob, MAX_IMPORT_BYTES } from "@/server/services/imports";
import { invalid } from "@/server/errors";
import { assertPermission } from "@/server/authz/policy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return withActor(async (actor) => {
    assertSameOrigin(req);
    assertPermission(actor, "students.import");
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_IMPORT_BYTES + 64 * 1024) throw invalid("حجم الملف يتجاوز 2 ميجابايت");
    const fd = await req.formData();
    const file = fd.get("file");
    const college = String(fd.get("college") ?? "");
    if (!(file instanceof File)) throw invalid("لم يتم إرفاق ملف");
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw invalid("الملف يجب أن يكون بصيغة .xlsx");
    if (file.size > MAX_IMPORT_BYTES) throw invalid("حجم الملف يتجاوز 2 ميجابايت");
    if (actor.staff && actor.staff.scope.college !== college) throw invalid("الكلية خارج نطاق صلاحياتك");
    const buf = Buffer.from(await file.arrayBuffer());
    const jobId = await createImportJob(actor, file.name, buf, college);
    return NextResponse.json({ jobId });
  });
}
