// Serviço do Diagnóstico: rotas públicas (sem sessão), sempre em modo sistema (RLS ignorado de propósito).
// A segurança está aqui: token por diagnóstico (só o hash fica na BD), consentimento, validação e atribuição.
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { brandVars, fillDeep, resolveBrandName, resolveBrandTagline } from "@/core/brand";
import { withSystem, type Db } from "@/core/db/client";
import { emit } from "@/core/events";
import { fill, getCopy, isLocale, type Locale } from "@/core/i18n";
import { HttpError } from "@/core/permissions";
import { addFresh } from "@/core/queue";
import {
  ANSWER_VALUES,
  QUESTION_ORDER,
  assumptionsFor,
  computeScenarios,
  loadPlan,
  profileOf,
  type Answers,
  type CountryPlan,
  type PlanTable,
  type Profile,
  type Scenario,
} from "./engine";
import { planTableSchema } from "./plan-schema";
import { generateReport, type Plan30, type Report } from "./report";

// ---------------------------------------------------------------- tokens

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function tokenMatches(storedHash: string, given: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashToken(given), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const tokenSchema = z.string().min(20).max(200);
const uuidSchema = z.uuid();

// ---------------------------------------------------------------- perguntas

export function currencySymbol(currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
}

export function listQuestions(lang: string, country?: string | null) {
  const copy = getCopy(lang);
  const plan = loadPlan();
  const cp = country && (ANSWER_VALUES.pais as readonly string[]).includes(country) ? plan.countries[country as Answers["pais"]] : undefined;
  const symbol = cp ? currencySymbol(cp.currency) : undefined;
  const questions = QUESTION_ORDER.map((key) => {
    const q = copy.chat.questions[key];
    const options = Object.entries(q.options).map(([value, label]) => ({
      value,
      // Antes de saber o país o {currency} fica por preencher; o chat troca-o quando a pessoa responde a "pais".
      label: symbol ? fill(label, { currency: symbol }) : label,
    }));
    return { key, text: q.text, options };
  });
  const currencies = Object.fromEntries(Object.entries(plan.countries).map(([c, p]) => [c, currencySymbol(p.currency)]));
  return { questions, currencies };
}

// ---------------------------------------------------------------- start

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const startSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  whatsapp: z.string().trim().min(5).max(40),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/),
  consent: z.literal(true),
  lang: z.string().optional(),
  leader: z.string().trim().max(80).optional(),
  utm: z.record(z.string(), z.unknown()).optional(),
  website: z.string().optional(),
});

export function parseWhatsapp(raw: string, country: string): string | null {
  const text = raw.replace(/[^\d+()\-.\s]/g, "").trim();
  if (!text) return null;
  const region = country.toUpperCase() as CountryCode;
  // Com "+" ou "00" é internacional (qualquer país). Sem eles usa o país escolhido só como indicativo por omissão.
  const normalized = text.startsWith("00") ? `+${text.slice(2)}` : text;
  const p = parsePhoneNumberFromString(normalized, normalized.startsWith("+") ? undefined : region);
  return p && p.isValid() ? p.number : null; // .number já vem em E.164
}

