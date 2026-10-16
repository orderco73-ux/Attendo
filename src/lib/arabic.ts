/**
 * Normalise Arabic (and Latin) text for search and duplicate matching:
 * strips diacritics/tatweel, unifies alef/yaa/taa-marbuta/hamza forms, Arabic-Indic digits, whitespace and case.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, "") // tashkeel
    .replace(/ـ/g, "") // tatweel
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ → ا
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي") // ئ → ي
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse whitespace for display names. */
export function cleanName(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** First two words of a name — minimal disclosure on public pages. */
export function maskName(fullName: string): string {
  const parts = cleanName(fullName).split(" ");
  return parts.slice(0, 2).join(" ");
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
