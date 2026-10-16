import { describe, expect, it } from "vitest";
import { effectiveStatus, attendancePercentage } from "@/lib/session-status";
import { haversineMeters, isValidCoordinate } from "@/lib/geo";
import { normalizeArabic, maskName } from "@/lib/arabic";
import { formatStudentCode, normalizeStudentCode } from "@/lib/codes";
import { zonedToUtc, utcToZonedParts } from "@/lib/time";
import { computeStats } from "@/server/services/reports";
import { studentQrPayload, verifyStudentQr } from "@/server/qr";
import { departmentAllowedForYear } from "@/server/services/academic";
import { signSession, verifySession } from "@/server/auth/token";

describe("session status", () => {
  const base = { status: "scheduled" as const, attendance: { mode: "scheduled" as const, opensAt: new Date("2026-10-14T08:00:00Z"), closesAt: new Date("2026-10-14T09:00:00Z") } };
  it("follows the schedule window", () => {
    expect(effectiveStatus(base, new Date("2026-10-14T07:59:59Z"))).toBe("scheduled");
    expect(effectiveStatus(base, new Date("2026-10-14T08:00:00Z"))).toBe("open");
    expect(effectiveStatus(base, new Date("2026-10-14T09:00:00Z"))).toBe("closed");
  });
  it("never reopens closed or cancelled sessions automatically", () => {
    expect(effectiveStatus({ ...base, status: "closed" }, new Date("2026-10-14T08:30:00Z"))).toBe("closed");
    expect(effectiveStatus({ ...base, status: "cancelled" }, new Date("2026-10-14T08:30:00Z"))).toBe("cancelled");
  });
  it("manual sessions keep their stored status", () => {
    expect(effectiveStatus({ status: "open", attendance: { mode: "manual" } }, new Date("2030-01-01"))).toBe("open");
  });
});

describe("percentage rule", () => {
  it("rounds half-up to one decimal and excludes excused", () => {
    expect(attendancePercentage(2, 3, 0)).toBe(66.7);
    expect(attendancePercentage(1, 3, 1)).toBe(50);
    expect(attendancePercentage(0, 0, 0)).toBeNull();
    expect(attendancePercentage(1, 1, 1)).toBeNull();
    expect(attendancePercentage(1, 8, 0)).toBe(12.5);
  });
});

describe("computeStats", () => {
  const closed = [
    { id: "a", startsAt: new Date("2026-10-01T08:00:00Z") },
    { id: "b", startsAt: new Date("2026-10-08T08:00:00Z") },
    { id: "c", startsAt: new Date("2026-10-15T08:00:00Z") },
  ];
  it("counts absences only for eligible closed lectures", () => {
    const s = computeStats(closed, new Date("2026-10-05T00:00:00Z"), [{ lecture: "b", status: "present" }]);
    expect(s).toEqual({ eligible: 2, attended: 1, excused: 0, absences: 1, percentage: 50 });
  });
  it("a record before effectiveFrom still counts", () => {
    const s = computeStats(closed, new Date("2026-10-05T00:00:00Z"), [{ lecture: "a", status: "present" }]);
    expect(s.eligible).toBe(3);
    expect(s.attended).toBe(1);
  });
  it("ignores records of non-closed lectures", () => {
    const s = computeStats(closed, new Date(0), [{ lecture: "zzz", status: "present" }, { lecture: "c", status: "excused" }]);
    expect(s).toEqual({ eligible: 3, attended: 0, excused: 1, absences: 2, percentage: 0 });
  });
});

describe("geo", () => {
  it("computes haversine distance", () => {
    const d = haversineMeters({ lat: 30.0444, lng: 31.2357 }, { lat: 30.0453, lng: 31.2357 });
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });
  it("validates coordinates", () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(30, 31)).toBe(true);
    expect(isValidCoordinate(Number.NaN, 31)).toBe(false);
  });
});

describe("arabic + codes", () => {
  it("normalises arabic variants", () => {
    expect(normalizeArabic("أحمـــد  إبراهيم مُصطفى")).toBe(normalizeArabic("احمد ابراهيم مصطفي"));
    expect(normalizeArabic("فاطمة")).toBe("فاطمه");
  });
  it("masks names", () => expect(maskName("أحمد محمد علي حسن")).toBe("أحمد محمد"));
  it("formats and normalises student codes", () => {
    expect(formatStudentCode(5)).toBe("ST00005");
    expect(formatStudentCode(123456)).toBe("ST123456");
    expect(normalizeStudentCode(" st 5 ")).toBe("ST00005");
    expect(normalizeStudentCode("ST٠٠٠١٢")).toBe("ST00012");
    expect(normalizeStudentCode("XX1")).toBeNull();
    expect(normalizeStudentCode("ST0")).toBeNull();
  });
});

describe("timezone", () => {
  it("interprets wall-clock in Africa/Cairo", () => {
    const d = zonedToUtc("2026-01-15", "09:00"); // EET (UTC+2) in winter
    expect(d.toISOString()).toBe("2026-01-15T07:00:00.000Z");
    expect(utcToZonedParts(d)).toEqual({ date: "2026-01-15", time: "09:00" });
  });
});

describe("student QR", () => {
  it("verifies authentic payloads and rejects forgeries", () => {
    const p = studentQrPayload("ST00007");
    expect(verifyStudentQr(p)).toBe("ST00007");
    expect(verifyStudentQr(p.replace("ST00007", "ST00008"))).toBeNull();
    expect(verifyStudentQr("ATD1.ST00007.aaaaaaaaaaaaaaaa")).toBeNull();
    expect(verifyStudentQr("ST00007")).toBeNull();
  });
});

describe("specialization policy", () => {
  it("enforces general/specialized departments", () => {
    expect(departmentAllowedForYear({ specializationPolicy: "general_only" }, { isGeneral: true })).toBe(true);
    expect(departmentAllowedForYear({ specializationPolicy: "general_only" }, { isGeneral: false })).toBe(false);
    expect(departmentAllowedForYear({ specializationPolicy: "specialized" }, { isGeneral: true })).toBe(false);
    expect(departmentAllowedForYear({ specializationPolicy: "any" }, { isGeneral: true })).toBe(true);
  });
});

describe("session token", () => {
  it("signs and verifies; rejects tampering", async () => {
    const t = await signSession({ sub: "abc", ver: 2, role: "admin" });
    expect(await verifySession(t)).toEqual({ sub: "abc", ver: 2, role: "admin" });
    expect(await verifySession(t.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
