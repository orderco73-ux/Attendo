"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-card shadow-card p-8 text-center">
      <AlertTriangle className="mx-auto size-10 text-warning" />
      <h1 className="mt-3 text-lg font-bold">حدث خطأ غير متوقع</h1>
      <p className="mt-1 text-sm text-muted-foreground">تعذر تحميل هذه الصفحة. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع مدير النظام.</p>
      <Button className="mt-5" onClick={reset}>إعادة المحاولة</Button>
    </div>
  );
}
