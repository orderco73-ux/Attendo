import type { NextRequest } from "next/server";
import { withActor, xlsxResponse } from "@/server/http";
import { buildErrorReport } from "@/server/services/imports";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(async (actor) => {
    const { buffer, fileName } = await buildErrorReport(actor, id);
    return xlsxResponse(buffer, fileName);
  });
}
