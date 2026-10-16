export const STUDENT_CODE_PREFIX = "ST";
export const STUDENT_CODE_REGEX = /^ST\d{5,}$/;

export function formatStudentCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error("Invalid sequence");
  return STUDENT_CODE_PREFIX + String(seq).padStart(5, "0");
}

/** Accepts user input like " st 5 ", "st00005", "ST00005" and returns the canonical code or null. */
export function normalizeStudentCode(input: string): string | null {
  const raw = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\s+/g, "").toUpperCase();
  const m = /^ST(\d{1,9})$/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return formatStudentCode(n);
}
