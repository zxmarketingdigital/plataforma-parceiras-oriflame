import en from "@content/copy/painel/en.json";
import es from "@content/copy/painel/es.json";
import fr from "@content/copy/painel/fr.json";
import pt from "@content/copy/painel/pt.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/core/locale";

const PANEL_LABELS = { pt, es, en, fr } as const;

export type PanelLabels = typeof pt;

/** Rótulos funcionais do painel; PT é o fallback seguro para locale inválido. */
export function getPanelLabels(locale: string | undefined): PanelLabels {
  return PANEL_LABELS[isLocale(locale) ? locale : DEFAULT_LOCALE] as PanelLabels;
}

export function panelLocale(locale: string | undefined): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function panelLocaleTag(locale: Locale): string {
  return ({ pt: "pt-PT", es: "es-ES", en: "en-GB", fr: "fr-FR" } as const)[locale];
}

export function labelFill(text: string, values: Record<string, string | number | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => values[key] === undefined ? match : String(values[key]));
}
