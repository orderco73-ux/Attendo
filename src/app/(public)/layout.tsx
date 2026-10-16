import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="size-4" />
            </span>
            <span className="font-bold">Attendo nosait</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="py-5 text-center text-xs text-muted-foreground">صفحة للعرض فقط — لا تشارك كود الطالب إلا مع الجهات المختصة.</footer>
    </div>
  );
}
