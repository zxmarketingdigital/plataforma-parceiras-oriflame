"use client";

import { useEffect, useRef } from "react";
import { labelFill, panelLocaleTag } from "./labels";
import { usePanel } from "./panel-context";
import styles from "./panel.module.css";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
/** Mantém o foco dentro de uma superfície modal e devolve-o a quem a abriu. */
export function useModalFocus<T extends HTMLElement>(onClose: () => void, active = true) {
  const container = useRef<T>(null); const restore = useRef<HTMLElement | null>(null); const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!active) return;
    restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirst = () => { const first = container.current?.querySelector<HTMLElement>(FOCUSABLE); (first ?? container.current)?.focus(); };
    const frame = window.requestAnimationFrame(focusFirst);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; } if (event.key !== "Tab" || !container.current) return; const elements = Array.from(container.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => !item.hasAttribute("disabled")); if (!elements.length) { event.preventDefault(); container.current.focus(); return; } const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && (document.activeElement === first || !container.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (document.activeElement === last || !container.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); } };
    window.addEventListener("keydown", onKey); return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); restore.current?.focus(); };
  }, [active]);
  return container;
}
export function PageHeader({ title, intro }: { title: string; intro: string }) { return <header className={styles.pageHeader}><p className={styles.eyebrow}>{usePanel().labels.brand.name}</p><h1 className={styles.pageTitle}>{title}</h1><p className={styles.pageIntro}>{intro}</p></header>; }
export function LoadingState() { return <div className={styles.loading} role="status">{usePanel().labels.common.loading}</div>; }
export function EmptyState({ children }: { children?: React.ReactNode }) { return <div className={styles.empty}>{children ?? usePanel().labels.common.empty}</div>; }
export function ErrorState({ text, retry }: { text?: string; retry?: () => void }) { const { labels } = usePanel(); return <div className={styles.error} role="alert"><p>{text ?? labels.errors.generic}</p>{retry && <button className={styles.buttonSecondary} type="button" onClick={retry}>{labels.common.retry}</button>}</div>; }
export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { const dialog = useModalFocus<HTMLElement>(onClose); const { labels } = usePanel(); return <><div className={styles.dialogBackdrop} onMouseDown={onClose} /><section ref={dialog} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}><button className={styles.iconButton} type="button" aria-label={labels.accessibility.close_dialog} onClick={onClose}>×</button><h2>{title}</h2>{children}</section></>; }
export function formatDate(value: string | undefined): string { if (!value) return usePanel().labels.common.unknown; const date = new Date(value); return Number.isNaN(date.valueOf()) ? usePanel().labels.common.unknown : new Intl.DateTimeFormat(panelLocaleTag(usePanel().locale), { dateStyle: "medium", timeStyle: "short" }).format(date); }
export function interpolate(text: string, values: Record<string, string | number | undefined>) { return labelFill(text, values); }
