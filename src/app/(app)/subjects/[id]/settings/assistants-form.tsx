"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckList, handleResult } from "@/components/shared/form";
import { setAssistantsAction } from "@/server/actions/admin";

export function AssistantsForm({ subjectId, current, options }: { subjectId: string; current: string[]; options: { value: string; label: string; hint?: string }[] }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  return (
    <div className="grid max-w-xl gap-4 p-5">
      <CheckList options={options} value={value} onChange={setValue} emptyText="لا يوجد أعضاء طاقم نشطون" maxHeight="20rem" />
      <div>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await setAssistantsAction(subjectId, value);
              if (handleResult(null, res, "تم حفظ المساعدين")) router.refresh();
            })
          }
        >
          حفظ ({value.length})
        </Button>
      </div>
    </div>
  );
}
