import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/server/db/connect";
import { actorOrThrow } from "@/server/auth/session";
import type { Actor } from "@/server/auth/actor";
import { AppError, httpStatus, toPublicError } from "@/server/errors";

export function jsonError(err: unknown) {
  const e = toPublicError(err);
  return NextResponse.json({ error: e.message, fieldErrors: e.fieldErrors }, { status: httpStatus(e.code), headers: { "Cache-Control": "no-store" } });
}

/** Rejects cross-site POSTs to route handlers (Server Actions have this built in). */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new AppError("FORBIDDEN");
  } catch {
    throw new AppError("FORBIDDEN");
  }
}

export async function withActor(fn: (actor: Actor) => Promise<Response>): Promise<Response> {
  try {
    await connectDB();
    const actor = await actorOrThrow();
    return await fn(actor);
  } catch (err) {
    return jsonError(err);
  }
}

export function xlsxResponse(buffer: Buffer, fileName: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function searchParamsObject(req: NextRequest): Record<string, string | undefined> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
