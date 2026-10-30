import { notFound } from "next/navigation";
import { DiagnosticChat } from "@/components/chat/DiagnosticChat";
import type { SupportedLanguage, UTMValues } from "@/components/chat/types";
import { getPublicLeader } from "@/components/landing/public-leader";
import { getCopy } from "@/core/i18n";

const supportedLanguages = new Set<SupportedLanguage>(["pt", "es", "en", "fr"]);
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function queryUtm(searchParams: Record<string, string | string[] | undefined>): UTMValues | undefined {
  const entries = utmKeys.flatMap((key) => {
    const value = firstValue(searchParams[key]);
    if (!value) return [];
    return [[key, value] as const];
  });
  return entries.length > 0 ? Object.fromEntries(entries) as UTMValues : undefined;
}

export default async function DiagnosticPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: requestedLanguage } = await params;
  if (!supportedLanguages.has(requestedLanguage as SupportedLanguage)) notFound();
  const lang = requestedLanguage as SupportedLanguage;
  const query = await searchParams;
  const leaderSlug = firstValue(query.l);
  const copy = getCopy(lang);
  const requestedLeader = await getPublicLeader(lang, leaderSlug);
  const leader = requestedLeader ?? await getPublicLeader(lang);
  if (!leader) notFound();

  return <DiagnosticChat copy={copy.chat} lang={lang} leader={leader} utm={queryUtm(query)} />;
}
