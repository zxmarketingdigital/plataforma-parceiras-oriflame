import type { Locale } from "@/core/i18n";
import type { TrackingParams } from "./types";

const TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type SearchValues = Readonly<Record<string, string | string[] | undefined>>;

export function allowedTracking(search: SearchValues): TrackingParams {
  return TRACKING_KEYS.reduce<TrackingParams>((params, key) => {
    const value = search[key];
    if (typeof value === "string" && value.trim()) params[key] = value;
    return params;
  }, {});
}

function queryString(params: TrackingParams, leaderSlug?: string | null): string {
  const query = new URLSearchParams();
  if (leaderSlug) query.set("l", leaderSlug);
  for (const key of TRACKING_KEYS) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const result = query.toString();
  return result ? `?${result}` : "";
}

export function diagnosticHref(lang: Locale, tracking: TrackingParams, leaderSlug?: string | null): string {
  return `/${lang}/diagnostico${queryString(tracking, leaderSlug)}`;
}

export function localizedLandingHref(lang: Locale, tracking: TrackingParams, leaderSlug?: string | null): string {
  const leaderPath = leaderSlug ? `/${encodeURIComponent(leaderSlug)}` : "";
  return `/${lang}${leaderPath}${queryString(tracking)}`;
}
