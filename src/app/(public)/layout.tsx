import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="glass sticky top-0 z-10 border-b-[0.5px]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="pressable flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-white">
              <ClipboardCheck className="size-[18px]" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">Attendo nosait</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-8 pb-12">{children}</main>
      <footer className="safe-bottom py-5 text-center text-xs text-muted-foreground">صفحة للعرض فقط — لا تشارك كود الطالب إلا مع الجهات المختصة.</footer>
    </div>
  );
}
