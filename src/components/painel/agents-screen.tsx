"use client";

import { useCallback, useEffect, useState } from "react";
import { panelRequest } from "./api-client";
import { labelFill } from "./labels";
import { hasPermission, usePanel } from "./panel-context";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "./shared";
import type { AgentRecord } from "./types";
import styles from "./panel.module.css";

function agentsFrom(value: unknown): AgentRecord[] { if (Array.isArray(value)) return value as AgentRecord[]; const data = value as { items?: AgentRecord[] }; return Array.isArray(data?.items) ? data.items : []; }
export function AgentsScreen() {
  const { labels, permissions } = usePanel(); const [agents, setAgents] = useState<AgentRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setAgents(agentsFrom(await panelRequest<unknown>("/api/agents"))); } catch { setError(labels.errors.load_agents); } finally { setLoading(false); } }, [labels.errors.load_agents]);
  useEffect(() => { void load(); }, [load]);
  if (!hasPermission(permissions, "agents.read")) return <><PageHeader title={labels.agents.title} intro={labels.agents.intro} /><ErrorState text={labels.common.forbidden} /></>;
  return <><PageHeader title={labels.agents.title} intro={labels.agents.intro} />{loading ? <LoadingState /> : error ? <ErrorState text={error} retry={() => void load()} /> : agents.length ? <section className={styles.metricGrid}>{agents.map((agent, index) => { const status = agent.status ?? "fallback"; return <article key={agent.nome ?? index} className={styles.panelCard}><h2>{agent.nome ?? labels.common.unknown}</h2>{agent.descricao && <p className={styles.muted}>{agent.descricao}</p>}<dl className={styles.detailGrid}><div><dt>{labels.agents.sector}</dt><dd>{agent.setor ?? labels.common.unknown}</dd></div><div><dt>{labels.agents.languages}</dt><dd>{agent.idiomas?.map((language) => labels.locales[language as keyof typeof labels.locales] ?? labels.common.unknown).join(", ") ?? labels.common.unknown}</dd></div><div><dt>{labels.agents.human_approval}</dt><dd>{agent.requer_aprovacao_humana ? labels.common.yes : labels.common.no}</dd></div><div><dt>{labels.agents.timeout}</dt><dd>{agent.timeout_ms === undefined ? labels.common.unknown : labelFill(labels.agents.timeout_seconds, { seconds: agent.timeout_ms / 1000 })}</dd></div><div><dt>{labels.agents.fallback}</dt><dd>{agent.fallback ?? labels.common.unknown}</dd></div><div><dt>{labels.agents.status}</dt><dd><span className={`${styles.badge} ${status === "fallback" ? styles.badgeNeutral : styles.badgeNew}`}>{labels.agent_status[status as keyof typeof labels.agent_status] ?? labels.agent_status.unknown}</span></dd></div></dl></article>; })}</section> : <EmptyState>{labels.agents.no_agents}</EmptyState>}</>;
}
