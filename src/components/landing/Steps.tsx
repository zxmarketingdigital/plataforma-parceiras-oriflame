import type { Copy } from "@/core/i18n";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import styles from "./Steps.module.css";

type StepsProps = {
  copy: Copy;
  leader: PublicLeader;
};

export function Steps({ copy, leader }: StepsProps) {
  return (
    <section className={styles.section} id="como-funciona" aria-labelledby="steps-title">
      <div className={styles.heading}>
        <p className={styles.kicker}>{withLeader(copy.lp.nav.como_funciona, leader)}</p>
        <h2 id="steps-title">{withLeader(copy.lp.passos.title, leader)}</h2>
        <p>{withLeader(copy.lp.passos.intro, leader)}</p>
      </div>
      <ol className={styles.steps}>
        {copy.lp.passos.items.map((item) => (
          <li key={item.n}>
            <span aria-hidden="true">{item.n}</span>
            <h3>{withLeader(item.title, leader)}</h3>
            <p>{withLeader(item.text, leader)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