export function cleanUtm(utm: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!utm) return out;
  for (const k of UTM_KEYS) {
    const v = utm[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
}

/** Resposta falsa para o honeypot: parece uma inscrição normal, não grava nada. */
export function fakeStartResult(): { id: string; token: string } {
  return { id: crypto.randomUUID(), token: newToken() };
}

type StartCtx = { ip: string; orgId?: string };

export async function startDiagnostic(input: unknown, ctx: StartCtx): Promise<{ id: string; token: string }> {
  const rawLang = typeof (input as { lang?: unknown })?.lang === "string" ? (input as { lang: string }).lang : "pt";
  const lang: Locale = isLocale(rawLang) ? rawLang : "pt";
  const copy = getCopy(lang);
  const errs = copy.chat.contact_step.errors;

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "name") throw new HttpError(400, "invalid_name", errs.name);
    if (field === "email") throw new HttpError(400, "invalid_email", errs.email);
    if (field === "whatsapp") throw new HttpError(400, "invalid_whatsapp", errs.whatsapp);
    if (field === "consent") throw new HttpError(400, "consent_required", errs.consent);
    throw new HttpError(400, "invalid", errs.generic);
  }
  const body = parsed.data;
  const country = body.country.toUpperCase();
  const e164 = parseWhatsapp(body.whatsapp, country);
  if (!e164) throw new HttpError(400, "invalid_whatsapp", errs.whatsapp);
  const email = body.email.trim().toLowerCase();
  const utm = cleanUtm(body.utm);

  return withSystem(async (db) => {
    const owner = await resolveOwner(db, body.leader, ctx.orgId);
    const consentText = fill(copy.chat.contact_step.consent_text, brandVars(owner.name, owner.brand_name));
    const source = utm.utm_source ?? (owner.viaLink ? "link_lider" : "direto");

    let contactId: string | undefined;
    let isNew = false;

    const found = await findContact(db, owner.org_id, email, e164);
    if (found) {
      contactId = found;
    } else {
      // ON CONFLICT sem alvo cobre os dois índices únicos parciais (e-mail e WhatsApp) e as corridas entre pedidos.
      const ins = await db.query<{ id: string }>(
        `INSERT INTO contacts (org_id, owner_id, name, email, whatsapp_e164, country, locale, source, utm, consent_at, consent_text, consent_ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11)
         ON CONFLICT DO NOTHING RETURNING id`,
        [owner.org_id, owner.id, body.name, email, e164, country, lang, source, JSON.stringify(utm), consentText, ctx.ip],
      );
      if (ins.rows[0]) {
        contactId = ins.rows[0].id;
        isNew = true;
      } else {
        contactId = await findContact(db, owner.org_id, email, e164);
      }
    }
    if (!contactId) throw new HttpError(500, "contact_not_saved");

    if (!isNew) {
      // Mantém o contacto e o dono. Só renova o consentimento (o mais recente) e o idioma.
      await db.query(
        "UPDATE contacts SET consent_at = now(), consent_text = $2, consent_ip = $3, locale = $4, updated_at = now() WHERE id = $1",
        [contactId, consentText, ctx.ip, lang],
      );
    }

    const token = newToken();
    const d = await db.query<{ id: string }>(
      "INSERT INTO diagnostics (contact_id, token_hash, locale) VALUES ($1,$2,$3) RETURNING id",
      [contactId, hashToken(token), lang],
    );
    const diagnosticId = d.rows[0].id;

    await db.query("INSERT INTO activities (contact_id, type, payload) VALUES ($1,'system',$2)", [
      contactId,
      JSON.stringify({ action: isNew ? "lead_criado" : "novo_diagnostico", diagnostic_id: diagnosticId }),
    ]);
    if (isNew) {
      await emit(db, owner.org_id, "lead.criado", { contact_id: contactId, diagnostic_id: diagnosticId, owner_id: owner.id, source, locale: lang }, "diagnostico");
    }
    return { id: diagnosticId, token };
  });
}

