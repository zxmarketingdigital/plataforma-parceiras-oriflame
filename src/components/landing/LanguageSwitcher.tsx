import Link from "next/link";
import { LOCALES, type Copy, type Locale } from "@/core/i18n";
import { localizedLandingHref } from "./links";
import type { TrackingParams } from "./types";
import styles from "./LanguageSwitcher.module.css";

type LanguageSwitcherProps = {
  copy: Copy;
  lang: Locale;
  leaderSlug: string | null;
  tracking: TrackingParams;
  /** Rótulo acessível já preenchido com a marca/nome da líder (withLeader). */
  label?: string;
};

export function LanguageSwitcher({ copy, lang, leaderSlug, tracking, label }: LanguageSwitcherProps) {
  return (
    <nav className={styles.switcher} aria-label={label ?? copy.lp.nav.lang_label}>
      {LOCALES.map((locale) => (
        <Link
          aria-current={locale === lang ? "page" : undefined}
          className={locale === lang ? styles.active : undefined}
          href={localizedLandingHref(locale, tracking, leaderSlug)}
          key={locale}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
