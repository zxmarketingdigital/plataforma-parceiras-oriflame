import { fill } from "./i18n";
import { isLocale } from "./locale";

// Sem "server-only", sem base de dados e sem zod: este módulo é o que os testes, o servidor e os componentes partilham.

export const BRAND_NAME_MAX = 60;
export const BRAND_TAGLINE_MAX = 120;

export const IMAGE_URL_MAX = 500;
export const IMAGE_URL_MESSAGE = "Use um caminho local (/avatars/...) ou um URL https";

/**
 * Caminho local (/avatars/...) ou URL https. É o mesmo teste para a foto e para o logótipo da líder.
 * "//host/x" não é caminho local: o browser trata-o como URL de outro servidor.
 */
export function isLeaderImageUrl(value: string): boolean {
  return (/^\/(?!\/)[A-Za-z0-9._\/-]+$/.test(value) && !value.includes("..")) || /^https:\/\/[^\s]+$/.test(value);
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Marca de exibição: a marca da líder ou, vazia, o nome dela. */
export function resolveBrandName(leaderName: string, brandName: unknown): string {
  return asText(brandName) ?? leaderName;
}

/** Slogan no idioma pedido (jsonb por idioma) ou, vazio, o fallback. */
export function resolveBrandTagline(tagline: unknown, lang: string, fallback: string): string {
  const byLocale = tagline && typeof tagline === "object" && !Array.isArray(tagline) ? (tagline as Record<string, unknown>) : undefined;
  return (isLocale(lang) ? asText(byLocale?.[lang]) : null) ?? fallback;
}

/** Logótipo só se passar no mesmo teste de escrita (caminho local ou https): o que a base guarda não chega ao HTML sem esta porta. */
export function resolveLogoUrl(value: unknown): string | null {
  const url = asText(value);
  return url && url.length <= IMAGE_URL_MAX && isLeaderImageUrl(url) ? url : null;
}

/** Os três campos de marca como a página pública os mostra: marca (ou nome), slogan no idioma (ou o da plataforma) e logótipo. */
export function resolvePublicBrand(
  row: { name: string; brand_name?: unknown; brand_tagline?: unknown; logo_url?: unknown },
  lang: string,
  fallbackTagline: string,
): { brand_name: string; brand_tagline: string; logo_url: string | null } {
  return {
    brand_name: resolveBrandName(row.name, row.brand_name),
    brand_tagline: resolveBrandTagline(row.brand_tagline, lang, fallbackTagline),
    logo_url: resolveLogoUrl(row.logo_url),
  };
}

/** Variáveis de substituição de todo o texto público de uma líder. */
export function brandVars(leaderName: string, brandName?: unknown): { leader_name: string; brand_name: string } {
  return { leader_name: leaderName, brand_name: resolveBrandName(leaderName, brandName) };
}

/**
 * Aplica fill() a todas as strings de um bloco de texto (objetos e listas incluídos), de uma vez.
 * Marcadores sem valor ({currency}, {name}...) ficam como estão: o fill() só troca o que tem variável.
 */
export function fillDeep<T>(value: T, vars: Record<string, string | number | undefined>): T {
  if (typeof value === "string") return fill(value, vars) as T;
  if (Array.isArray(value)) return value.map((item) => fillDeep(item, vars)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillDeep(v, vars)])) as T;
  return value;
}
