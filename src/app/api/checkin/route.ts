import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/server/db/connect";
import { selfCheckin } from "@/server/services/attendance";
import { assertSameOrigin, clientIp, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "attendo_device";

/** Public student self check-in. All validation happens in the attendance service using server time. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await connectDB();
    const body = await req.json().catch(() => null);
    const existing = req.cookies.get(DEVICE_COOKIE)?.value;
    const deviceId = existing && /^[a-f0-9-]{36}$/.test(existing) ? existing : randomUUID();
    const outcome = await selfCheckin(body, { ip: clientIp(req), deviceId });
    const res = NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
    if (!existing) {
      res.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  } catch (err) {
    return jsonError(err);
  }
}
