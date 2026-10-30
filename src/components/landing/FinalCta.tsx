import type { Copy } from "@/core/i18n";
import styles from "./FinalCta.module.css";

type FinalCtaProps = {
  copy: Copy;
  diagnosticHref: string;
};

export function FinalCta({ copy, diagnosticHref }: FinalCtaProps) {
  return (
    <section className={styles.section} aria-labelledby="final-title">
      <div>
        <h2 id="final-title">{copy.lp.cta_final.title}</h2>
        <p>{copy.lp.cta_final.text}</p>
        <a href={diagnosticHref}>{copy.lp.cta_final.cta}</a>
      </div>
    </section>
  );
}
