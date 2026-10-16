import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "attendo_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionClaims {
  sub: string;
  ver: number;
  role: string;
}

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ver: claims.ver, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("attendo")
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "attendo", algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number" || typeof payload.role !== "string") return null;
    return { sub: payload.sub, ver: payload.ver, role: payload.role };
  } catch {
    return null;
  }
}
