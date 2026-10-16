"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SubjectTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  if (pathname.endsWith("/edit")) return null;
  return (
    <nav className="no-print -mx-4 overflow-x-auto border-b-[0.5px] px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
