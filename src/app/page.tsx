import Link from "next/link";
import { ClipboardCheck, LogIn, Search } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <ClipboardCheck className="size-5" />
          </span>
          <span className="text-lg font-bold">Attendo nosait</span>
        </div>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          دخول الطاقم
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-16">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-primary">نظام إدارة الحضور الجامعي</span>
          <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">حضور المحاضرات، بدقة وبدون أوراق</h1>
          <p className="mt-3 text-muted-foreground">
            جدولة المحاضرات، فتح وإغلاق جلسات الحضور، التسجيل بالموقع أو رمز QR، وتقارير الغياب التفصيلية — في مكان واحد.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/inquiry" className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-brand-soft/40">
            <Search className="size-6 text-primary" />
            <h2 className="mt-3 font-semibold">استعلام الطالب عن الحضور</h2>
            <p className="mt-1 text-sm text-muted-foreground">أدخل كود الطالب لعرض عدد مرات الحضور والغياب في كل مادة.</p>
          </Link>
          <Link href="/login" className="group rounded-lg border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-brand-soft/40">
            <LogIn className="size-6 text-primary" />
            <h2 className="mt-3 font-semibold">دخول الإدارة والدكاترة والطاقم</h2>
            <p className="mt-1 text-sm text-muted-foreground">إدارة المواد والطلاب وجلسات الحضور والتقارير.</p>
          </Link>
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Attendo nosait</footer>
    </div>
  );
}
