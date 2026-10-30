import styles from "./DiagnosticChat.module.css";

interface BubbleProps {
  children: React.ReactNode;
  tone?: "received" | "sent" | "system";
}

export function Bubble({ children, tone = "received" }: BubbleProps) {
  const toneClass = { received: styles.bubbleReceived, sent: styles.bubbleSent, system: styles.bubbleSystem }[tone];
  return <div className={`${styles.bubble} ${toneClass}`}>{children}</div>;
}
