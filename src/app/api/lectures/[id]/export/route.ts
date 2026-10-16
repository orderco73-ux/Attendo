import type { NextRequest } from "next/server";
import { withActor, xlsxResponse } from "@/server/http";
import { exportLecture } from "@/server/services/reports";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(async (actor) => {
    const { buffer, fileName } = await exportLecture(actor, id);
    return xlsxResponse(buffer, fileName);
  });
}
