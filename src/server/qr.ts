import { createHmac, timingSafeEqual } from "node:crypto";
import { STUDENT_CODE_REGEX } from "@/lib/codes";

/*
 * Student QR payload: "ATD1.<code>.<sig>", sig = first 16 chars of base64url(HMAC-SHA256(QR_SECRET, "student:" + code)).
 * Possession of the printed card is required for QR-based methods; a typed code alone is not enough.
 */

function secret() {
  const s = process.env.QR_SECRET || process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("QR_SECRET must be set (>= 32 characters)");
  return s;
}

function sign(code: string) {
  return createHmac("sha256", secret()).update("student:" + code).digest("base64url").slice(0, 16);
}

export function studentQrPayload(code: string): string {
  return `ATD1.${code}.${sign(code)}`;
}

/** Returns the student code if the payload is authentic, otherwise null. */
export function verifyStudentQr(payload: string): string | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ATD1") return null;
  const [, code, sig] = parts;
  if (!STUDENT_CODE_REGEX.test(code)) return null;
  const expected = Buffer.from(sign(code));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return code;
}
