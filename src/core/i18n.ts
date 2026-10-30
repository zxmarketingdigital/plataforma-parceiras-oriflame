import pt from "@content/copy/pt.json";
import es from "@content/copy/es.json";
import en from "@content/copy/en.json";
import fr from "@content/copy/fr.json";
import { DEFAULT_LOCALE, isLocale } from "./locale";

export { LOCALES, DEFAULT_LOCALE, isLocale, pickLocale, type Locale } from "./locale";

const COPY = { pt, es, en, fr } as const;
export type Copy = typeof pt;

export function getCopy(locale: string): Copy {
  return (COPY as Record<string, Copy>)[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/** Troca {chave} pelos valores dados. */
export function fill(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}
