import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { connectDB } from "@/server/db/connect";
import { reconcileLectures } from "@/server/services/lectures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Idempotent reconciliation of scheduled attendance sessions.
 * Called by Vercel Cron (Authorization: Bearer $CRON_SECRET) or any external scheduler.
 * Correctness does not depend on this job: every read path also reconciles lazily.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connectDB();
  const result = await reconcileLectures();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
