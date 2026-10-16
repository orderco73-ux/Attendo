import { z } from "zod";
import { User } from "@/server/db/models";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { AppError } from "@/server/errors";
import { hit } from "./rate-limit";
import { audit } from "./audit";
import { toActor, type Actor } from "@/server/auth/actor";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح").max(200),
  password: z.string().min(1, "أدخل كلمة المرور").max(200),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC = "البريد الإلكتروني أو كلمة المرور غير صحيحة";

/**
 * Verifies credentials with IP rate limiting and per-account lockout.
 * Returns the user document needed to issue the session cookie.
 */
export async function authenticate(input: unknown, ip: string) {
  const { email, password } = loginSchema.parse(input);

  const rl = await hit(`login:ip:${ip}`, 10, 15 * 60);
  if (!rl.allowed) throw new AppError("RATE_LIMITED", "محاولات دخول كثيرة. حاول بعد 15 دقيقة.");

  const user = await User.findOne({ email }).select("+passwordHash name email role staff active sessionVersion failedLogins lockedUntil");
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError("UNAUTHORIZED", GENERIC);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("RATE_LIMITED", "تم إيقاف الحساب مؤقتًا بسبب محاولات فاشلة متكررة. حاول لاحقًا.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || !user.active) {
    if (!ok) {
      const failed = (user.failedLogins ?? 0) + 1;
      await User.updateOne(
        { _id: user._id },
        failed >= MAX_FAILED
          ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } }
          : { $set: { failedLogins: failed } },
      );
      await audit(toActor(user), { action: "auth.login_failed", summary: `محاولة دخول فاشلة (${failed})`, entityType: "user", entityId: user._id, ip });
    }
    throw new AppError("UNAUTHORIZED", GENERIC);
  }
  await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit(toActor(user), { action: "auth.login", summary: "تسجيل دخول ناجح", entityType: "user", entityId: user._id, ip });
  return user;
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية"),
    newPassword: z.string().min(8, "8 أحرف على الأقل").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: "كلمتا المرور غير متطابقتين" });

/** Changes own password and bumps sessionVersion (logs out other sessions). Returns the updated user. */
export async function changeOwnPassword(actor: Actor, input: unknown) {
  const data = changePasswordSchema.parse(input);
  const user = await User.findById(actor.oid).select("+passwordHash sessionVersion role");
  if (!user) throw new AppError("UNAUTHORIZED");
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION", "كلمة المرور الحالية غير صحيحة", { currentPassword: "كلمة المرور الحالية غير صحيحة" });
  }
  user.passwordHash = await hashPassword(data.newPassword);
  user.sessionVersion += 1;
  await user.save();
  await audit(actor, { action: "auth.password_changed", summary: "تغيير كلمة المرور", entityType: "user", entityId: actor.id });
  return user;
}
