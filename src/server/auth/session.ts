import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/server/db/connect";
import { User } from "@/server/db/models";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./token";
import { toActor, type Actor } from "./actor";
import { AppError } from "@/server/errors";
import type { Role } from "@/lib/constants";

export async function setSessionCookie(user: { _id: unknown; sessionVersion: number; role: string }) {
  const token = await signSession({ sub: String(user._id), ver: user.sessionVersion, role: user.role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Loads and validates the current user (memoised per request). Returns null when not signed in. */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  await connectDB();
  const user = await User.findById(claims.sub).select("name email role staff active sessionVersion").lean();
  if (!user || !user.active || user.sessionVersion !== claims.ver) return null;
  return toActor(user);
});

/** For server components/pages: redirects to /login when not authenticated. */
export async function requireActor(roles?: Role[]): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (roles && !roles.includes(actor.role)) redirect("/dashboard?denied=1");
  return actor;
}

/** For actions/route handlers: throws instead of redirecting. */
export async function actorOrThrow(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new AppError("UNAUTHORIZED");
  return actor;
}

export async function requestIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
