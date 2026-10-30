// Agente redator-relatorio: análise do perfil e plano de 30 dias.
// A IA só escreve texto. Os números de ganhos vêm do motor e nunca passam pelo modelo; se a resposta trouxer
// valores monetários, percentagens ou vier fora do formato, usa-se o texto fixo do perfil (content/copy).
import { z } from "zod";
import { callModel as realCallModel, agentManifest } from "@/core/agents";
import { fill, getCopy } from "@/core/i18n";
import type { Answers, Profile } from "./engine";

export type Plan30 = { week: number; title: string; actions: string[] };
export type Report = { analysis: string; plan30: Plan30[]; ai_used: boolean };

const DEFAULT_TIMEOUT_MS = 20000;

/** Teto da chamada à IA: AI_TIMEOUT_MS (env) > timeout_ms do manifesto > 20 s. Valor inválido, zero ou negativo cai no padrão. */
export function reportTimeoutMs(): number {
  const fromEnv = Number(process.env.AI_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const fromManifest = Number(agentManifest("redator-relatorio").timeout_ms);
  return Number.isFinite(fromManifest) && fromManifest > 0 ? fromManifest : DEFAULT_TIMEOUT_MS;
}

const LANG_NAME: Record<string, string> = {
  pt: "português europeu (PT-PT)",
  es: "español de España",
  en: "British English",
  fr: "français de France",
};

const SYSTEM_PROMPT = `És o redator do Atelier Nórdico, parceira independente Oriflame. Escreves a análise de um "Diagnóstico do Empreendedor" e um plano de 30 dias, a partir das respostas da pessoa.

Regras que não podes quebrar:
- Não inventes nem cites valores de ganhos, preços, percentagens, comissões, prazos para "chegar a" um rendimento, nem comparações com outras pessoas. Não escrevas nenhum número seguido de moeda ou de %. Os números da simulação são mostrados à parte pelo sistema.
- Não prometas resultados nem uses linguagem de garantia, urgência ou pressão. Se mencionares dinheiro, diz apenas que os valores dependem do tempo, das vendas e das condições oficiais da Oriflame.
- Fala sempre em nome de uma parceira independente, nunca como a marca Oriflame nem como loja oficial.
- Se a pessoa só quer comprar com desconto (perfil consumidora), não empurres para recrutar nem para ter equipa. Diz que comprar para si é um caminho completo.
- Tom caloroso, claro e honesto, sem jargão e sem exageros. Trata a pessoa por "você" (ou o equivalente natural no idioma). Não uses o nome da pessoa.
- Usa só o que as respostas dizem. Não assumas idade, profissão, família nem situação financeira.
- Podes escrever {leader_name} onde faria sentido referir quem a vai acompanhar; o sistema troca pelo nome verdadeiro.

Formato da resposta: devolve APENAS um objeto JSON válido, sem texto antes nem depois e sem blocos de código, com esta forma:
{"analysis": "texto corrido de 120 a 220 palavras, em 2 a 3 parágrafos separados por \\n\\n",
 "plan30": [{"week": 1, "title": "título curto", "actions": ["ação concreta", "ação concreta", "ação concreta"]}, ... 4 semanas, week 1 a 4]}
Cada semana tem 3 ações pequenas e concretas, que a pessoa consegue fazer com o tempo que disse ter.`;

const planSchema = z
  .array(
    z.object({
      week: z.number().int().min(1).max(4),
      title: z.string().trim().min(3).max(90),
      actions: z.array(z.string().trim().min(5).max(220)).min(2).max(4),
    }),
  )
  .length(4)
  .refine((p) => new Set(p.map((w) => w.week)).size === 4, "semanas repetidas");

const reportSchema = z.object({ analysis: z.string().trim().min(200).max(2600), plan30: planSchema });

// Moeda, símbolos e percentagens: o modelo não pode ter números de ganhos.
const MONEY = /[€£$%]|\b(?:eur|gbp|usd|euros?|libras?|pounds?|dollars?|d[oó]lares?)\b/i;

export function parseReport(raw: string): { analysis: string; plan30: Plan30[] } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = reportSchema.safeParse(obj);
  if (!parsed.success) return null;
  const { analysis, plan30 } = parsed.data;
  const everything = [analysis, ...plan30.flatMap((w) => [w.title, ...w.actions])].join("\n");
  if (MONEY.test(everything)) return null;
  return { analysis, plan30: [...plan30].sort((a, b) => a.week - b.week) };
}

export function fallbackReport(profile: Profile, lang: string, leaderName: string): { analysis: string; plan30: Plan30[] } {
  const p = getCopy(lang).report_fallback.perfis[profile];
  const vars = { leader_name: leaderName };
  return {
    analysis: fill(p.analysis, vars),
    plan30: p.plan30.map((w) => ({ week: w.week, title: fill(w.title, vars), actions: w.actions.map((x) => fill(x, vars)) })),
  };
}

function answersForPrompt(a: Answers, lang: string): string {
  const q = getCopy(lang).chat.questions;
  const rows: [keyof typeof q, string][] = [
    ["objetivo", a.objetivo],
    ["horas", a.horas],
    ["contactos", a.contactos],
    ["experiencia", a.experiencia],
    ["redes", a.redes],
  ];
  return rows
    .map(([k, v]) => {
      const opts = q[k].options as Record<string, string>;
      return `- ${q[k].text} → ${opts[v] ?? v}`;
    })
    .join("\n");
}

export async function generateReport(
  input: { profile: Profile; answers: Answers; lang: string; leaderName: string },
  deps: { call?: typeof realCallModel } = {},
): Promise<Report> {
  const { profile, answers, lang, leaderName } = input;
  const t0 = Date.now();
  const timeoutMs = reportTimeoutMs();
  const user = [
    `Idioma da resposta: ${LANG_NAME[lang] ?? LANG_NAME.pt}. Escreve tudo nesse idioma (análise, títulos e ações).`,
    `Perfil calculado: ${profile}.`,
    "Respostas da pessoa:",
    answersForPrompt(answers, lang),
  ].join("\n");

  const raw = await (deps.call ?? realCallModel)({ system: SYSTEM_PROMPT, user, timeoutMs, maxTokens: 1800 });
  const ok = raw ? parseReport(raw) : null;
  console.log(`[report] ${ok ? "IA" : raw ? "IA inválida, texto fixo" : "sem IA, texto fixo"} em ${Date.now() - t0} ms (teto ${timeoutMs} ms)`);
  if (ok) {
    const vars = { leader_name: leaderName };
    return {
      analysis: fill(ok.analysis, vars),
      plan30: ok.plan30.map((w) => ({ week: w.week, title: fill(w.title, vars), actions: w.actions.map((x) => fill(x, vars)) })),
      ai_used: true,
    };
  }
  return { ...fallbackReport(profile, lang, leaderName), ai_used: false };
}
