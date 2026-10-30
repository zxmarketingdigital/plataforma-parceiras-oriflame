import styles from "./DiagnosticChat.module.css";

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className={`${styles.bubble} ${styles.bubbleReceived} ${styles.typing}`} aria-live="polite">
      <span className={styles.typingLabel}>{label}</span>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}
