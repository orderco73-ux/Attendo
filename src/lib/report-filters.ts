import type { ReportFilters } from "@/server/services/reports";

/** Parses report filters from URL search params (shared by pages and export routes). */
export function reportFilters(sp: Record<string, string | undefined>): ReportFilters {
  return {
    q: sp.q,
    academicYear: sp.year,
    department: sp.department,
    section: sp.section,
    from: sp.from,
    to: sp.to,
    sort: (["code", "name", "percentage", "absences"] as const).find((s) => s === sp.sort),
    dir: sp.dir === "desc" ? "desc" : "asc",
    page: Number(sp.page) || 1,
    below: sp.below ? Number(sp.below) : undefined,
  };
}
