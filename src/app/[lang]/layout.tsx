import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCopy, isLocale, LOCALES, type Locale } from "@/core/i18n";

type LocalizedLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>;

export async function generateMetadata({ params }: Omit<LocalizedLayoutProps, "children">): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "pt";
  const copy = getCopy(locale);

  return {
    title: copy.brand.name,
    description: copy.brand.tagline,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((item) => [item, `/${item}`])),
    },
  };
}

export default async function LocalizedLayout({ children, params }: LocalizedLayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <div lang={lang}>{children}</div>;
}