async function findContact(db: Db, orgId: string, email: string, e164: string): Promise<string | undefined> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM contacts WHERE org_id = $1 AND (lower(email) = $2 OR whatsapp_e164 = $3)
     ORDER BY (lower(email) = $2) DESC, created_at ASC LIMIT 1`,
    [orgId, email, e164],
  );
  return r.rows[0]?.id;
}

/** Líder do link (ativo) ou o owner. Link inexistente, desativado ou de assistente cai no owner. */
async function resolveOwner(db: Db, slug: string | undefined, orgId?: string) {
  if (slug) {
    const r = await db.query<{ id: string; org_id: string; name: string; brand_name: unknown; brand_tagline: unknown }>(
      `SELECT u.id, u.org_id, u.name, lp.brand_name, lp.brand_tagline FROM leader_profiles lp JOIN users u ON u.id = lp.user_id
       WHERE lower(lp.slug) = lower($1) AND u.active AND u.role IN ('owner','leader') AND ($2::uuid IS NULL OR u.org_id = $2)
       LIMIT 1`,
      [slug, orgId ?? null],
    );
    if (r.rows[0]) return { ...r.rows[0], viaLink: true };
  }
  const o = await db.query<{ id: string; org_id: string; name: string; brand_name: unknown; brand_tagline: unknown }>(
    `SELECT u.id, u.org_id, u.name, lp.brand_name, lp.brand_tagline FROM users u LEFT JOIN leader_profiles lp ON lp.user_id = u.id
       WHERE u.role = 'owner' AND u.active AND ($1::uuid IS NULL OR u.org_id = $1) ORDER BY u.created_at LIMIT 1`,
    [orgId ?? null],
  );
  if (!o.rows[0]) throw new HttpError(503, "not_configured", "Sem owner configurado");
  return { ...o.rows[0], viaLink: false };
}

// ---------------------------------------------------------------- carregar + validar token

type StoredScenarios = {
  conservador: Scenario;
  provavel: Scenario;
  ambicioso: Scenario;
  currency: string;
  plan_version: string;
  is_example: boolean;
};

type DiagRow = {
  id: string;
  contact_id: string;
  token_hash: string;
  status: "incompleto" | "concluido";
  locale: string;
  answers: Record<string, string>;
  profile: string | null;
  scenarios: StoredScenarios | null;
  assumptions: string[] | null;
  plan_version: string | null;
  analysis_text: string | null;
  plan30: Plan30[] | null;
  ai_used: boolean;
  pdf_path: string | null;
  completed_at: Date | null;
  org_id: string;
  owner_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_country: string | null;
};

const ROW_SQL = `SELECT d.id, d.contact_id, d.token_hash, d.status, d.locale, d.answers, d.profile, d.scenarios, d.assumptions, d.plan_version,
            d.analysis_text, d.plan30, d.ai_used, d.pdf_path, d.completed_at,
            c.org_id, c.owner_id, c.name AS contact_name, c.email AS contact_email, c.country AS contact_country
       FROM diagnostics d JOIN contacts c ON c.id = d.contact_id WHERE d.id = $1`;

async function loadRow(db: Db, id: string, token: string): Promise<DiagRow> {
  if (!uuidSchema.safeParse(id).success) throw new HttpError(404, "not_found");
  if (!tokenSchema.safeParse(token).success) throw new HttpError(403, "forbidden");
  const r = await db.query<DiagRow>(ROW_SQL, [id]);
  const row = r.rows[0];
  if (!row) throw new HttpError(404, "not_found");
  if (!tokenMatches(row.token_hash, token)) throw new HttpError(403, "forbidden");
  return row;
}

// ---------------------------------------------------------------- answer

const answerSchema = z.object({ token: tokenSchema, key: z.enum(QUESTION_ORDER), value: z.string().max(20) });

export async function answerDiagnostic(id: string, input: unknown): Promise<{ ok: true; next?: string }> {
  const body = answerSchema.parse(input);
  if (!(ANSWER_VALUES[body.key] as readonly string[]).includes(body.value)) throw new HttpError(400, "invalid_value", "Valor inválido para esta pergunta");
  return withSystem(async (db) => {
    const row = await loadRow(db, id, body.token);
    if (row.status === "concluido") throw new HttpError(409, "already_finished", "Diagnóstico já concluído");
    // Só enquanto incompleto: um finish em corrida não pode ver as respostas mudar depois de concluído.
    const u = await db.query("UPDATE diagnostics SET answers = answers || jsonb_build_object($2::text, $3::text) WHERE id = $1 AND status = 'incompleto'", [id, body.key, body.value]);
    if (u.rowCount === 0) throw new HttpError(409, "already_finished", "Diagnóstico já concluído");
    const answered = new Set([...Object.keys(row.answers ?? {}), body.key]);
    const next = QUESTION_ORDER.find((k) => !answered.has(k));
    return next ? { ok: true as const, next } : { ok: true as const };
  });
}

// ---------------------------------------------------------------- plano (BD ou ficheiro)

/** settings.plan_table do org, se existir e for válido; senão a tabela de exemplo do ficheiro. */
export async function getPlan(db: Db, orgId: string): Promise<PlanTable> {
  const r = await db.query<{ value: unknown }>("SELECT value FROM settings WHERE org_id = $1 AND key = 'plan_table'", [orgId]);
  if (r.rows[0]) {
    const parsed = planTableSchema.safeParse(r.rows[0].value);
    if (parsed.success) return parsed.data;
    console.error("[diagnostico] settings.plan_table inválida, a usar a tabela do ficheiro:", parsed.error.issues[0]?.message);
  }
  return loadPlan();
}

// ---------------------------------------------------------------- contexto do relatório (resultado, PDF, e-mail)

export type Cta = { signup_url: string; whatsapp_url: string | null; leader: { name: string; brand_name: string; photo_url: string | null } };

export type Leader = { name: string; brand_name: string; brand_tagline: string; photo_url: string | null; sponsor_code: string | null; whatsapp_e164: string | null };

export type ReportContext = {
  id: string;
  lang: Locale;
  contactName: string;
  contactEmail: string | null;
  leader: Leader;
  answers: Answers;
  profile: Profile;
  scenarios: StoredScenarios;
  assumptions: string[];
  analysis: string;
  plan30: Plan30[];
  ai_used: boolean;
  pdfReady: boolean;
  cta: Cta;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function buildCta(cp: CountryPlan, leader: Leader, contactName: string, lang: string): Cta {
  const copy = getCopy(lang);
  const code = leader.sponsor_code?.trim();
  const tpl = cp.signup_url_template;
  const signup_url = code
    ? tpl.replace("{sponsor_code}", encodeURIComponent(code))
    : tpl.replace(/[?&][^?&=]*=\{sponsor_code\}/, "").replace("{sponsor_code}", "");
  const digits = leader.whatsapp_e164?.replace(/\D/g, "");
  // Só o primeiro nome vai no texto pré-preenchido do WhatsApp (abre no telemóvel da própria pessoa, não passa por nós).
  const prefill = fill(copy.chat.result.whatsapp_prefill, { name: firstName(contactName), ...brandVars(leader.name, leader.brand_name) });
  const whatsapp_url = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}` : null;
  return { signup_url, whatsapp_url, leader: { name: leader.name, brand_name: leader.brand_name, photo_url: leader.photo_url } };
}

