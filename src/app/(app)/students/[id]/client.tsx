"use client";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/shared/confirm";
import { archiveStudentAction } from "@/server/actions/students";

export function ArchiveButton({ id, archived, trigger }: { id: string; archived: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={trigger}
      triggerProps={{ variant: "outline" }}
      destructive={!archived}
      title={archived ? "استعادة الطالب؟" : "أرشفة الطالب؟"}
      description={archived ? "سيعود الطالب للقوائم النشطة." : "لن يظهر الطالب في القوائم النشطة ولن يتمكن من تسجيل الحضور. يبقى سجل حضوره السابق كما هو ولا يُعاد استخدام كوده."}
      confirmLabel={archived ? "استعادة" : "أرشفة"}
      success="تم التحديث"
      onConfirm={async () => {
        const r = await archiveStudentAction(id, !archived);
        if (r.ok) router.refresh();
        return r;
      }}
    />
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
      <Printer /> طباعة البطاقة
    </Button>
  );
}
