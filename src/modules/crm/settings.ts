import { z } from "zod";
import rawDefaultPlan from "@config/plano-oriflame.json";
import { withUser, type SessionUser } from "@/core/db/client";
import { decryptSecret, encryptSecret } from "@/core/crypto";
import { getCopy, LOCALES, type Locale } from "@/core/i18n";
import { AGENTS } from "@/core/modules";
import { can, HttpError } from "@/core/permissions";
import { computeScenarios, type Answers } from "@/modules/diagnostico/engine";
import { planTableSchema, type PlanTable } from "@/modules/diagnostico/plan-schema";
import { forbidden } from "./common";

// Configurações da organização (só o owner): tabela do plano, textos, integrações. Tudo em `settings(org_id, key, value)`.

async function readSetting<T>(user: SessionUser, key: string): Promise<T | null> {
  return withUser(user, async (db) => {
    const r = await db.query(`SELECT value FROM settings WHERE org_id = $1 AND key = $2`, [user.orgId, key]);
    return (r.rows[0]?.value as T | undefined) ?? null;
  });
}

async function writeSetting(user: SessionUser, key: string, value: unknown): Promise<void> {
  await withUser(user, (db) =>
    db.query(
      `INSERT INTO settings (org_id, key, value, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [user.orgId, key, JSON.stringify(value)],
    ),
  );
}

async function deleteSetting(user: SessionUser, key: string): Promise<void> {
  await withUser(user, (db) => db.query(`DELETE FROM settings WHERE org_id = $1 AND key = $2`, [user.orgId, key]));
}

const need = (user: SessionUser) => {
  if (!can(user, "settings.write")) throw forbidden();
};

// ---------------------------------------------------------------- tabela do plano

// Duas respostas-tipo por país: alguém a construir negócio e alguém só a comprar. Servem de pré-visualização.
const SAMPLES: Record<string, Omit<Answers, "pais">> = {
  negocio_tipico: { objetivo: "negocio", horas: "5-10", contactos: "50-150", experiencia: "alguma", redes: "ativo", consumo: "30-80" },
  consumidora: { objetivo: "comprar", horas: "2-5", contactos: "<50", experiencia: "nenhuma", redes: "pouco", consumo: "<30" },
};

export function planPreview(plan: PlanTable) {
  const out: Record<string, Record<string, ReturnType<typeof computeScenarios>>> = {};
  for (const country of Object.keys(plan.countries) as Answers["pais"][]) {
    out[country] = {};
    for (const [name, s] of Object.entries(SAMPLES)) out[country][name] = computeScenarios({ pais: country, ...s }, plan);
  }
  return out;
}

export async function getPlanSettings(user: SessionUser) {
  need(user);
  const stored = await readSetting<unknown>(user, "plan_table");
  const parsed = planTableSchema.safeParse(stored ?? rawDefaultPlan);
  // Valor guardado que deixou de validar (ex.: schema evoluiu) cai no exemplo do repositório, com aviso.
  const plan = parsed.success ? parsed.data : planTableSchema.parse(rawDefaultPlan);
  return {
    source: stored && parsed.success ? ("settings" as const) : ("default" as const),
    stored_invalid: Boolean(stored) && !parsed.success,
    plan,
    preview: planPreview(plan),
  };
}

/** Valida (zod, aponta o campo), calcula a pré-visualização e só então grava. */
export async function putPlanSettings(user: SessionUser, raw: unknown) {
  need(user);
  const plan = planTableSchema.parse(raw);
  let preview: ReturnType<typeof planPreview>;
  try {
    preview = planPreview(plan);
  } catch (err) {
    throw new HttpError(422, "plan_unusable", `A tabela não permite calcular a simulação: ${(err as Error).message}`);
  }
  await writeSetting(user, "plan_table", plan);
  return { source: "settings" as const, stored_invalid: false, plan, preview };
}

// ---------------------------------------------------------------- textos (overrides por idioma)

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const MAX_TEXT = 2000;
const MAX_ISSUES = 20;

function checkOverride(base: unknown, ov: unknown, at: string, errs: string[]): void {
  if (errs.length >= MAX_ISSUES) return;
  if (typeof base === "string") {
    if (typeof ov !== "string") errs.push(`${at}: tem de ser texto`);
    else if (ov.length > MAX_TEXT) errs.push(`${at}: texto demasiado longo (máx. ${MAX_TEXT})`);
  } else if (typeof base === "number" || typeof base === "boolean") {
    if (typeof ov !== typeof base) errs.push(`${at}: tipo errado`);
  } else if (Array.isArray(base)) {
    if (!Array.isArray(ov)) return void errs.push(`${at}: tem de ser uma lista`);
    if (ov.length > 60) return void errs.push(`${at}: lista demasiado longa`);
    const tpl = base[0];
    ov.forEach((el, i) => (tpl === undefined ? typeof el === "string" || errs.push(`${at}[${i}]: tem de ser texto`) : checkOverride(tpl, el, `${at}[${i}]`, errs)));
  } else if (base && typeof base === "object") {
    if (!ov || typeof ov !== "object" || Array.isArray(ov)) return void errs.push(`${at}: tem de ser um objeto`);
    for (const [k, v] of Object.entries(ov)) {
      if (!(k in (base as object))) errs.push(`${at}.${k}: chave desconhecida`);
      else checkOverride((base as Record<string, unknown>)[k], v, `${at}.${k}`, errs);
    }
  } else errs.push(`${at}: não editável`);
}

export const copyPutSchema = z.object({ overrides: z.partialRecord(z.enum(LOCALES), z.record(z.string(), z.unknown())) }).strict();

/** Junta os textos do owner à copy do repositório: objetos fundem-se, listas e textos são substituídos. */
export function applyCopyOverrides<T>(base: T, ov: unknown): T {
  if (ov === undefined || ov === null) return base;
  if (Array.isArray(base) || typeof base !== "object" || base === null) return ov as T;
  if (typeof ov !== "object" || Array.isArray(ov)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(ov as Record<string, unknown>)) out[k] = k in out ? applyCopyOverrides(out[k], v) : out[k];
  return out as T;
}

type CopyOverrides = Partial<Record<Locale, Record<string, Json>>>;

export async function getCopySettings(user: SessionUser) {
  need(user);
  const overrides = (await readSetting<CopyOverrides>(user, "copy_overrides")) ?? {};
  return { locales: LOCALES, overrides, base: Object.fromEntries(LOCALES.map((l) => [l, getCopy(l)])) };
}

/** Substitui os overrides de cada idioma enviado (objeto vazio limpa esse idioma); os restantes ficam como estão. */
export async function putCopySettings(user: SessionUser, body: z.infer<typeof copyPutSchema>) {
  need(user);
  const errs: string[] = [];
  for (const [lang, ov] of Object.entries(body.overrides)) checkOverride(getCopy(lang), ov, lang, errs);
  if (errs.length) throw new HttpError(400, "invalid_copy", errs.join("; "));
  const current = (await readSetting<CopyOverrides>(user, "copy_overrides")) ?? {};
  const next: CopyOverrides = { ...current };
  for (const [lang, ov] of Object.entries(body.overrides) as [Locale, Record<string, Json>][]) {
    if (Object.keys(ov).length === 0) delete next[lang];
    else next[lang] = ov;
  }
  await writeSetting(user, "copy_overrides", next);
  return getCopySettings(user);
}

/** Copy final de um idioma (repositório + overrides da org). Para a UI pública e o worker. */
export async function loadCopy(user: SessionUser, locale: string) {
  const overrides = (await readSetting<CopyOverrides>(user, "copy_overrides")) ?? {};
  return applyCopyOverrides(getCopy(locale), overrides[(locale as Locale)] ?? null);
}

// ---------------------------------------------------------------- integrações (chaves nunca saem)

interface SmtpStored { host: string; port: number; secure: boolean; user: string | null; from: string; password_enc: string | null }
interface AiStored { key_enc: string }

export const integrationsPutSchema = z
  .object({
    ai_key: z
      .string()
      .trim()
      .min(20)
      .max(300)
      .regex(/^\S+$/, "A chave não pode ter espaços")
      .nullable()
      .optional(),
    smtp: z
      .object({
        host: z.string().trim().min(1).max(200),
        port: z.number().int().min(1).max(65535),
        secure: z.boolean().default(false),
        user: z.string().trim().max(200).nullable().optional(),
        password: z.string().max(500).optional(),
        from: z.string().trim().min(3).max(200),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()
  .refine((v) => v.ai_key !== undefined || v.smtp !== undefined, "Nada para alterar");

export async function getIntegrations(user: SessionUser) {
  need(user);
  const ai = await readSetting<AiStored>(user, "ai_key");
  const smtp = await readSetting<SmtpStored>(user, "smtp");
  return {
    ai: {
      configured: Boolean(ai?.key_enc) || Boolean(process.env.ANTHROPIC_API_KEY),
      source: ai?.key_enc ? ("settings" as const) : process.env.ANTHROPIC_API_KEY ? ("env" as const) : null,
      model: process.env.AI_MODEL || "claude-sonnet-5-5",
    },
    smtp: {
      configured: Boolean(smtp) || Boolean(process.env.SMTP_URL),
      source: smtp ? ("settings" as const) : process.env.SMTP_URL ? ("env" as const) : null,
      host: smtp?.host ?? null,
      port: smtp?.port ?? null,
      secure: smtp?.secure ?? null,
      user: smtp?.user ?? null,
      from: smtp?.from ?? null,
      has_password: Boolean(smtp?.password_enc),
    },
  };
}

export async function putIntegrations(user: SessionUser, body: z.infer<typeof integrationsPutSchema>) {
  need(user);
  if (body.ai_key !== undefined) {
    if (body.ai_key === null) await deleteSetting(user, "ai_key");
    else await writeSetting(user, "ai_key", { key_enc: encryptSecret(body.ai_key) } satisfies AiStored);
  }
  if (body.smtp !== undefined) {
    if (body.smtp === null) await deleteSetting(user, "smtp");
    else {
      const prev = await readSetting<SmtpStored>(user, "smtp");
      const s = body.smtp;
      // Palavra-passe omitida mantém a anterior; string vazia remove-a.
      const password_enc = s.password === undefined ? (prev?.password_enc ?? null) : s.password === "" ? null : encryptSecret(s.password);
      await writeSetting(user, "smtp", { host: s.host, port: s.port, secure: s.secure, user: s.user || null, from: s.from, password_enc } satisfies SmtpStored);
    }
  }
  return getIntegrations(user);
}

/** Para o worker/agentes: chave Anthropic e SMTP da org já decifrados (nunca expor por API). `null` se não configurados. */
export async function loadSecrets(user: SessionUser) {
  const ai = await readSetting<AiStored>(user, "ai_key");
  const smtp = await readSetting<SmtpStored>(user, "smtp");
  return {
    aiKey: ai?.key_enc ? decryptSecret(ai.key_enc) : null,
    smtp: smtp ? { host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, from: smtp.from, password: smtp.password_enc ? decryptSecret(smtp.password_enc) : null } : null,
  };
}

// ---------------------------------------------------------------- agentes

export async function listAgents(user: SessionUser) {
  if (!can(user, "agents.read")) throw forbidden();
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY) || Boolean(await readSetting<AiStored>(user, "ai_key"));
  const stats = await withUser(user, async (db) => {
    const params = [user.orgId, user.path];
    return (
      await db.query(
        `SELECT count(*)::int AS total, (count(*) FILTER (WHERE d.ai_used))::int AS ai_used, max(d.completed_at) AS last_at
           FROM diagnostics d JOIN contacts c ON c.id = d.contact_id
          WHERE d.status = 'concluido' AND c.org_id = $1
            AND c.owner_id IN (SELECT id FROM users WHERE org_id = $1 AND path <@ $2::ltree)`,
        params,
      )
    ).rows[0] as { total: number; ai_used: number; last_at: Date | null };
  });
  return {
    items: AGENTS.map((a) => ({
      ...a,
      status: aiConfigured ? "ativo" : "fallback",
      status_note: aiConfigured ? "IA configurada" : "Sem chave de IA: usa o texto fixo do perfil",
      runs: { diagnostics_completed: stats.total, ai_used: stats.ai_used, fallback_used: stats.total - stats.ai_used, last_at: stats.last_at },
    })),
  };
}

// ---------------------------------------------------------------- dados da org para /api/me

/** Nome da organização e se a tabela do plano em vigor ainda é a de exemplo (a UI mostra a faixa "Tabela de exemplo"). */
export async function getOrgInfo(user: SessionUser) {
  const org = await withUser(user, async (db) => (await db.query(`SELECT id, name FROM organizations WHERE id = $1`, [user.orgId])).rows[0] as { id: string; name: string } | undefined);
  const stored = await readSetting<unknown>(user, "plan_table");
  const parsed = planTableSchema.safeParse(stored ?? rawDefaultPlan);
  return { org: org ?? null, plan_is_example: parsed.success ? parsed.data.is_example : true };
}