const answersSchema = z.object({
  pais: z.enum(ANSWER_VALUES.pais),
  objetivo: z.enum(ANSWER_VALUES.objetivo),
  horas: z.enum(ANSWER_VALUES.horas),
  contactos: z.enum(ANSWER_VALUES.contactos),
  experiencia: z.enum(ANSWER_VALUES.experiencia),
  redes: z.enum(ANSWER_VALUES.redes),
  consumo: z.enum(ANSWER_VALUES.consumo),
});

async function leaderOf(db: Db, ownerId: string, lang: Locale): Promise<Leader> {
  const r = await db.query<{ name: string; brand_name: unknown; brand_tagline: unknown; photo_url: string | null; sponsor_code: string | null; whatsapp_e164: string | null }>(
    `SELECT u.name, lp.brand_name, lp.brand_tagline, lp.photo_url, lp.sponsor_code, lp.whatsapp_e164 FROM users u LEFT JOIN leader_profiles lp ON lp.user_id = u.id WHERE u.id = $1`,
    [ownerId],
  );
  const row = r.rows[0];
  const fallback = getCopy(lang).brand;
  if (!row) return { name: "", brand_name: fallback.name, brand_tagline: fallback.tagline, photo_url: null, sponsor_code: null, whatsapp_e164: null };
  return {
    ...row,
    brand_name: resolveBrandName(row.name, row.brand_name),
    brand_tagline: resolveBrandTagline(row.brand_tagline, lang, fallback.tagline),
  };
}

function contextFromRow(row: DiagRow, leader: Leader, plan: PlanTable): ReportContext {
  const lang: Locale = isLocale(row.locale) ? row.locale : "pt";
  const answers = answersSchema.parse(row.answers);
  return {
    id: row.id,
    lang,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    leader,
    answers,
    profile: (row.profile as Profile) ?? profileOf(answers),
    scenarios: row.scenarios as StoredScenarios,
    assumptions: row.assumptions ?? [],
    analysis: row.analysis_text ?? "",
    plan30: row.plan30 ?? [],
    ai_used: row.ai_used,
    pdfReady: !!row.pdf_path,
    cta: buildCta(plan.countries[answers.pais], leader, row.contact_name, lang),
  };
}

export type WorkerContext = ReportContext & { orgId: string; contactId: string; pdfPath: string | null };

