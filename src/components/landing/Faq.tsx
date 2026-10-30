import type { Copy } from "@/core/i18n";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import styles from "./Faq.module.css";

type FaqProps = {
  copy: Copy;
  leader: PublicLeader;
};

export function Faq({ copy, leader }: FaqProps) {
  return (
    <section className={styles.section} id="perguntas" aria-labelledby="faq-title">
      <div className={styles.heading}>
        <p>{withLeader(copy.lp.nav.faq, leader)}</p>
        <h2 id="faq-title">{withLeader(copy.lp.faq.title, leader)}</h2>
      </div>
      <div className={styles.items}>
        {copy.lp.faq.items.map((item) => (
          <details key={item.q}>
            <summary>{withLeader(item.q, leader)}</summary>
            <p>{withLeader(item.a, leader)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
