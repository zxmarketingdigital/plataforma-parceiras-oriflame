import type { Copy } from "@/core/i18n";
import { EditorialArtwork } from "./EditorialArtwork";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import styles from "./Hero.module.css";

type HeroProps = {
  copy: Copy;
  leader: PublicLeader;
  diagnosticHref: string;
};

export function Hero({ copy, leader, diagnosticHref }: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{withLeader(copy.lp.hero.eyebrow, leader)}</p>
        <h1 id="hero-title">
          {withLeader(copy.lp.hero.title, leader)} <em>{withLeader(copy.lp.hero.title_em, leader)}</em>
        </h1>
        <p className={styles.subtitle}>{withLeader(copy.lp.hero.subtitle, leader)}</p>
        <div className={styles.actions}>
          <a className={styles.primary} href={diagnosticHref}>
            {withLeader(copy.lp.hero.cta_primary, leader)}
          </a>
          <a className={styles.secondary} href="#caminhos">
            {withLeader(copy.lp.hero.cta_secondary, leader)}
          </a>
        </div>
        <p className={styles.microcopy}>{withLeader(copy.lp.hero.microcopy, leader)}</p>
      </div>
      <EditorialArtwork />
    </section>
  );
}
