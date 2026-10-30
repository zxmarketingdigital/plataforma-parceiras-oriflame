import { z } from "zod";
import { withUser, type SessionUser } from "@/core/db/client";
import { can, HttpError } from "@/core/permissions";
import { forbidden } from "./common";
import { scopeSql, STAGES } from "./leads";

const DAY = 86400000;

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/, "Data inválida (use AAAA-MM-DD)")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida");

export const metricsQuerySchema = z.object({ from: dateParam.optional(), to: dateParam.optional() });

/** `from` inclusivo; `to` inclusivo ao dia (AAAA-MM-DD) ou ao instante (ISO). Por omissão: últimos 30 dias. */
export function resolveRange(q: { from?: string; to?: string }, now = new Date()): { from: Date; to: Date } {
  const to = q.to ? (q.to.length === 10 ? new Date(Date.parse(q.to) + DAY) : new Date(q.to)) : new Date(now.getTime() + 1);
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * DAY);
  if (from >= to) throw new HttpError(400, "invalid_range", "O intervalo é inválido");
  if (to.getTime() - from.getTime() > 3660 * DAY) throw new HttpError(400, "invalid_range", "O intervalo é demasiado longo");
  return { from, to };
}

interface Row { key: string | null; label?: string | null; leads: number; completed: number; signed: number }

const SIGNED = `c.stage IN ('inscrito','ativo')`;
const DONE = `EXISTS (SELECT 1 FROM diagnostics d WHERE d.contact_id = c.id AND d.status = 'concluido')`;
const AGG = `count(*)::int AS leads, (count(*) FILTER (WHERE ${DONE}))::int AS completed, (count(*) FILTER (WHERE ${SIGNED}))::int AS signed`;

const rate = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 10000);

/**
 * Métricas por coorte: contactos CRIADOS em [from, to). `signed` = etapa inscrito ou ativo hoje.
 * `rate` = signed / leads; `completion_rate` = completed / leads.
 */
export async function getMetrics(user: SessionUser, q: { from?: string; to?: string }) {
  if (!can(user, "leads.read")) throw forbidden();
  const { from, to } = resolveRange(q);
  return withUser(user, async (db) => {
    const base = (extra = "", sel = "", group = "") => {
      const params: unknown[] = [];
      const scope = scopeSql(user, params);
      params.push(from, to);
      const n = params.length;
      const sql = `SELECT ${sel}${sel ? ", " : ""}${AGG} FROM contacts c ${extra} WHERE ${scope} AND c.created_at >= $${n - 1} AND c.created_at < $${n} ${group}`;
      return { sql, params };
    };
    const run = async (extra: string, sel: string, group: string): Promise<Record<string, unknown>[]> => {
      const { sql, params } = base(extra, sel, group);
      return (await db.query(sql, params)).rows;
    };
    const finish = (rows: Record<string, unknown>[]): Row[] =>
      rows
        .map((r) => ({ key: (r.key as string | null) ?? null, label: (r.label as string | null | undefined) ?? undefined, leads: r.leads as number, completed: r.completed as number, signed: r.signed as number }))
        .sort((a, b) => b.leads - a.leads || String(a.key).localeCompare(String(b.key)));

    const totalsRow = (await run("", "", ""))[0] as { leads: number; completed: number; signed: number };
    const bySource = finish(await run("", "coalesce(nullif(c.source, ''), 'direto') AS key", "GROUP BY 1"));
    const byLeader = finish(await run("JOIN users u ON u.id = c.owner_id", "u.id::text AS key, u.name AS label", "GROUP BY u.id, u.name"));
    const byCountry = finish(await run("", "coalesce(upper(c.country), '—') AS key", "GROUP BY 1"));
    const byLocale = finish(await run("", "c.locale AS key", "GROUP BY 1"));
    const stageRows = await run("", "c.stage::text AS key", "GROUP BY 1");
    const byStage = STAGES.map((s) => ({ stage: s, leads: (stageRows.find((r) => r.key === s)?.leads as number | undefined) ?? 0 }));
    const byDay = (await run("", "to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS key", "GROUP BY 1 ORDER BY 1")).map((r) => ({
      day: r.key as string,
      leads: r.leads as number,
      completed: r.completed as number,
      signed: r.signed as number,
    }));

    const totals = { leads: totalsRow.leads, completed: totalsRow.completed, signed: totalsRow.signed, rate: rate(totalsRow.signed, totalsRow.leads), completion_rate: rate(totalsRow.completed, totalsRow.leads) };
    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totals,
      by_source: bySource,
      by_leader: byLeader.map((r) => ({ ...r, id: r.key })),
      by_country: byCountry,
      by_locale: byLocale,
      by_stage: byStage,
      by_day: byDay,
    };
  });
}
