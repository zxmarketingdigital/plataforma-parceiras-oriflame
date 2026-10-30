import { describe, expect, it } from "vitest";
import {
  ANSWER_VALUES,
  assumptionsFor,
  computeScenarios,
  loadPlan,
  profileOf,
  rampa,
  RAMP_MONTHS,
  type Answers,
  type PlanTable,
} from "@/modules/diagnostico/engine";
import { planTableSchema } from "@/modules/diagnostico/plan-schema";

const base: Answers = { pais: "PT", objetivo: "negocio", horas: "5-10", contactos: "50-150", experiencia: "alguma", redes: "ativo", consumo: "30-80" };
const countries = ANSWER_VALUES.pais;

function allNumbers(s: ReturnType<typeof computeScenarios>): number[] {
  return [s.conservador, s.provavel, s.ambicioso].flatMap((x) => [...x.monthly, x.month12, x.avg_monthly, ...Object.values(x.inputs)]);
}

describe("tabela do plano", () => {
  it("o ficheiro traz o plano oficial publicado (desconto de membro por país, sem escalões de grupo)", () => {
    const plan = loadPlan();
    expect(planTableSchema.safeParse(plan).success).toBe(true);
    expect(plan.is_example).toBe(false);
    expect(plan.version).toBe("oficial-2026-10");
    expect(plan.countries.ES.margem_revenda).toBe(0.23);
    for (const k of ["PT", "FR", "GB"] as const) expect(plan.countries[k].margem_revenda).toBe(0.2);
    for (const cp of Object.values(plan.countries)) expect(cp.escaloes.every((e) => e.desconto === 0)).toBe(true);
    expect(Object.keys(plan.countries).sort()).toEqual(["ES", "FR", "GB", "PT"]);
    expect(plan.countries.GB.currency).toBe("GBP");
    expect(plan.countries.PT.currency).toBe("EUR");
  });

  it("recusa tabela com escalões fora de ordem ou sem país", () => {
    const bad = structuredClone(loadPlan());
    bad.countries.PT.escaloes = [
      { bp_min: 0, desconto: 0, label: "0 %" },
      { bp_min: 400, desconto: 0.06, label: "6 %" },
      { bp_min: 100, desconto: 0.09, label: "9 %" },
    ];
    expect(planTableSchema.safeParse(bad).success).toBe(false);
    const noCountry = structuredClone(loadPlan()) as Partial<PlanTable>;
    delete (noCountry.countries as Record<string, unknown>).FR;
    expect(planTableSchema.safeParse(noCountry).success).toBe(false);
  });
});

describe("rampa", () => {
  it("começa em 0.35 + 0.065 e chega a 1 no mês 10", () => {
    expect(rampa(1)).toBeCloseTo(0.415, 10);
    expect(rampa(6)).toBeCloseTo(0.74, 10);
    expect(rampa(10)).toBe(1);
    expect(rampa(12)).toBe(1);
    expect(RAMP_MONTHS).toBe(10);
  });
});

describe("perfil", () => {
  it("segue o objetivo", () => {
    expect(profileOf({ ...base, objetivo: "comprar" })).toBe("consumidora");
    expect(profileOf({ ...base, objetivo: "rendimento" })).toBe("rendimento_extra");
    expect(profileOf({ ...base, objetivo: "negocio" })).toBe("construtora_negocio");
  });
});

