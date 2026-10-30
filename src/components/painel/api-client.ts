"use client";

import type { Activity, Diagnostic, Lead, LeadDetail, LeadsPage, TeamMember } from "./types";

type JsonRecord = Record<string, unknown>;
export class PanelApiError extends Error { constructor(public status: number, public code?: string, message?: string) { super(message ?? code ?? "request_failed"); } }
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const stringOrNull = (value: unknown): string | null | undefined => typeof value === "string" ? value : value === null ? null : undefined;
const numberOrUndefined = (value: unknown): number | undefined => { const number = Number(value); return Number.isFinite(number) ? number : undefined; };

export async function panelRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } }); }
  catch { throw new PanelApiError(0, "network"); }
  const raw = await response.text(); let body: unknown;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
  if (!response.ok) { const error = record(record(body).error); throw new PanelApiError(response.status, stringOrNull(error.code) ?? undefined, stringOrNull(error.message) ?? undefined); }
  return body as T;
}

export function apiErrorKey(error: unknown): "network_error" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "invalid" | "too_many_requests" | "generic" {
  if (!(error instanceof PanelApiError)) return "generic";
  if (error.status === 0) return "network_error"; if (error.status === 401) return "unauthorized"; if (error.status === 403) return "forbidden";
  if (error.status === 404) return "not_found"; if (error.status === 409) return "conflict"; if (error.status === 422 || error.status === 400) return "invalid";
  if (error.status === 429) return "too_many_requests"; return "generic";
}
export function apiErrorMessage(error: unknown): string | undefined { return error instanceof PanelApiError && error.message !== error.code ? error.message : undefined; }

function normalizeOwner(value: unknown): Lead["owner"] { const source = record(value); const id = stringOrNull(source.id); return id ? { id, name: stringOrNull(source.name) ?? undefined, email: stringOrNull(source.email) ?? undefined, active: typeof source.active === "boolean" ? source.active : undefined } : undefined; }
export function normalizeLead(value: unknown): Lead {
  const source = record(value); const diagnostic = record(source.diagnostic); const stage = stringOrNull(source.stage) ?? "novo";
  return { id: stringOrNull(source.id) ?? "", name: stringOrNull(source.name) ?? "", email: stringOrNull(source.email), whatsapp_e164: stringOrNull(source.whatsapp_e164), country: stringOrNull(source.country), locale: stringOrNull(source.locale), intent: stringOrNull(source.intent), stage: stage as Lead["stage"], profile: stringOrNull(source.profile) ?? stringOrNull(diagnostic.profile), diagnostic: Object.keys(diagnostic).length ? { profile: stringOrNull(diagnostic.profile), status: stringOrNull(diagnostic.status) ?? undefined, completed_at: stringOrNull(diagnostic.completed_at), month12_provavel: numberOrUndefined(diagnostic.month12_provavel), currency: stringOrNull(diagnostic.currency) } : null, owner: normalizeOwner(source.owner), source: stringOrNull(source.source), lost_reason: stringOrNull(source.lost_reason), consent_at: stringOrNull(source.consent_at), consent_text: stringOrNull(source.consent_text), consent_ip: stringOrNull(source.consent_ip), created_at: stringOrNull(source.created_at) ?? undefined, updated_at: stringOrNull(source.updated_at) ?? undefined };
}
function normalizeDiagnostic(value: unknown): Diagnostic { const source = record(value); return { status: stringOrNull(source.status) ?? undefined, profile: stringOrNull(source.profile), scenarios: record(source.scenarios) as NonNullable<Diagnostic["scenarios"]>, assumptions: Array.isArray(source.assumptions) ? source.assumptions.filter((item): item is string => typeof item === "string") : [], analysis_text: stringOrNull(source.analysis_text) ?? undefined, plan30: Array.isArray(source.plan30) ? source.plan30.map((item) => record(item) as NonNullable<Diagnostic["plan30"]>[number]) : [], plan_version: stringOrNull(source.plan_version) ?? undefined, pdf_ready: Boolean(source.pdf_ready) }; }
function normalizeActivity(value: unknown): Activity { const source = record(value); return { id: stringOrNull(source.id) ?? undefined, type: stringOrNull(source.type) ?? undefined, created_at: stringOrNull(source.created_at) ?? undefined, user_name: stringOrNull(source.user_name), payload: record(source.payload) }; }

/** Normaliza o envelope real de getLead, mantendo a UI independente dos nomes SQL internos. */
export function toLeadDetail(value: unknown): LeadDetail { const source = record(value); const contact = normalizeLead(source.contact); return { ...contact, diagnostics: Array.isArray(source.diagnostics) ? source.diagnostics.map(normalizeDiagnostic) : [], activities: Array.isArray(source.activities) ? source.activities.map(normalizeActivity) : [], can_reassign: source.can_reassign === true }; }
/** A API usa `limit`; aliases antigos ficam só como compatibilidade de leitura. */
export function toLeadsPage(value: unknown): LeadsPage { const data = record(value); const rawItems = Array.isArray(data.items) ? data.items : Array.isArray(data.leads) ? data.leads : []; const items = rawItems.map(normalizeLead); const page = numberOrUndefined(data.page) ?? 1; const pageSize = numberOrUndefined(data.limit) ?? numberOrUndefined(data.page_size) ?? numberOrUndefined(data.pageSize) ?? Math.max(items.length, 1); const total = numberOrUndefined(data.total) ?? items.length; return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), countsByStage: record(data.counts_by_stage) as LeadsPage["countsByStage"] }; }
export function toTeamTree(value: unknown): TeamMember[] { const data = record(value); return Array.isArray(value) ? value as TeamMember[] : Array.isArray(data.tree) ? data.tree as TeamMember[] : Array.isArray(data.items) ? data.items as TeamMember[] : []; }
export function flattenTeam(tree: TeamMember[]): TeamMember[] { return tree.flatMap((member) => [member, ...flattenTeam(member.children ?? [])]); }
