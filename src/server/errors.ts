export type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "يجب تسجيل الدخول أولًا",
  FORBIDDEN: "ليس لديك صلاحية لتنفيذ هذا الإجراء",
  NOT_FOUND: "العنصر المطلوب غير موجود",
  VALIDATION: "البيانات المدخلة غير صحيحة",
  CONFLICT: "تعارض مع بيانات موجودة",
  RATE_LIMITED: "محاولات كثيرة، حاول مرة أخرى لاحقًا",
  INTERNAL: "حدث خطأ غير متوقع، حاول مرة أخرى",
};

/** Expected, user-facing error. Message is safe to show to the client (Arabic). */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
  }
}

export const forbidden = (msg?: string) => new AppError("FORBIDDEN", msg);
export const notFound = (msg?: string) => new AppError("NOT_FOUND", msg);
export const invalid = (msg?: string, fieldErrors?: Record<string, string>) => new AppError("VALIDATION", msg, fieldErrors);
export const conflict = (msg?: string) => new AppError("CONFLICT", msg);

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export function httpStatus(code: ErrorCode): number {
  return { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409, RATE_LIMITED: 429, INTERNAL: 500 }[code];
}

export function toPublicError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isDuplicateKeyError(err)) return new AppError("CONFLICT", "قيمة مكررة: يوجد سجل بنفس البيانات");
  console.error("[attendo] unexpected error", err);
  return new AppError("INTERNAL");
}
