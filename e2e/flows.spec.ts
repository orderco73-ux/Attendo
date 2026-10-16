import { expect, test, type Page } from "@playwright/test";

// Local demo accounts created by scripts/dev-memory.ts (in-memory DB only).
const ADMIN = { email: "admin@demo.local", password: "Admin@123456" };
const DOCTOR = { email: "doctor@demo.local", password: "Demo@12345" };
const LEADER = { email: "leader@demo.local", password: "Demo@12345" };

async function login(page: Page, u: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(u.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "دخول" }).click();
  await page.waitForURL("**/dashboard");
}

test("anonymous users are redirected to login; wrong password shows a generic error", async ({ page }) => {
  await page.goto("/students");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "غير صحيحة" })).toBeVisible();
});

test("admin creates a student with an auto-generated code", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/students/new");
  await page.getByLabel("الاسم الكامل (رباعي)").fill("طالب اختبار تلقائي جديد");
  await page.getByRole("button", { name: "إضافة الطالب" }).click();
  await page.waitForURL(/\/students\/[a-f0-9]{24}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/ST\d{5}/);
});

test("doctor runs a full manual session: create, open, mark, close, report", async ({ page }) => {
  await login(page, DOCTOR);
  await page.goto("/subjects");
  await page.getByRole("link", { name: "فسيولوجيا الرياضة" }).click();
  await page.getByRole("link", { name: "المحاضرات" }).click();
  await page.getByRole("button", { name: "محاضرة جديدة" }).click();
  await page.getByLabel("عنوان المحاضرة").fill("محاضرة اختبار E2E");
  await page.getByLabel("طريقة الحضور").selectOption("staff_only");
  await page.getByRole("button", { name: "إنشاء المحاضرة" }).click();
  await page.getByRole("link", { name: /محاضرة اختبار E2E/ }).first().click();

  await page.getByRole("button", { name: "بدء الحضور" }).click();
  await page.getByRole("button", { name: "فتح الحضور" }).click();
  await expect(page.getByText("تسجيل الحضور بواسطة الطاقم")).toBeVisible();

  await page.getByLabel("بحث عن طالب").fill("ST00001");
  await page.getByRole("button", { name: "تسجيل" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ST00001" })).toBeVisible();

  await page.getByRole("button", { name: "إغلاق الحضور" }).click();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect(page.getByText("مغلقة").first()).toBeVisible();

  await page.goto(page.url().replace(/\/lectures\/.*/, "/subjects"));
  await page.getByRole("link", { name: "فسيولوجيا الرياضة" }).click();
  await page.getByRole("link", { name: "تقرير الحضور" }).click();
  await expect(page.getByText("المحاضرات المغلقة")).toBeVisible();
});

test("leader sees only in-scope students and cannot open admin pages", async ({ page }) => {
  await login(page, LEADER);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/denied=1/);
  await page.goto("/students");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  // Every visible student belongs to the leader's year (الفرقة الأولى).
  for (const text of await rows.allInnerTexts()) expect(text).toContain("الفرقة الأولى");
});

test("public inquiry returns minimal data and a generic error for unknown codes @mobile", async ({ page }) => {
  await page.goto("/inquiry");
  await page.getByLabel("كود الطالب").fill("ST99999");
  await page.getByRole("button", { name: "استعلام" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "لم يتم العثور" })).toBeVisible();
  await page.getByLabel("كود الطالب").fill("st1");
  await page.getByRole("button", { name: "استعلام" }).click();
  await expect(page.getByText("ST00001")).toBeVisible();
  // No horizontal overflow on phones
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("RTL document and Arabic language are set", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});
