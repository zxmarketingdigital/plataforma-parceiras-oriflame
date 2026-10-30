import type { Copy } from "@/core/i18n";
import styles from "./DiagnosticCallout.module.css";

type DiagnosticCalloutProps = {
  copy: Copy;
  diagnosticHref: string;
};

export function DiagnosticCallout({ copy, diagnosticHref }: DiagnosticCalloutProps) {
  return (
    <section className={styles.wrap} aria-labelledby="diagnostic-title">
      <div className={styles.callout}>
        <div className={styles.copy}>
          <h2 id="diagnostic-title">{copy.lp.diagnostico_cta.title}</h2>
          <p>{copy.lp.diagnostico_cta.text}</p>
          <ul>
            {copy.lp.diagnostico_cta.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <div className={styles.action}>
          <a href={diagnosticHref}>{copy.lp.diagnostico_cta.cta}</a>
          <p>{copy.lp.diagnostico_cta.microcopy}</p>
        </div>
      </div>
    </section>
  );
}