/** Para o worker (agent, PDF, e-mail): tudo o que o relatório precisa, sem token. `null` se o diagnóstico não existe. */
export async function loadReportContext(db: Db, diagnosticId: string): Promise<{ status: "incompleto" } | (WorkerContext & { status: "concluido" }) | null> {
  const r = await db.query<DiagRow>(ROW_SQL, [diagnosticId]);
  const row = r.rows[0];
  if (!row) return null;
  if (row.status !== "concluido" || !row.scenarios) return { status: "incompleto" };
  const plan = await getPlan(db, row.org_id);
  const lang: Locale = isLocale(row.locale) ? row.locale : "pt";
  const leader = await leaderOf(db, row.owner_id, lang);
  return { ...contextFromRow(row, leader, plan), status: "concluido", orgId: row.org_id, contactId: row.contact_id, pdfPath: row.pdf_path };
}

export function buildResult(c: ReportContext) {
  const copy = getCopy(c.lang);
  const vars = brandVars(c.leader.name, c.leader.brand_name);
  const countryName = (copy.chat.questions.pais.options as Record<string, string>)[c.answers.pais] ?? c.answers.pais;
  const { conservador, provavel, ambicioso, currency, plan_version, is_example } = c.scenarios;
  return {
    scenarios: { conservador, provavel, ambicioso },
    currency,
    plan_version,
    is_example,
    assumptions: fillDeep(c.assumptions, vars),
    disclaimer: fill(copy.chat.result.disclaimer, vars),
    example_notice: is_example ? fill(copy.chat.result.example_table_notice, { country: countryName, ...vars }) : null,
    profile: c.profile,
    profile_label: fill(copy.report_fallback.perfis[c.profile].label, vars),
    analysis: fill(c.analysis, vars),
    plan30: fillDeep(c.plan30, vars),
    ai_used: c.ai_used,
    cta: c.cta,
    pdf_status: c.pdfReady ? ("ready" as const) : ("pending" as const),
  };
}

// ---------------------------------------------------------------- finish

const finishSchema = z.object({ token: tokenSchema });

// rendimento = compra com desconto e também ganha; negócio = quer aderir.
const INTENT_OF: Record<Answers["objetivo"], "comprar" | "aderir" | "ambos"> = { comprar: "comprar", rendimento: "ambos", negocio: "aderir" };

export type FinishDeps = {
  /** Enfileira o trabalho de fundo (agent → pdf → email). Por omissão a fila BullMQ; os testes passam um espião. */
  enqueue?: (diagnosticId: string) => Promise<void>;
  report?: typeof generateReport;
};

export async function enqueueReport(diagnosticId: string): Promise<void> {
  await addFresh("agent", "report", diagnosticId);
}

type Prep =
  | { done: ReportContext }
  | { done?: undefined; row: DiagRow; plan: PlanTable; leader: Leader; answers: Answers };

