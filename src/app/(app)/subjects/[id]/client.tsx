"use client";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm";
import { removeEnrollmentAction } from "@/server/actions/teaching";

export function RemoveEnrollment({ subjectId, enrollmentId, name }: { subjectId: string; enrollmentId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<UserMinus />}
      triggerProps={{ variant: "ghost", size: "icon-sm", "aria-label": "إزالة من المادة", className: "text-muted-foreground hover:text-destructive" }}
      destructive
      title={`إزالة ${name} من المادة؟`}
      description="لن يظهر في كشوف الحضور القادمة. سجلات الحضور السابقة تبقى محفوظة."
      confirmLabel="إزالة"
      success="تمت الإزالة"
      onConfirm={async () => {
        const r = await removeEnrollmentAction(subjectId, enrollmentId);
        if (r.ok) router.refresh();
        return r;
      }}
    />
  );
}
