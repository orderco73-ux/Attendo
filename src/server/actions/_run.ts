import "server-only";
import { ZodError } from "zod";
import { connectDB } from "@/server/db/connect";
import { actorOrThrow } from "@/server/auth/session";
import type { Actor } from "@/server/auth/actor";
import { toPublicError } from "@/server/errors";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Wraps a server action: connects DB, authenticates, converts errors into a safe ActionResult. */
export async function run<T>(fn: (actor: Actor) => Promise<T>): Promise<ActionResult<T>> {
  try {
    await connectDB();
    const actor = await actorOrThrow();
    const data = await fn(actor);
    return { ok: true, data };
  } catch (err) {
    return toResult(err);
  }
}

/** Same as `run` but without authentication (public endpoints). */
export async function runPublic<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    await connectDB();
    return { ok: true, data: await fn() };
  } catch (err) {
    return toResult(err);
  }
}

function toResult(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof ZodError) {
    const fieldErrors = zodFieldErrors(err);
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "البيانات المدخلة غير صحيحة", fieldErrors };
  }
  // Let Next.js redirects / notFound propagate.
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
  const e = toPublicError(err);
  return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
}
