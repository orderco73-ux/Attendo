import { Skeleton } from "@/components/ui/display";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="grid gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <Skeleton className="h-9 w-72" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
