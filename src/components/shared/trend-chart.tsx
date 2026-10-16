"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single-series daily attendance rate (closed sessions only). One hue, thin bars, hover tooltip. */
export function TrendChart({ data }: { data: { day: string; rate: number; present: number }[] }) {
  return (
    <div className="h-56 w-full" dir="ltr" role="img" aria-label="نسبة الحضور اليومية لآخر 14 يومًا">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            cursor={{ fill: "#EFF6FF" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "var(--font-arabic)", direction: "rtl", fontSize: 12 }}
            formatter={(v, _n, item) => [`${v}% (${(item?.payload as { present: number })?.present ?? 0} حضور)`, "نسبة الحضور"]}
            labelFormatter={(l) => `يوم ${l}`}
          />
          <Bar dataKey="rate" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
