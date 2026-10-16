import type { NextRequest } from "next/server";
import { searchParamsObject, withActor, xlsxResponse } from "@/server/http";
import { exportSubjectReport } from "@/server/services/reports";
import { reportFilters } from "@/lib/report-filters";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(async (actor) => {
    const { buffer, fileName } = await exportSubjectReport(actor, id, reportFilters(searchParamsObject(req)));
    return xlsxResponse(buffer, fileName);
  });
}
