import type { NextRequest } from "next/server";
import { withActor, xlsxResponse } from "@/server/http";
import { buildTemplate } from "@/server/services/imports";
import { assertPermission } from "@/server/authz/policy";
import { isObjectId } from "@/server/ids";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return withActor(async (actor) => {
    assertPermission(actor, "students.import");
    const college = req.nextUrl.searchParams.get("college");
    const buffer = await buildTemplate(isObjectId(college) ? college : undefined);
    return xlsxResponse(buffer, "students-template.xlsx");
  });
}
