import type { Copy } from "@/core/i18n";
import styles from "./Paths.module.css";
import { withLeader } from "./types";
import type { PublicLeader } from "./public-leader";

type PathsProps = {
  copy: Copy;
  leader: PublicLeader;
  diagnosticHref: string;
};

export function Paths({ copy, leader, diagnosticHref }: PathsProps) {
  return (
    <section className={styles.section} id="caminhos" aria-labelledby="paths-title">
      <div className={styles.intro}>
        <p className={styles.kicker}>{withLeader(copy.lp.nav.caminhos, leader)}</p>
        <h2 id="paths-title">{withLeader(copy.lp.caminhos.title, leader)}</h2>
        <p>{withLeader(copy.lp.caminhos.intro, leader)}</p>
      </div>
      <div className={styles.grid}>
        {copy.lp.caminhos.items.map((item) => (
          <article className={styles.card} data-path={item.key} key={item.key}>
            <div className={styles.figure} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h3>{withLeader(item.title, leader)}</h3>
            <p>{withLeader(item.text, leader)}</p>
            <a href={diagnosticHref}>{withLeader(item.cta, leader)}</a>
          </article>
        ))}
      </div>
    </section>
  );
}
