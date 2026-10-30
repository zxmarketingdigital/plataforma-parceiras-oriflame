import Link from "next/link";
import type { Copy, Locale } from "@/core/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { localizedLandingHref } from "./links";
import type { TrackingParams } from "./types";
import styles from "./Header.module.css";

type HeaderProps = {
  copy: Copy;
  lang: Locale;
  leaderSlug: string | null;
  tracking: TrackingParams;
  diagnosticHref: string;
};

export function Header({ copy, lang, leaderSlug, tracking, diagnosticHref }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href={localizedLandingHref(lang, tracking, leaderSlug)}>
          <span>{copy.brand.name}</span>
          <small>{copy.brand.tagline}</small>
        </Link>
        <nav className={styles.navigation} aria-label={copy.brand.name}>
          <a href="#caminhos">{copy.lp.nav.caminhos}</a>
          <a href="#como-funciona">{copy.lp.nav.como_funciona}</a>
          <a href="#perguntas">{copy.lp.nav.faq}</a>
          <Link href={diagnosticHref}>{copy.lp.nav.diagnostico}</Link>
        </nav>
        <LanguageSwitcher copy={copy} lang={lang} leaderSlug={leaderSlug} tracking={tracking} />
      </div>
    </header>
  );
}
