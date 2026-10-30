import type { Copy } from "@/core/i18n";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import styles from "./FinalCta.module.css";

type FinalCtaProps = {
  copy: Copy;
  leader: PublicLeader;
  diagnosticHref: string;
};

export function FinalCta({ copy, leader, diagnosticHref }: FinalCtaProps) {
  return (
    <section className={styles.section} aria-labelledby="final-title">
      <div>
        <h2 id="final-title">{withLeader(copy.lp.cta_final.title, leader)}</h2>
        <p>{withLeader(copy.lp.cta_final.text, leader)}</p>
        <a href={diagnosticHref}>{withLeader(copy.lp.cta_final.cta, leader)}</a>
      </div>
    </section>
  );
}
