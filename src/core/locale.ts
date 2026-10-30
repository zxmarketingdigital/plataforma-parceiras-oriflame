// Sem dependência da copy: pode ser importado pelo middleware (edge).
export const LOCALES = ["pt", "es", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Escolhe o idioma a partir do Accept-Language ("pt-PT,pt;q=0.9,en;q=0.8"). */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}
