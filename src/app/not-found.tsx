import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="max-w-md rounded-2xl bg-card shadow-card p-8 text-center">
        <SearchX className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-lg font-bold">الصفحة غير موجودة</h1>
        <p className="mt-1 text-sm text-muted-foreground">قد يكون الرابط غير صحيح أو ليس لديك صلاحية للوصول إلى هذا العنصر.</p>
        <Button asChild className="mt-5">
          <Link href="/dashboard">العودة للوحة التحكم</Link>
        </Button>
      </div>
    </div>
  );
}
