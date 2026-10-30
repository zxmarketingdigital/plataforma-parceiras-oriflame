import type { Locale } from "@/core/locale";

export type PanelRole = "owner" | "leader" | "assistant";
export type PanelPermission =
  | "leads.read" | "leads.write" | "leads.delete" | "leads.export"
  | "team.read" | "team.invite" | "team.deactivate" | "settings.write" | "agents.read";
export type LeadStage = "novo" | "em_contacto" | "interessado" | "inscrito" | "ativo" | "perdido";

export const LEAD_STAGES: LeadStage[] = ["novo", "em_contacto", "interessado", "inscrito", "ativo", "perdido"];
export const SCENARIO_KEYS = ["conservador", "provavel", "ambicioso"] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export interface PanelUser { id: string; orgId: string; path: string; role: PanelRole; email: string; name: string; locale: string; }
export interface OwnerRef { id: string; name?: string; email?: string; role?: PanelRole; active?: boolean; }
export interface LeadDiagnosticSummary { profile?: string | null; status?: string; completed_at?: string | null; month12_provavel?: number | null; currency?: string | null; }

export interface Lead {
  id: string; name: string; email?: string | null; whatsapp_e164?: string | null; country?: string | null; locale?: string | null; intent?: string | null;
  stage: LeadStage; profile?: string | null; diagnostic?: LeadDiagnosticSummary | null; owner?: OwnerRef; source?: string | null; lost_reason?: string | null;
  consent_at?: string | null; consent_text?: string | null; consent_ip?: string | null; created_at?: string; updated_at?: string;
}

export interface Scenario { monthly?: number[]; month12?: number; avg_monthly?: number; rank_label?: string; inputs?: Record<string, number>; }
export interface Diagnostic {
  status?: string; profile?: string | null; scenarios?: Record<string, Scenario | string | boolean>; assumptions?: string[];
  analysis_text?: string; plan30?: Array<{ week?: string | number; title?: string; actions?: string[] }>; plan_version?: string; pdf_ready?: boolean;
}
export interface Activity {
  id?: string; type?: "note" | "stage" | "owner" | "email" | "pdf" | "system" | string; created_at?: string; user_name?: string | null;
  payload?: { text?: string; message?: string; from?: string; to?: string; from_name?: string | null; to_name?: string | null; reason?: string; lost_reason?: string | null; };
}
export interface LeadDetail extends Lead { diagnostics: Diagnostic[]; activities: Activity[]; can_reassign: boolean; }
export interface LeadsPage { items: Lead[]; page: number; pageSize: number; total: number; totalPages: number; countsByStage: Partial<Record<LeadStage, number>>; }

export interface MetricValue { key?: string | null; stage?: string | null; label?: string | null; leads?: number; completed?: number; signed?: number; }
export interface MetricsData {
  totals?: { leads?: number; completed?: number; signed?: number; rate?: number; completion_rate?: number };
  by_source?: MetricValue[]; by_leader?: MetricValue[]; by_country?: MetricValue[]; by_locale?: MetricValue[]; by_stage?: MetricValue[];
}

export interface TeamMember {
  id: string; name: string; email?: string; role: PanelRole; active?: boolean; locale?: Locale | string;
  profile?: { slug?: string; sponsor_code?: string | null; whatsapp_e164?: string | null; photo_url?: string | null; brand_name?: string | null; brand_tagline?: Record<string, string>; logo_url?: string | null; country?: string | null; bio?: Partial<Record<Locale, string>>; } | null;
  children?: TeamMember[];
}

export interface AgentRecord { nome?: string; setor?: string; descricao?: string; idiomas?: string[]; requer_aprovacao_humana?: boolean; timeout_ms?: number; fallback?: string; status?: "ativo" | "fallback" | string; }
