// Motor de cálculo do Diagnóstico: puro e determinístico (sem rede, sem relógio, sem aleatório).
// Fórmulas: PLAN.md, secção "Motor de cálculo". A tabela do plano vem de config/plano-oriflame.json
// ou, se existir, de settings.plan_table (o serviço passa-a como argumento).
import rawPlan from "@config/plano-oriflame.json";
import { getCopy, fill } from "@/core/i18n";
import { planTableSchema, type CountryPlan, type PlanTable } from "./plan-schema";

export { ANSWER_VALUES, QUESTION_ORDER } from "./plan-schema";
export type { PlanTable, CountryPlan } from "./plan-schema";

export type Answers = {
  pais: "PT" | "ES" | "FR" | "GB";
  objetivo: "comprar" | "rendimento" | "negocio";
  horas: "2-5" | "5-10" | "10+";
  contactos: "<50" | "50-150" | "150+";
  experiencia: "nenhuma" | "alguma" | "muita";
  redes: "pouco" | "ativo" | "muito";
  consumo: "<30" | "30-80" | "80+";
};
export type Profile = "consumidora" | "rendimento_extra" | "construtora_negocio";

export type Scenario = {
  /** Ganho estimado de cada um dos 12 meses, na moeda do país, arredondado a 2 casas. */
  monthly: number[];
  month12: number;
  avg_monthly: number;
  /** Escalão do plano atingido no mês 12 (rótulo da tabela). */
  rank_label: string;
  /** Entradas de referência (mês 6, a meio do arranque) usadas nos pressupostos. */
  inputs: { clients_per_month: number; avg_order: number; recruits_per_month: number };
};

export type ScenarioKey = "conservador" | "provavel" | "ambicioso";
export const SCENARIO_KEYS: readonly ScenarioKey[] = ["conservador", "provavel", "ambicioso"];

// (mult_clientes, mult_recrutas) de cada cenário.
const MULT: Record<ScenarioKey, { c: number; r: number }> = {
  conservador: { c: 0.6, r: 0.5 },
  provavel: { c: 1.0, r: 1.0 },
  ambicioso: { c: 1.5, r: 1.6 },
};

const MONTHS = 12;
const REF_MONTH = 6; // mês de referência para clients_per_month / recruits_per_month

let cachedPlan: PlanTable | undefined;
/** Tabela do plano do repositório, config/plano-oriflame.json (validada uma vez). */
export function loadPlan(): PlanTable {
  cachedPlan ??= planTableSchema.parse(rawPlan);
  return cachedPlan;
}

export function profileOf(a: Answers): Profile {
  if (a.objetivo === "comprar") return "consumidora";
  if (a.objetivo === "rendimento") return "rendimento_extra";
  return "construtora_negocio";
}

/** Rampa de arranque: 0.35 no mês 0, +0.065 por mês, teto 1 (mês 10 em diante). */
export function rampa(m: number): number {
  return Math.min(1, 0.35 + 0.065 * m);
}

/** Primeiro mês em que a rampa chega a 1. */
export const RAMP_MONTHS = Math.ceil((1 - 0.35) / 0.065 - 1e-9);

