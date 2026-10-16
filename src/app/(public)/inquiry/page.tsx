import { connectDB } from "@/server/db/connect";
import { getSettings } from "@/server/services/settings";
import { InquiryClient } from "./inquiry-client";

export const metadata = { title: "استعلام الطالب عن الحضور" };
export const dynamic = "force-dynamic";

export default async function InquiryPage() {
  let verification: "none" | "registration_number" = "none";
  try {
    await connectDB();
    verification = (await getSettings()).inquiryVerification;
  } catch {
    verification = "none";
  }
  return (
    <>
      <h1 className="text-2xl font-bold">استعلام عن الحضور والغياب</h1>
      <p className="mt-1 text-sm text-muted-foreground">أدخل كود الطالب (مثل ST00005) لعرض ملخص حضورك في كل مادة.</p>
      <InquiryClient needsVerification={verification === "registration_number"} />
    </>
  );
}
