import type { Copy } from "@/core/i18n";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import styles from "./DiagnosticCallout.module.css";

type DiagnosticCalloutProps = {
  copy: Copy;
  leader: PublicLeader;
  diagnosticHref: string;
};

export function DiagnosticCallout({ copy, leader, diagnosticHref }: DiagnosticCalloutProps) {
  return (
    <section className={styles.wrap} aria-labelledby="diagnostic-title">
      <div className={styles.callout}>
        <div className={styles.copy}>
          <h2 id="diagnostic-title">{withLeader(copy.lp.diagnostico_cta.title, leader)}</h2>
          <p>{withLeader(copy.lp.diagnostico_cta.text, leader)}</p>
          <ul>
            {copy.lp.diagnostico_cta.bullets.map((bullet) => (
              <li key={bullet}>{withLeader(bullet, leader)}</li>
            ))}
          </ul>
        </div>
        <div className={styles.action}>
          <a href={diagnosticHref}>{withLeader(copy.lp.diagnostico_cta.cta, leader)}</a>
          <p>{withLeader(copy.lp.diagnostico_cta.microcopy, leader)}</p>
        </div>
      </div>
    </section>
  );
}
