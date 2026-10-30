import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DiagnosticChat } from "@/components/chat/DiagnosticChat";
import type { SupportedLanguage, UTMValues } from "@/components/chat/types";
import { getPublicLeader } from "@/components/landing/public-leader";
import { brandVars, fillDeep } from "@/core/brand";
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

async function resolveLeader(lang: SupportedLanguage, query: Record<string, string | string[] | undefined>) {
  const requestedLeader = await getPublicLeader(lang, firstValue(query.l));
  return requestedLeader ?? await getPublicLeader(lang);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { lang: requestedLanguage } = await params;
  if (!supportedLanguages.has(requestedLanguage as SupportedLanguage)) return {};
  const lang = requestedLanguage as SupportedLanguage;
  const leader = await resolveLeader(lang, await searchParams);
  return leader ? { title: leader.brand_name, description: leader.brand_tagline } : {};
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
  const copy = getCopy(lang);
  const leader = await resolveLeader(lang, query);
  if (!leader) notFound();

  const filledChat = fillDeep(copy.chat, brandVars(leader.name, leader.brand_name));
  return <DiagnosticChat copy={filledChat} lang={lang} leader={leader} utm={queryUtm(query)} />;
}
