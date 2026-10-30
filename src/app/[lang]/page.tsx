import { notFound } from "next/navigation";
import { getCopy, isLocale } from "@/core/i18n";
import { LandingPage } from "@/components/landing/LandingPage";
import { allowedTracking, diagnosticHref, type SearchValues } from "@/components/landing/links";
import { getPublicLeader } from "@/components/landing/public-leader";

type OwnerLandingPageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchValues>;
};

export default async function OwnerLandingPage({ params, searchParams }: OwnerLandingPageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [leader, search] = await Promise.all([getPublicLeader(lang), searchParams]);
  if (!leader) notFound();

  const tracking = allowedTracking(search);
  return (
    <LandingPage
      copy={getCopy(lang)}
      diagnosticHref={diagnosticHref(lang, tracking)}
      lang={lang}
      leader={leader}
      tracking={tracking}
    />
  );
}