describe.each(countries)("motor, país %s", (pais) => {
  const a: Answers = { ...base, pais };
  const s = computeScenarios(a);

  it("tem 12 meses em cada cenário, sem NaN e sem negativos", () => {
    for (const sc of [s.conservador, s.provavel, s.ambicioso]) {
      expect(sc.monthly).toHaveLength(12);
      expect(sc.month12).toBe(sc.monthly[11]);
    }
    for (const n of allNumbers(s)) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it("os três cenários vêm por ordem: conservador ≤ provável ≤ ambicioso", () => {
    for (let i = 0; i < 12; i++) {
      expect(s.conservador.monthly[i]).toBeLessThanOrEqual(s.provavel.monthly[i]);
      expect(s.provavel.monthly[i]).toBeLessThanOrEqual(s.ambicioso.monthly[i]);
    }
    expect(s.conservador.avg_monthly).toBeLessThanOrEqual(s.provavel.avg_monthly);
    expect(s.provavel.avg_monthly).toBeLessThanOrEqual(s.ambicioso.avg_monthly);
    expect(s.provavel.month12).toBeGreaterThan(0);
  });

  it("arredonda a 2 casas", () => {
    for (const n of allNumbers(s)) expect(Math.abs(n * 100 - Math.round(n * 100))).toBeLessThan(1e-6);
  });

  it("a rampa faz o ganho subir do mês 1 para o mês 12", () => {
    expect(s.provavel.monthly[0]).toBeLessThan(s.provavel.monthly[11]);
    for (let i = 1; i < 12; i++) expect(s.provavel.monthly[i]).toBeGreaterThanOrEqual(s.provavel.monthly[i - 1]);
  });

  it("moeda e versão vêm da tabela", () => {
    expect(s.currency).toBe(loadPlan().countries[pais].currency);
    expect(s.plan_version).toBe(loadPlan().version);
    expect(s.is_example).toBe(loadPlan().is_example);
  });

  it("objetivo=comprar não tem recrutas", () => {
    const buy = computeScenarios({ ...a, objetivo: "comprar" });
    for (const sc of [buy.conservador, buy.provavel, buy.ambicioso]) {
      expect(sc.inputs.recruits_per_month).toBe(0);
      expect(sc.monthly).toHaveLength(12);
    }
    // sem equipa, o ganho é só o das vendas pessoais: nunca supera o do mesmo perfil a construir negócio
    expect(buy.provavel.month12).toBeLessThanOrEqual(s.provavel.month12);
  });

  it("pressupostos em linguagem simples nos 4 idiomas, sem chavetas por trocar", () => {
    for (const lang of ["pt", "es", "en", "fr"]) {
      const list = assumptionsFor(a, lang);
      expect(list.length).toBe(8); // +desconto de membro, +bónus de equipa fora do cálculo
      for (const line of list) {
        expect(line).not.toMatch(/\{\w+\}/);
        expect(line.length).toBeGreaterThan(10);
      }
    }
    expect(assumptionsFor({ ...a, objetivo: "comprar" }, "pt").length).toBe(5);
  });
});

describe("motor, casos de referência", () => {
  it("reproduz à mão o mês 12 do cenário provável de PT (5-10h, 50-150, alguma, ativo, 30-80)", () => {
    const cp = loadPlan().countries.PT;
    const clientes = cp.base_clientes["5-10"]; // fatores todos 1, mult 1, rampa 1
    const recrutas = cp.base_recrutas["5-10"];
    let team = 0;
    for (let m = 1; m <= 12; m++) team = team * cp.retencao + recrutas * rampa(m);
    const vp = clientes * cp.ticket_medio + cp.fatores.consumo["30-80"];
    const valorEquipa = team * cp.vendas_recruta;
    const bpG = (vp + valorEquipa) * cp.pontos_por_moeda;
    const esc = [...cp.escaloes].reverse().find((e) => bpG >= e.bp_min)!;
    const bpR = cp.vendas_recruta * cp.pontos_por_moeda;
    const escR = [...cp.escaloes].reverse().find((e) => bpR >= e.bp_min)!;
    const ganho = vp * cp.margem_revenda + esc.desconto * (vp + valorEquipa) - Math.min(escR.desconto, esc.desconto) * valorEquipa;
    const s = computeScenarios(base);
    expect(s.provavel.month12).toBeCloseTo(Math.round(ganho * 100) / 100, 2);
    expect(s.provavel.rank_label).toBe(esc.label);
  });

  it("mais horas, mais contactos e mais redes nunca baixam o resultado", () => {
    const weak = computeScenarios({ ...base, horas: "2-5", contactos: "<50", redes: "pouco", experiencia: "nenhuma" });
    const strong = computeScenarios({ ...base, horas: "10+", contactos: "150+", redes: "muito", experiencia: "muita" });
    expect(strong.provavel.month12).toBeGreaterThan(weak.provavel.month12);
    expect(strong.provavel.avg_monthly).toBeGreaterThan(weak.provavel.avg_monthly);
  });

  it("todas as combinações de respostas dão números finitos e cenários ordenados", () => {
    const V = ANSWER_VALUES;
    for (const pais of V.pais)
      for (const objetivo of V.objetivo)
        for (const horas of V.horas)
          for (const contactos of V.contactos)
            for (const experiencia of V.experiencia)
              for (const redes of V.redes)
                for (const consumo of V.consumo) {
                  const s = computeScenarios({ pais, objetivo, horas, contactos, experiencia, redes, consumo });
                  for (const n of allNumbers(s)) expect(Number.isFinite(n)).toBe(true);
                  for (let i = 0; i < 12; i++) {
                    expect(s.conservador.monthly[i]).toBeLessThanOrEqual(s.provavel.monthly[i]);
                    expect(s.provavel.monthly[i]).toBeLessThanOrEqual(s.ambicioso.monthly[i]);
                  }
                }
  });

  it("usa a tabela passada como argumento (settings.plan_table) em vez da do ficheiro", () => {
    const custom = structuredClone(loadPlan());
    custom.version = "custom-1";
    custom.is_example = false;
    custom.countries.PT.ticket_medio = 100;
    const s = computeScenarios(base, custom);
    expect(s.plan_version).toBe("custom-1");
    expect(s.is_example).toBe(false);
    expect(s.provavel.inputs.avg_order).toBe(100);
    expect(s.provavel.month12).toBeGreaterThan(computeScenarios(base).provavel.month12);
  });
});
