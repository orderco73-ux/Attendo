import { z } from "zod";
import { Setting } from "@/server/db/models";
import type { Actor } from "@/server/auth/actor";
import { assertAdmin } from "@/server/authz/policy";
import { audit } from "./audit";

export const settingsSchema = z.object({
  institutionName: z.string().trim().min(2).max(150),
  inquiryEnabled: z.boolean(),
  inquiryVerification: z.enum(["none", "registration_number"]),
  showUpcomingInInquiry: z.boolean(),
  defaultRadiusM: z.coerce.number().int().min(10).max(5000),
  maxLocationAccuracyM: z.coerce.number().int().min(10).max(5000),
  defaultRequiresEnrollmentApproval: z.boolean(),
  doctorsCanManageAssistants: z.boolean(),
  lowAttendanceThreshold: z.coerce.number().min(0).max(100),
});
export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  institutionName: "كلية التربية الرياضية",
  inquiryEnabled: true,
  inquiryVerification: "none",
  showUpcomingInInquiry: true,
  defaultRadiusM: 100,
  maxLocationAccuracyM: 150,
  defaultRequiresEnrollmentApproval: true,
  doctorsCanManageAssistants: true,
  lowAttendanceThreshold: 75,
};

export async function getSettings(): Promise<AppSettings> {
  const docs = await Setting.find({ key: { $in: Object.keys(DEFAULT_SETTINGS) } }).lean();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const d of docs) merged[d.key] = d.value;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function updateSettings(actor: Actor, input: unknown) {
  assertAdmin(actor);
  const data = settingsSchema.parse(input);
  await Setting.bulkWrite(
    Object.entries(data).map(([key, value]) => ({
      updateOne: { filter: { key }, update: { $set: { value, updatedBy: actor.oid } }, upsert: true },
    })),
  );
  await audit(actor, { action: "settings.update", summary: "تحديث إعدادات النظام", entityType: "settings", meta: data });
  return data;
}
