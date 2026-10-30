"use client";

import { useEffect, useRef } from "react";
import { Bubble } from "./Bubble";
import { TypingIndicator } from "./TypingIndicator";
import type { Answer } from "./types";
import styles from "./DiagnosticChat.module.css";

interface ConversationProps {
  greeting: string[];
  afterContact?: string | null;
  answers: Answer[];
  reaction?: string | null;
  children: React.ReactNode;
  typingLabel?: string | null;
}

export function Conversation({ greeting, afterContact, answers, reaction, children, typingLabel }: ConversationProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    feed.scrollTo({ top: feed.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [afterContact, answers.length, children, reaction, typingLabel]);

  return (
    <div className={styles.feed} ref={feedRef}>
      <div className={styles.live} aria-live="polite" aria-atomic="false" />
      {greeting.map((message, index) => <Bubble key={`${message}-${index}`}>{message}</Bubble>)}
      {afterContact ? <Bubble>{afterContact}</Bubble> : null}
      {answers.map((answer) => <Bubble key={`${answer.key}-${answer.value}`} tone="sent">{answer.label}</Bubble>)}
      {reaction ? <Bubble tone="system">{reaction}</Bubble> : null}
      {typingLabel ? <TypingIndicator label={typingLabel} /> : null}
      {children}
    </div>
  );
}
