import type { ChatCopy, ResultPlanWeek } from "./types";
import styles from "./DiagnosticChat.module.css";

interface Plan30Props {
  copy: ChatCopy["result"];
  analysis: string;
  weeks: ResultPlanWeek[];
}

export function Plan30({ copy, analysis, weeks }: Plan30Props) {
  return (
    <section className={styles.resultSection}>
      <h2>{copy.analysis_title}</h2>
      <p className={styles.analysis}>{analysis}</p>
      <h2>{copy.plan_title}</h2>
      <ol className={styles.planList}>
        {weeks.map((week) => (
          <li key={`${week.week}-${week.title}`}>
            <p className={styles.week}>{copy.week_label} {week.week}</p>
            <h3>{week.title}</h3>
            <ul>{week.actions.map((action) => <li key={action}>{action}</li>)}</ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