export async function finishDiagnostic(id: string, input: unknown, deps: FinishDeps = {}) {
  const { token } = finishSchema.parse(input);

  // 1. Ler e validar (transação curta).
  const prep: Prep = await withSystem(async (db) => {
    const row = await loadRow(db, id, token);
    const plan = await getPlan(db, row.org_id);
    const lang: Locale = isLocale(row.locale) ? row.locale : "pt";
    const leader = await leaderOf(db, row.owner_id, lang);
    if (row.status === "concluido" && row.scenarios) return { done: contextFromRow(row, leader, plan) };
    const parsed = answersSchema.safeParse(row.answers);
    if (!parsed.success) {
      const missing = QUESTION_ORDER.filter((k) => !(k in (row.answers ?? {})));
      throw new HttpError(400, "incomplete", `Faltam respostas: ${missing.join(", ")}`);
    }
    return { row, plan, leader, answers: parsed.data };
  });
  if (prep.done) {
    // Concluído sem PDF: o enfileiramento pode ter falhado (Redis em baixo). Tenta de novo; o jobId evita duplicados.
    if (!prep.done.pdfReady) {
      await (deps.enqueue ?? enqueueReport)(id).catch((err) => console.error("[diagnostico] reenfileirar o relatório falhou:", (err as Error).message));
    } else if (prep.done.contactEmail) {
      // PDF pronto mas e-mail nunca reservado (SMTP em baixo em todas as tentativas): reenfileira só o e-mail.
      // A reserva única na BD (activities_report_email_once) impede o segundo envio se já saiu.
      const sent = await withSystem((db) =>
        db.query("SELECT 1 FROM activities WHERE type = 'email' AND payload->>'action' = 'relatorio_enviado' AND payload->>'diagnostic_id' = $1", [id]),
      );
      if (!sent.rowCount) await addFresh("email", "email", id).catch((err) => console.error("[diagnostico] reenfileirar o e-mail falhou:", (err as Error).message));
    }
    return buildResult(prep.done);
  }
  const { row, plan, leader, answers } = prep;

  const lang: Locale = isLocale(row.locale) ? row.locale : "pt";
  const profile = profileOf(answers);
  const scen = computeScenarios(answers, plan);
  const assumptions = fillDeep(assumptionsFor(answers, lang, plan), brandVars(leader.name, leader.brand_name));

  // 2. Texto da IA (até 20 s) FORA de qualquer transação, para não segurar uma ligação à BD.
  const report: Report = await (deps.report ?? generateReport)({
    profile,
    answers,
    lang,
    leaderName: leader.name || getCopy(lang).brand.name,
    brandName: leader.brand_name || getCopy(lang).brand.name,
  });

  // 3. Gravar. O UPDATE condicional garante um só vencedor se houver dois pedidos em corrida.
  const claimed = await withSystem(async (db) => {
    const u = await db.query(
      `UPDATE diagnostics SET status = 'concluido', profile = $2, scenarios = $3, assumptions = $4, plan_version = $5,
              analysis_text = $6, plan30 = $7, ai_used = $8, completed_at = now()
        WHERE id = $1 AND status = 'incompleto' AND answers = $9::jsonb`,
      [id, profile, JSON.stringify(scen), JSON.stringify(assumptions), scen.plan_version, report.analysis, JSON.stringify(report.plan30), report.ai_used, JSON.stringify(row.answers)],
    );
    if (u.rowCount === 0) {
      // Ou outro pedido concluiu primeiro (devolve o dele), ou uma resposta mudou durante o cálculo (409, o chat repete o finish).
      const cur = await db.query<{ status: string }>("SELECT status FROM diagnostics WHERE id = $1", [id]);
      if (cur.rows[0]?.status !== "concluido") throw new HttpError(409, "answers_changed", "As respostas mudaram, tente concluir de novo");
      return false;
    }
    await db.query("UPDATE contacts SET intent = $2, updated_at = now() WHERE id = $1", [row.contact_id, INTENT_OF[answers.objetivo]]);
    await db.query("INSERT INTO activities (contact_id, type, payload) VALUES ($1,'system',$2)", [
      row.contact_id,
      JSON.stringify({ action: "diagnostico_concluido", diagnostic_id: id, profile, ai_used: report.ai_used }),
    ]);
    await emit(db, row.org_id, "diagnostico.concluido", { contact_id: row.contact_id, diagnostic_id: id, profile, ai_used: report.ai_used, country: answers.pais }, "diagnostico");
    return true;
  });

  if (claimed) {
    // Fora da transação: se o Redis estiver em baixo, o chat segue; o PDF e o e-mail ficam por fazer.
    try {
      await (deps.enqueue ?? enqueueReport)(id);
    } catch (err) {
      console.error("[diagnostico] não foi possível enfileirar o relatório:", (err as Error).message);
    }
  }

  // Devolve sempre o que ficou gravado (se outro pedido ganhou a corrida, é o texto dele).
  const final = await withSystem(async (db) => contextFromRow(await loadRow(db, id, token), leader, plan));
  return buildResult(final);
}

// ---------------------------------------------------------------- pdf

export function pdfDir(): string {
  return path.resolve(process.env.PDF_DIR || "./data/pdf");
}

/** Caminho no disco do PDF de um diagnóstico (só o nome do ficheiro vem da BD; nunca sai da pasta). */
export function pdfFilePath(pdfPath: string): string {
  return path.join(pdfDir(), path.basename(pdfPath));
}

export async function readPdf(id: string, token: string): Promise<Buffer> {
  const row = await withSystem((db) => loadRow(db, id, token));
  if (!row.pdf_path) throw new HttpError(404, "pending", "O relatório ainda está a ser preparado");
  try {
    return await readFile(pdfFilePath(row.pdf_path));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new HttpError(404, "pending", "O relatório ainda está a ser preparado");
    throw err; // permissão ou I/O: 500 e registo no route(), nunca "pendente" para sempre
  }
}
