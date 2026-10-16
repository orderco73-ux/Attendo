"use server";
import { connectDB } from "@/server/db/connect";
import { requestIp } from "@/server/auth/session";
import { inquire, type InquiryResult } from "@/server/services/inquiry";

/** Public, unauthenticated, rate-limited attendance inquiry. */
export async function inquiryAction(code: string, verification?: string): Promise<InquiryResult> {
  try {
    await connectDB();
    return await inquire(String(code ?? "").slice(0, 30), verification ? String(verification).slice(0, 40) : undefined, await requestIp());
  } catch (err) {
    console.error("[attendo] inquiry failed", err);
    return { ok: false, message: "تعذر تنفيذ الاستعلام حاليًا. حاول لاحقًا." };
  }
}
