import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCopy, isLocale } from "@/core/i18n";
import { LandingPage } from "@/components/landing/LandingPage";
import { allowedTracking, diagnosticHref, type SearchValues } from "@/components/landing/links";
import { getPublicLeader } from "@/components/landing/public-leader";

type LeaderLandingPageProps = {
  params: Promise<{ lang: string; lider: string }>;
  searchParams: Promise<SearchValues>;
};

export async function generateMetadata({ params }: Pick<LeaderLandingPageProps, "params">): Promise<Metadata> {
  const { lang, lider } = await params;
  if (!isLocale(lang)) return {};

  const leader = await getPublicLeader(lang, lider);
  if (!leader) return {};

  return { title: leader.brand_name, description: leader.brand_tagline };
}

export default async function LeaderLandingPage({ params, searchParams }: LeaderLandingPageProps) {
  const { lang, lider } = await params;
  if (!isLocale(lang)) notFound();

  const [leader, search] = await Promise.all([getPublicLeader(lang, lider), searchParams]);
  if (!leader) notFound();

  const tracking = allowedTracking(search);
  return (
    <LandingPage
      copy={getCopy(lang)}
      diagnosticHref={diagnosticHref(lang, tracking, leader.slug)}
      lang={lang}
      leader={leader}
      tracking={tracking}
    />
  );
}
