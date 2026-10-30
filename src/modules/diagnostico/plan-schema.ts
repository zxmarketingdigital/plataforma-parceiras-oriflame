import { z } from "zod";

// Valores aceites em cada resposta. Fonte única para o motor, a validação da API e o schema da tabela do plano.
export const ANSWER_VALUES = {
  pais: ["PT", "ES", "FR", "GB"],
  objetivo: ["comprar", "rendimento", "negocio"],
  horas: ["2-5", "5-10", "10+"],
  contactos: ["<50", "50-150", "150+"],
  experiencia: ["nenhuma", "alguma", "muita"],
  redes: ["pouco", "ativo", "muito"],
  consumo: ["<30", "30-80", "80+"],
} as const;

export const QUESTION_ORDER = ["pais", "objetivo", "horas", "contactos", "experiencia", "redes", "consumo"] as const;
export type QuestionKey = (typeof QUESTION_ORDER)[number];

const pos = z.number().finite().positive();
const nonNeg = z.number().finite().min(0);

const horas = <T extends z.ZodType<number>>(v: T) => z.object({ "2-5": v, "5-10": v, "10+": v }).strict();
const contactos = <T extends z.ZodType<number>>(v: T) => z.object({ "<50": v, "50-150": v, "150+": v }).strict();
const redes = <T extends z.ZodType<number>>(v: T) => z.object({ pouco: v, ativo: v, muito: v }).strict();
const experiencia = <T extends z.ZodType<number>>(v: T) => z.object({ nenhuma: v, alguma: v, muita: v }).strict();
const consumo = <T extends z.ZodType<number>>(v: T) => z.object({ "<30": v, "30-80": v, "80+": v }).strict();

export const countryPlanSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    pontos_por_moeda: pos,
    margem_revenda: z.number().min(0).max(1),
    ticket_medio: pos,
    vendas_recruta: pos,
    retencao: z.number().min(0).max(1),
    base_clientes: horas(nonNeg),
    base_recrutas: horas(nonNeg),
    fatores: z.object({
      contactos: contactos(pos),
      redes: redes(pos),
      experiencia: experiencia(pos),
      // Consumo mensal próprio, na moeda do país, que corresponde a cada faixa da pergunta.
      consumo: consumo(nonNeg),
    }),
    escaloes: z
      .array(z.object({ bp_min: nonNeg, desconto: z.number().min(0).max(1), label: z.string().min(1) }))
      .min(1),
    signup_url_template: z.string().min(1),
  })
  .superRefine((c, ctx) => {
    const e = c.escaloes;
    if (e[0].bp_min !== 0) ctx.addIssue({ code: "custom", path: ["escaloes", 0, "bp_min"], message: "o primeiro escalão tem de começar em 0" });
    for (let i = 1; i < e.length; i++) {
      if (e[i].bp_min <= e[i - 1].bp_min) ctx.addIssue({ code: "custom", path: ["escaloes", i, "bp_min"], message: "bp_min tem de ser crescente" });
      if (e[i].desconto < e[i - 1].desconto) ctx.addIssue({ code: "custom", path: ["escaloes", i, "desconto"], message: "o desconto não pode descer entre escalões" });
    }
  });

export const planTableSchema = z.object({
  version: z.string().min(1),
  is_example: z.boolean(),
  notice: z.string().optional(),
  countries: z.object({ PT: countryPlanSchema, ES: countryPlanSchema, FR: countryPlanSchema, GB: countryPlanSchema }).strict(),
});

export type CountryPlan = z.infer<typeof countryPlanSchema>;
export type PlanTable = z.infer<typeof planTableSchema>;
