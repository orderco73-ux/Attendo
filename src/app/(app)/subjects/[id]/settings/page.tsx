import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { getSubjectFor, subjectAssistants } from "@/server/services/subjects";
import { getSettings } from "@/server/services/settings";
import { User } from "@/server/db/models";
import { AppError } from "@/server/errors";
import { isAdmin } from "@/server/authz/policy";
import { Section, EmptyState } from "@/components/shared/page";
import { AssistantsForm } from "./assistants-form";

export default async function SubjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  let subject;
  try {
    subject = await getSubjectFor(actor, id, "manage");
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const settings = await getSettings();
  const allowed = isAdmin(actor) || settings.doctorsCanManageAssistants;
  const [current, staff] = await Promise.all([
    subjectAssistants(subject),
    User.find({ role: "staff", active: true }).select("name email staff.title").sort({ name: 1 }).limit(500).lean(),
  ]);
  return (
    <Section title="مساعدو المادة" description="أعضاء طاقم يمكنهم تسجيل حضور طلاب هذه المادة أثناء فتح الجلسة فقط (لا يمكنهم الفتح أو الإغلاق أو التعديل بعد الإغلاق).">
      {allowed ? (
        <AssistantsForm subjectId={id} current={current.map((c) => c.id)} options={staff.map((s) => ({ value: String(s._id), label: s.name, hint: s.staff?.title || s.email }))} />
      ) : (
        <EmptyState title="تعيين المساعدين غير مفعّل" description="يمكن لمدير النظام تفعيله من الإعدادات." />
      )}
    </Section>
  );
}
