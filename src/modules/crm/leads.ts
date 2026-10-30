import { z } from "zod";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { withUser, type SessionUser } from "@/core/db/client";
import { emit } from "@/core/events";
import { canReassign, can } from "@/core/permissions";
import { forbidden, isUuid, notFound } from "./common";

// Todas as queries correm dentro de withUser (o RLS morde) e repetem o filtro de org + subárvore (dupla proteção).

export const STAGES = ["novo", "em_contacto", "interessado", "inscrito", "ativo", "perdido"] as const;
export type Stage = (typeof STAGES)[number];
export const SIGNED_STAGES: Stage[] = ["inscrito", "ativo"];

export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 200;

/** Cláusula de visibilidade na app: mesma org e dono dentro da subárvore do utilizador. */
export function scopeSql(user: SessionUser, params: unknown[], alias = "c"): string {
  params.push(user.orgId);
  const o = params.length;
  params.push(user.path);
  const p = params.length;
  return `${alias}.org_id = $${o} AND ${alias}.owner_id IN (SELECT id FROM users WHERE org_id = $${o} AND path <@ $${p}::ltree)`;
}

// ---------------------------------------------------------------- listagem

export const leadFiltersSchema = z.object({
  stage: z.enum(STAGES).optional(),
  owner: z.union([z.literal("me"), z.string().refine(isUuid, "uuid inválido")]).optional(),
  country: z.string().trim().min(2).max(3).optional(),
  locale: z.enum(["pt", "es", "en", "fr"]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

/** Converte os parâmetros de URL (`URLSearchParams`) nos filtros validados; vazio conta como ausente. */
export function parseLeadFilters(sp: URLSearchParams): LeadFilters {
  const raw: Record<string, string> = {};
  for (const k of ["stage", "owner", "country", "locale", "q", "page", "limit"]) {
    const v = sp.get(k);
    if (v !== null && v.trim() !== "") raw[k] = v;
  }
  return leadFiltersSchema.parse(raw);
}

function filterSql(user: SessionUser, f: LeadFilters, params: unknown[], withStage: boolean): string {
  const where = [scopeSql(user, params)];
  if (withStage && f.stage) {
    params.push(f.stage);
    where.push(`c.stage = $${params.length}::contact_stage`);
  }
  if (f.owner) {
    params.push(f.owner === "me" ? user.id : f.owner);
    where.push(`c.owner_id = $${params.length}`);
  }
  if (f.country) {
    params.push(f.country.toUpperCase());
    where.push(`upper(c.country) = $${params.length}`);
  }
  if (f.locale) {
    params.push(f.locale);
    where.push(`c.locale = $${params.length}`);
  }
  if (f.q) {
    params.push(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
    const n = params.length;
    where.push(`(c.name ILIKE $${n} OR c.email ILIKE $${n} OR c.whatsapp_e164 ILIKE $${n})`);
  }
  return where.join(" AND ");
}

const LEAD_COLUMNS = `
  c.id, c.name, c.email, c.whatsapp_e164, c.country, c.locale, c.intent, c.stage, c.lost_reason, c.source, c.is_demo,
  c.created_at, c.updated_at,
  u.id AS owner_id, u.name AS owner_name, lp.slug AS owner_slug,
  d.status AS diagnostic_status, d.profile AS diagnostic_profile, d.completed_at AS diagnostic_completed_at,
  (d.scenarios->'provavel'->>'month12')::numeric AS month12_provavel, d.scenarios->>'currency' AS currency`;

const LEAD_FROM = `
  FROM contacts c
  JOIN users u ON u.id = c.owner_id
  LEFT JOIN leader_profiles lp ON lp.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT status, profile, completed_at, scenarios FROM diagnostics
     WHERE contact_id = c.id ORDER BY (status = 'concluido') DESC, created_at DESC LIMIT 1
  ) d ON true`;

function leadRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    whatsapp_e164: r.whatsapp_e164,
    country: r.country,
    locale: r.locale,
    intent: r.intent,
    stage: r.stage,
    lost_reason: r.lost_reason,
    source: r.source,
    is_demo: r.is_demo,
    created_at: r.created_at,
    updated_at: r.updated_at,
    owner: { id: r.owner_id, name: r.owner_name, slug: r.owner_slug ?? null },
    diagnostic: r.diagnostic_status
      ? {
          status: r.diagnostic_status,
          profile: r.diagnostic_profile,
          completed_at: r.diagnostic_completed_at,
          month12_provavel: r.month12_provavel === null || r.month12_provavel === undefined ? null : Number(r.month12_provavel),
          currency: r.currency ?? null,
        }
      : null,
  };
}

export async function listLeads(user: SessionUser, f: LeadFilters) {
  return withUser(user, async (db) => {
    const p1: unknown[] = [];
    const where = filterSql(user, f, p1, true);
    const total = Number((await db.query(`SELECT count(*) AS n FROM contacts c WHERE ${where}`, p1)).rows[0].n);

    const p2: unknown[] = [];
    const where2 = filterSql(user, f, p2, true);
    p2.push(f.limit, (f.page - 1) * f.limit);
    const rows = (
      await db.query(
        `SELECT ${LEAD_COLUMNS} ${LEAD_FROM} WHERE ${where2} ORDER BY c.created_at DESC, c.id LIMIT $${p2.length - 1} OFFSET $${p2.length}`,
        p2,
      )
    ).rows;

    // Contagem por etapa ignora o filtro de etapa: serve as colunas do kanban.
    const p3: unknown[] = [];
    const where3 = filterSql(user, f, p3, false);
    const byStage = (await db.query(`SELECT c.stage, count(*)::int AS n FROM contacts c WHERE ${where3} GROUP BY c.stage`, p3)).rows;
    const counts: Record<string, number> = Object.fromEntries(STAGES.map((s) => [s, 0]));
    for (const r of byStage) counts[r.stage] = r.n;

    return { items: rows.map(leadRow), page: f.page, limit: f.limit, total, counts_by_stage: counts };
  });
}

// ---------------------------------------------------------------- ficha

async function loadContact(db: PoolClient, user: SessionUser, id: string, lock = false) {
  const params: unknown[] = [id];
  const scope = scopeSql(user, params);
  const r = await db.query(
    `SELECT c.*, u.name AS owner_name, u.path::text AS owner_path, u.active AS owner_active
       FROM contacts c JOIN users u ON u.id = c.owner_id
      WHERE c.id = $1 AND ${scope} ${lock ? "FOR UPDATE OF c" : ""}`,
    params,
  );
  return r.rows[0] as undefined | (Record<string, unknown> & { id: string; org_id: string; owner_id: string; owner_path: string; stage: Stage; lost_reason: string | null });
}

export async function getLead(user: SessionUser, id: string) {
  return withUser(user, async (db) => {
    const c = await loadContact(db, user, id);
    if (!c) throw notFound();
    const { owner_path, owner_active, ...contact } = c;
    const diagnostics = (
      await db.query(
        `SELECT id, status, locale, answers, profile, scenarios, assumptions, plan_version, analysis_text, plan30, ai_used,
                (pdf_path IS NOT NULL) AS pdf_ready, created_at, completed_at
           FROM diagnostics WHERE contact_id = $1 ORDER BY created_at DESC`,
        [id],
      )
    ).rows;
    const activities = (
      await db.query(
        `SELECT a.id, a.type, a.payload, a.created_at, a.user_id, u.name AS user_name
           FROM activities a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.contact_id = $1 ORDER BY a.created_at DESC, a.id`,
        [id],
      )
    ).rows;
    return {
      contact: {
        ...contact,
        owner: { id: c.owner_id, name: c.owner_name, active: owner_active },
      },
      diagnostics,
      activities,
      // O botão "mudar dono" só aparece a quem está acima do dono atual.
      can_reassign: canReassign(user, owner_path, user.path),
    };
  });
}

// ---------------------------------------------------------------- alterações

export const patchLeadSchema = z
  .object({
    stage: z.enum(STAGES).optional(),
    lost_reason: z.string().trim().max(500).nullable().optional(),
    owner_id: z.string().refine(isUuid, "uuid inválido").optional(),
  })
  .strict()
  .refine((v) => v.stage !== undefined || v.lost_reason !== undefined || v.owner_id !== undefined, "Nada para alterar");
export type PatchLead = z.infer<typeof patchLeadSchema>;

export async function patchLead(user: SessionUser, id: string, body: PatchLead) {
  if (!can(user, "leads.write")) throw forbidden();
  return withUser(user, async (db) => {
    const c = await loadContact(db, user, id, true);
    if (!c) throw notFound();

    let newOwnerId: string | null = null;
    let newOwnerName: string | null = null;
    if (body.owner_id !== undefined && body.owner_id !== c.owner_id) {
      // O novo dono tem de existir na subárvore de quem pede (o RLS esconde o resto); fora dela → 403.
      const params: unknown[] = [body.owner_id, user.orgId, user.path];
      const t = (
        await db.query(`SELECT id, name, path::text AS path FROM users WHERE id = $1 AND org_id = $2 AND active AND path <@ $3::ltree`, params)
      ).rows[0] as undefined | { id: string; name: string; path: string };
      if (!t || !canReassign(user, c.owner_path, t.path)) throw forbidden();
      newOwnerId = t.id;
      newOwnerName = t.name;
    }

    const fromStage = c.stage;
    const toStage = body.stage ?? fromStage;
    const stageChanged = toStage !== fromStage;
    let lost: string | null = c.lost_reason;
    if (toStage !== "perdido") lost = null;
    else if (body.lost_reason !== undefined) lost = body.lost_reason || null;
    const lostChanged = lost !== c.lost_reason;

    if (!stageChanged && !lostChanged && !newOwnerId) return { ok: true, changed: false };

    await db.query(
      `UPDATE contacts SET stage = $2::contact_stage, lost_reason = $3, owner_id = coalesce($4::uuid, owner_id), updated_at = now() WHERE id = $1`,
      [id, toStage, lost, newOwnerId],
    );

    if (stageChanged || lostChanged) {
      await db.query(`INSERT INTO activities (contact_id, user_id, type, payload) VALUES ($1, $2, 'stage', $3)`, [
        id,
        user.id,
        { from: fromStage, to: toStage, lost_reason: toStage === "perdido" ? lost : null },
      ]);
    }
    if (stageChanged) await emit(db, user.orgId, "lead.etapa_alterada", { contact_id: id, from: fromStage, to: toStage, by: user.id }, "crm");

    if (newOwnerId) {
      await db.query(`INSERT INTO activities (contact_id, user_id, type, payload) VALUES ($1, $2, 'owner', $3)`, [
        id,
        user.id,
        { from: c.owner_id, from_name: c.owner_name, to: newOwnerId, to_name: newOwnerName },
      ]);
      await emit(db, user.orgId, "lead.dono_alterado", { contact_id: id, from_owner_id: c.owner_id, to_owner_id: newOwnerId, by: user.id }, "crm");
    }
    return { ok: true, changed: true };
  });
}

export const noteSchema = z.object({ text: z.string().trim().min(1).max(5000) }).strict();

export async function addNote(user: SessionUser, id: string, text: string) {
  if (!can(user, "leads.write")) throw forbidden();
  return withUser(user, async (db) => {
    const c = await loadContact(db, user, id, true);
    if (!c) throw notFound();
    const r = await db.query(
      `INSERT INTO activities (contact_id, user_id, type, payload) VALUES ($1, $2, 'note', $3) RETURNING id, type, payload, created_at, user_id`,
      [id, user.id, { text }],
    );
    await db.query(`UPDATE contacts SET updated_at = now() WHERE id = $1`, [id]);
    return r.rows[0] as { id: string; type: "note"; payload: { text: string }; created_at: Date; user_id: string };
  });
}

// ---------------------------------------------------------------- RGPD

/** Tudo o que existe sobre o contacto, para exportação a pedido do titular. */
export async function exportLead(user: SessionUser, id: string) {
  if (!can(user, "leads.export")) throw forbidden();
  return withUser(user, async (db) => {
    const c = await loadContact(db, user, id);
    if (!c) throw notFound();
    const { owner_path: _p, owner_active: _a, owner_name, ...contact } = c;
    const diagnostics = (
      await db.query(
        `SELECT id, status, locale, answers, profile, scenarios, assumptions, plan_version, analysis_text, plan30, ai_used,
                (pdf_path IS NOT NULL) AS pdf_generated, created_at, completed_at
           FROM diagnostics WHERE contact_id = $1 ORDER BY created_at`,
        [id],
      )
    ).rows;
    const activities = (
      await db.query(`SELECT id, type, payload, user_id, created_at FROM activities WHERE contact_id = $1 ORDER BY created_at, id`, [id])
    ).rows;
    const events = (
      await db.query(`SELECT id, type, payload, source, created_at FROM events WHERE org_id = $1 AND payload->>'contact_id' = $2 ORDER BY id`, [user.orgId, id])
    ).rows;
    return {
      exported_at: new Date().toISOString(),
      exported_by: user.id,
      contact: { ...contact, owner_name },
      diagnostics,
      activities,
      events,
    };
  });
}

/** Apaga o contacto e dependentes (diagnósticos, atividades) e os PDFs em disco. Evento sem dados pessoais. */
export async function deleteLead(user: SessionUser, id: string) {
  if (!can(user, "leads.delete")) throw forbidden();
  const pdfs = await withUser(user, async (db) => {
    const c = await loadContact(db, user, id, true);
    if (!c) throw notFound();
    const files = (await db.query(`SELECT pdf_path FROM diagnostics WHERE contact_id = $1 AND pdf_path IS NOT NULL`, [id])).rows.map((r) => r.pdf_path as string);
    await db.query(`DELETE FROM contacts WHERE id = $1`, [id]);
    await emit(db, user.orgId, "lead.apagado", { contact_id: id, by: user.id }, "crm");
    return files;
  });
  const pdf_not_removed = await removePdfs(pdfs);
  // Os dados já saíram da BD; um PDF que ficou no disco é reportado para ser apagado à mão (RGPD).
  return pdf_not_removed.length ? { ok: true, pdf_not_removed } : { ok: true };
}

/** Apaga os PDFs; devolve os que não saíram. Ficheiro já inexistente conta como apagado. */
async function removePdfs(files: string[]): Promise<string[]> {
  const base = path.resolve(process.env.PDF_DIR ?? "data/pdf");
  const failed: string[] = [];
  for (const f of files) {
    const abs = path.resolve(base, f);
    if (!abs.startsWith(base + path.sep)) continue; // nunca apagar fora de PDF_DIR
    try {
      await unlink(abs);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      console.error(`[crm] PDF não apagado (${f}):`, (err as Error).message);
      failed.push(f);
    }
  }
  return failed;
}

// ---------------------------------------------------------------- CSV

/** Evita injeção de fórmulas (=, +, -, @) ao abrir no Excel/Sheets. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADERS = [
  "id", "nome", "email", "whatsapp", "pais", "idioma", "intencao", "etapa", "motivo_perda", "origem", "dono", "utm_source", "utm_medium",
  "utm_campaign", "consentimento_em", "criado_em", "diagnostico", "perfil", "mes12_provavel", "moeda",
];

/** CSV com os mesmos filtros da listagem (sem paginação), sempre limitado à subárvore do utilizador. */
export async function exportLeadsCsv(user: SessionUser, f: LeadFilters): Promise<string> {
  if (!can(user, "leads.export")) throw forbidden();
  const rows = await withUser(user, async (db) => {
    const params: unknown[] = [];
    const where = filterSql(user, f, params, true);
    return (
      await db.query(
        `SELECT ${LEAD_COLUMNS}, c.utm, c.consent_at ${LEAD_FROM} WHERE ${where} ORDER BY c.created_at DESC, c.id`,
        params,
      )
    ).rows;
  });
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    const utm = (r.utm ?? {}) as Record<string, string>;
    lines.push(
      [
        r.id, r.name, r.email, r.whatsapp_e164, r.country, r.locale, r.intent, r.stage, r.lost_reason, r.source, r.owner_name,
        utm.utm_source ?? utm.source, utm.utm_medium ?? utm.medium, utm.utm_campaign ?? utm.campaign, r.consent_at, r.created_at,
        r.diagnostic_status, r.diagnostic_profile, r.month12_provavel, r.currency,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
