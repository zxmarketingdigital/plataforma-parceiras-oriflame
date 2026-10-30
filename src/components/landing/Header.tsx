import Link from "next/link";
import type { Copy, Locale } from "@/core/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LeaderLogo } from "./LeaderLogo";
import { localizedLandingHref } from "./links";
import type { PublicLeader } from "./public-leader";
import { withLeader, type TrackingParams } from "./types";
import leaderBrand from "./LeaderBrand.module.css";
import styles from "./Header.module.css";

type HeaderProps = {
  copy: Copy;
  lang: Locale;
  leader: PublicLeader;
  tracking: TrackingParams;
  diagnosticHref: string;
};

export function Header({ copy, lang, leader, tracking, diagnosticHref }: HeaderProps) {
  const brandClassName = leader.logo_url ? `${styles.brand} ${leaderBrand.withLogo}` : styles.brand;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={brandClassName} href={localizedLandingHref(lang, tracking, leader.slug)}>
          {leader.logo_url ? <LeaderLogo className={leaderBrand.logo} src={leader.logo_url} brand={leader.brand_name} /> : null}
          <span>{leader.brand_name}</span>
          <small>{leader.brand_tagline}</small>
        </Link>
        <nav className={styles.navigation} aria-label={leader.brand_name}>
          <a href="#caminhos">{withLeader(copy.lp.nav.caminhos, leader)}</a>
          <a href="#como-funciona">{withLeader(copy.lp.nav.como_funciona, leader)}</a>
          <a href="#perguntas">{withLeader(copy.lp.nav.faq, leader)}</a>
          <Link href={diagnosticHref}>{withLeader(copy.lp.nav.diagnostico, leader)}</Link>
        </nav>
        <LanguageSwitcher copy={copy} lang={lang} label={withLeader(copy.lp.nav.lang_label, leader)} leaderSlug={leader.slug} tracking={tracking} />
      </div>
    </header>
  );
}
