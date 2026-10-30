"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { panelRequest } from "./api-client";
import { panelLocaleTag } from "./labels";
import { usePanel } from "./panel-context";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "./shared";
import type { MetricValue, MetricsData } from "./types";
import styles from "./panel.module.css";

function isoDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function metricRows(values: MetricValue[] | undefined) { return (values ?? []).map((item) => { const key = item.key ?? item.stage ?? ""; return { key, label: (item.label ?? key) || "—", leads: Number(item.leads ?? 0) }; }); }
function translatedLabel(labels: ReturnType<typeof usePanel>["labels"], kind: "country" | "locale" | "stage", row: { key: string; label: string }) {
  if (kind === "country") return labels.countries[row.key as keyof typeof labels.countries] ?? row.label;
  if (kind === "locale") return labels.locales[row.key as keyof typeof labels.locales] ?? row.label;
  return labels.stages[row.key as keyof typeof labels.stages] ?? row.label;
}

export function MetricsScreen() {
  const { labels, locale } = usePanel(); const [from, setFrom] = useState(() => isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1))); const [to, setTo] = useState(() => isoDay(new Date())); const [data, setData] = useState<MetricsData>(); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const version = useRef(0);
  const load = useCallback(async () => { const current = ++version.current; setLoading(true); setError(""); try { const result = await panelRequest<MetricsData>(`/api/metrics?${new URLSearchParams({ from, to })}`); if (current === version.current) setData(result); } catch { if (current === version.current) setError(labels.errors.load_metrics); } finally { if (current === version.current) setLoading(false); } }, [from, labels.errors.load_metrics, to]);
  useEffect(() => { void load(); }, [load]);
  const cards = useMemo(() => [{ label: labels.metrics.leads, value: data?.totals?.leads ?? 0 }, { label: labels.metrics.completed, value: data?.totals?.completed ?? 0 }, { label: labels.metrics.signed, value: data?.totals?.signed ?? 0 }, { label: labels.metrics.rate, value: data?.totals?.rate ?? 0, rate: true }], [data, labels]);
  const groups: Array<[string, MetricValue[] | undefined, "none" | "country" | "locale" | "stage"]> = [[labels.metrics.by_source, data?.by_source, "none"], [labels.metrics.by_leader, data?.by_leader, "none"], [labels.metrics.by_country, data?.by_country, "country"], [labels.metrics.by_locale, data?.by_locale, "locale"], [labels.metrics.by_stage, data?.by_stage, "stage"]];
  return <><PageHeader title={labels.metrics.title} intro={labels.metrics.intro} /><form className={styles.filterGrid} onSubmit={(event) => { event.preventDefault(); void load(); }}><label className={styles.field}>{labels.filters.from}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className={styles.field}>{labels.filters.to}<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className={styles.button} type="submit">{labels.filters.apply}</button></form>{loading && !data ? <LoadingState /> : error ? <ErrorState text={error} retry={() => void load()} /> : <><section className={styles.metricGrid}>{cards.map((card) => <article className={styles.metricCard} key={card.label}><span>{card.label}</span><div className={styles.metricValue}>{card.rate ? new Intl.NumberFormat(panelLocaleTag(locale), { style: "percent", maximumFractionDigits: 1 }).format(card.value > 1 ? card.value / 100 : card.value) : new Intl.NumberFormat(panelLocaleTag(locale)).format(card.value)}</div></article>)}</section><section className={styles.metricGrid}>{groups.map(([title, values, kind]) => <Breakdown key={title} title={title} values={values} kind={kind} />)}</section></>}</>;
}

function Breakdown({ title, values, kind }: { title: string; values: MetricValue[] | undefined; kind: "none" | "country" | "locale" | "stage" }) { const { labels, locale } = usePanel(); const rows = metricRows(values); const max = Math.max(0, ...rows.map((row) => row.leads)); const total = rows.reduce((sum, row) => sum + row.leads, 0); return <article className={styles.breakdown}><h2>{title}</h2>{rows.length ? rows.map((row) => { const ratio = max > 0 ? row.leads / max : 0; const label = kind === "none" ? row.label : translatedLabel(labels, kind, row); return <div className={styles.barRow} key={`${row.key}-${label}`}><div className={styles.barHeader}><span>{label}</span><span>{new Intl.NumberFormat(panelLocaleTag(locale)).format(row.leads)} · {new Intl.NumberFormat(panelLocaleTag(locale), { style: "percent", maximumFractionDigits: 0 }).format(total > 0 ? row.leads / total : 0)}</span></div><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${ratio * 100}%` }} /></div></div>; }) : <EmptyState>{labels.metrics.no_data}</EmptyState>}</article>; }
