import styles from "./DiagnosticChat.module.css";

export function Progress({ completed }: { completed: number }) {
  return (
    <div className={styles.progress} aria-hidden="true">
      <span className={styles.progressFill} style={{ transform: `scaleX(${Math.min(1, Math.max(0, completed / 7))})` }} />
    </div>
  );
}
