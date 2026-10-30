import { describe, expect, it } from "vitest";
import { assumptionsFor, computeScenarios, loadPlan, profileOf, type Answers } from "@/modules/diagnostico/engine";
import { renderReportPdf } from "@/modules/diagnostico/pdf";
import { buildCta, type WorkerContext } from "@/modules/diagnostico/service";
import { getCopy, type Locale } from "@/core/i18n";

const LANGS: Locale[] = ["pt", "es", "en", "fr"];
const COUNTRY: Record<Locale, Answers["pais"]> = { pt: "PT", es: "ES", en: "GB", fr: "FR" };
const BRAND: Record<Locale, { name: string; tagline: string }> = {
  pt: { name: "Norte Beleza", tagline: "Cuidado da pele ao teu ritmo." },
  es: { name: "Belleza Serena", tagline: "Cuidado de la piel a tu ritmo." },
  en: { name: "North Beauty", tagline: "Skincare at your own pace." },
  fr: { name: "Beauté du Nord", tagline: "Des soins à votre rythme." },
};

/** Contexto fictício completo (sem BD): números do motor, texto de fallback da copy. */
function fakeContext(lang: Locale): WorkerContext {
  const answers: Answers = { pais: COUNTRY[lang], objetivo: "negocio", horas: "5-10", contactos: "50-150", experiencia: "alguma", redes: "ativo", consumo: "30-80" };
  const plan = loadPlan();
  const profile = profileOf(answers);
  const scen = computeScenarios(answers, plan);
  const fb = getCopy(lang).report_fallback.perfis[profile];
  const leader = { name: "Inês Ação", brand_name: BRAND[lang].name, brand_tagline: BRAND[lang].tagline, photo_url: null, sponsor_code: "12345", whatsapp_e164: "+351912345678" };
  const contactName = "María José Gonçalves";
  return {
    id: "00000000-0000-4000-8000-000000000001",
    lang,
    contactName,
    contactEmail: "teste@example.com",
    leader,
    answers,
    profile,
    scenarios: scen,
    assumptions: assumptionsFor(answers, lang, plan),
    analysis: fb.analysis.replaceAll("{leader_name}", leader.name),
    plan30: fb.plan30.map((w) => ({ ...w, actions: w.actions.map((a) => a.replaceAll("{leader_name}", leader.name)) })),
    ai_used: false,
    pdfReady: false,
    cta: buildCta(plan.countries[answers.pais], leader, contactName, lang),
    orgId: "00000000-0000-4000-8000-0000000000aa",
    contactId: "00000000-0000-4000-8000-0000000000bb",
    pdfPath: null,
  };
}

describe("relatório em PDF", () => {
  it.each(LANGS)("gera um PDF válido em %s", async (lang) => {
    const pdf = await renderReportPdf(fakeContext(lang));
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2048);
    expect(pdf.subarray(-16).toString("latin1")).toContain("%%EOF");
  });

  it("não falha com marca fora do WinAnsi", async () => {
    const context = fakeContext("pt");
    context.leader.brand_name = "Марка 🌿";
    context.leader.brand_tagline = "Уход за кожей 🌿";
    const pdf = await renderReportPdf(context);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