function descontoDe(cp: CountryPlan, bp: number): { desconto: number; label: string } {
  let hit = cp.escaloes[0];
  for (const e of cp.escaloes) if (bp >= e.bp_min) hit = e;
  return { desconto: hit.desconto, label: hit.label };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type Sim = { monthly: number[]; rank_label: string; clients6: number; recruits6: number; team12: number };

function simulate(a: Answers, cp: CountryPlan, key: ScenarioKey): Sim {
  const { c, r } = MULT[key];
  const f = cp.fatores;
  const consumo = f.consumo[a.consumo];
  const baseC = cp.base_clientes[a.horas] * f.contactos[a.contactos] * f.redes[a.redes] * f.experiencia[a.experiencia] * c;
  const baseR = a.objetivo === "comprar" ? 0 : cp.base_recrutas[a.horas] * f.contactos[a.contactos] * r;
  const bpRecruta = cp.vendas_recruta * cp.pontos_por_moeda;
  const descRecruta = descontoDe(cp, bpRecruta).desconto;

  const monthly: number[] = [];
  let team = 0;
  let rank = cp.escaloes[0].label;
  let clients6 = 0;
  let recruits6 = 0;
  for (let m = 1; m <= MONTHS; m++) {
    const ramp = rampa(m);
    const clientes = baseC * ramp;
    const recrutas = baseR * ramp;
    team = team * cp.retencao + recrutas; // equipa ativa: quem fica do mês anterior + recrutas novos
    const vp = clientes * cp.ticket_medio + consumo; // vendas pessoais
    const valorEquipa = team * cp.vendas_recruta;
    const valorGrupo = vp + valorEquipa;
    const grupo = descontoDe(cp, valorGrupo * cp.pontos_por_moeda);
    // Diferencial: a líder fica com a diferença entre o seu desconto de grupo e o de cada recruta.
    // min() evita diferencial negativo quando a equipa ativa é fracionária (< 1 pessoa).
    const descRec = Math.min(descRecruta, grupo.desconto);
    const ganho = vp * cp.margem_revenda + grupo.desconto * valorGrupo - descRec * valorEquipa;
    monthly.push(round2(Math.max(0, ganho)));
    if (m === REF_MONTH) {
      clients6 = clientes;
      recruits6 = recrutas;
    }
    if (m === MONTHS) rank = grupo.label;
  }
  return { monthly, rank_label: rank, clients6, recruits6, team12: team };
}

function toScenario(sim: Sim, cp: CountryPlan): Scenario {
  const month12 = sim.monthly[MONTHS - 1];
  const avg = sim.monthly.reduce((s, v) => s + v, 0) / MONTHS;
  return {
    monthly: sim.monthly,
    month12,
    avg_monthly: round2(avg),
    rank_label: sim.rank_label,
    inputs: { clients_per_month: round2(sim.clients6), avg_order: round2(cp.ticket_medio), recruits_per_month: round2(sim.recruits6) },
  };
}

function planOf(a: Answers, plan?: PlanTable): { cp: CountryPlan; plan: PlanTable } {
  const p = plan ?? loadPlan();
  const cp = p.countries[a.pais];
  if (!cp) throw new Error(`tabela do plano sem o país ${a.pais}`);
  return { cp, plan: p };
}

export function computeScenarios(
  a: Answers,
  plan?: PlanTable,
): { conservador: Scenario; provavel: Scenario; ambicioso: Scenario; currency: string; plan_version: string; is_example: boolean } {
  const { cp, plan: p } = planOf(a, plan);
  return {
    conservador: toScenario(simulate(a, cp, "conservador"), cp),
    provavel: toScenario(simulate(a, cp, "provavel"), cp),
    ambicioso: toScenario(simulate(a, cp, "ambicioso"), cp),
    currency: cp.currency,
    plan_version: p.version,
    is_example: p.is_example,
  };
}

const INTL_LOCALE: Record<string, string> = { pt: "pt-PT", es: "es-ES", fr: "fr-FR", en: "en-GB" };
export function intlLocale(lang: string): string {
  return INTL_LOCALE[lang] ?? "pt-PT";
}

function count(n: number, lang: string): string {
  const v = n >= 2 ? Math.round(n) : Math.round(n * 10) / 10;
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 1 }).format(v);
}

/** Pressupostos em linguagem simples (frases de content/copy/<lang>.json#assumptions), a partir do cenário provável. */
export function assumptionsFor(a: Answers, lang: string, plan?: PlanTable): string[] {
  const { cp, plan: p } = planOf(a, plan);
  const t = getCopy(lang).assumptions;
  const sim = simulate(a, cp, "provavel");
  const loc = intlLocale(lang);
  const money = (v: number) => new Intl.NumberFormat(loc, { style: "currency", currency: cp.currency, maximumFractionDigits: 0 }).format(v);
  void p;
  const out = [
    fill(t.personal, { x: money(cp.fatores.consumo[a.consumo]) }),
    fill(t.member_discount, { x: new Intl.NumberFormat(loc, { style: "percent", maximumFractionDigits: 0 }).format(cp.margem_revenda) }),
    fill(t.clients, { x: count(sim.clients6, lang) }),
    fill(t.ticket, { x: money(cp.ticket_medio) }),
    fill(t.ramp, { x: RAMP_MONTHS }),
  ];
  if (a.objetivo !== "comprar") {
    out.push(fill(t.recruits, { x: count(sim.team12, lang) }));
    out.push(fill(t.retention, { x: new Intl.NumberFormat(loc, { style: "percent", maximumFractionDigits: 0 }).format(cp.retencao) }));
    // Plano sem escalões de grupo publicados: a equipa não gera ganho na simulação, e a frase diz isso.
    if (cp.escaloes.every((e) => e.desconto === 0)) out.push(t.team_excluded);
  }
  return out;
}
