// Dados fictícios de demonstração (is_demo = true). Idempotente: apaga a organização demo e recria-a.
// Uso: npm run seed:demo        (recusa correr com NODE_ENV=production sem --force-demo)
// Liga-se com MIGRATE_DATABASE_URL (dono das tabelas) ou, se não existir, com DATABASE_URL (app_rw).
// Em ambos os casos abre a transação em modo sistema (app.bypass = on), como o withSystem da app.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { brandVars } from "@/core/brand";
import { fill, getCopy } from "@/core/i18n";
import { ANSWER_VALUES, assumptionsFor, computeScenarios, profileOf, type Answers } from "@/modules/diagnostico/engine";
import { fallbackReport } from "@/modules/diagnostico/report";

const ORG_NAME = "Atelier Nórdico (demo)";
const DAY = 86_400_000;

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force-demo")) {
  console.error("[seed-demo] recusado: NODE_ENV=production. Os dados de demonstração não vão para produção (use --force-demo se for mesmo isso).");
  process.exit(1);
}
const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("[seed-demo] MIGRATE_DATABASE_URL (ou DATABASE_URL) em falta");
  process.exit(1);
}
// NODE_ENV sozinho não protege: uma base remota com NODE_ENV de desenvolvimento também recusa.
const dbHost = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"].includes(dbHost) && !process.argv.includes("--force-demo")) {
  console.error(`[seed-demo] recusado: a base "${dbHost || "?"}" não é local. Use --force-demo se for mesmo para lá.`);
  process.exit(1);
}

// ---------------------------------------------------------------- utilitários

/** Gerador pseudoaleatório com semente fixa: o conteúdo é igual em cada corrida (só tokens e senha mudam). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261030);
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Senha demo legível (sem 0/O/1/l/I), no formato xxxx-xxxx-xxxx-xxxx. */
function demoPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

// ---------------------------------------------------------------- equipa

type Key = "atelier" | "marta" | "ines" | "carmen";
interface UserSpec {
  key: Key;
  role: "owner" | "leader";
  email: string;
  name: string;
  parent: Key | null;
  locale: "pt" | "es";
  country: "PT" | "ES";
  sponsor: string;
  whatsapp: string;
  brand_name: string;
  brand_tagline: Record<"pt" | "es" | "en" | "fr", string>;
  bio: Record<"pt" | "es" | "en" | "fr", string>;
}

const USERS: UserSpec[] = [
  {
    key: "atelier",
    role: "owner",
    email: "owner@demo.local",
    name: "Helena Norte",
    parent: null,
    locale: "pt",
    country: "PT",
    sponsor: "DEMO-1000",
    whatsapp: "+351910000001",
    brand_name: "Norte Beleza",
    brand_tagline: {
      pt: "Cuidado da pele e bem-estar, ao teu ritmo.",
      es: "Cuidado de la piel y bienestar, a tu ritmo.",
      en: "Skincare and wellbeing, at your own pace.",
      fr: "Soin de la peau et bien-être, à votre rythme.",
    },
    bio: {
      pt: "Parceira independente Oriflame. Acompanho quem quer comprar com desconto ou começar uma atividade própria, com calma e sem pressão.",
      es: "Socia independiente de Oriflame. Acompaño a quien quiere comprar con descuento o empezar una actividad propia, con calma y sin presión.",
      en: "Independent Oriflame partner. I support people who want to buy at a discount or start a business of their own, calmly and without pressure.",
      fr: "Partenaire indépendante Oriflame. J'accompagne celles et ceux qui veulent acheter à prix réduit ou lancer leur activité, sans pression.",
    },
  },
  {
    key: "marta",
    role: "leader",
    email: "marta@demo.local",
    name: "Marta Ribeiro",
    parent: "atelier",
    locale: "pt",
    country: "PT",
    sponsor: "DEMO-1101",
    whatsapp: "+351910000002",
    brand_name: "Marta Cuida",
    brand_tagline: {
      pt: "Cuidados simples para o teu dia a dia.",
      es: "Cuidados sencillos para tu día a día.",
      en: "Simple care for your everyday life.",
      fr: "Des soins simples pour votre quotidien.",
    },
    bio: {
      pt: "Consultora independente em Lisboa. Gosto de mostrar tudo com clareza antes de qualquer decisão.",
      es: "Consultora independiente en Lisboa. Me gusta explicarlo todo con claridad antes de cualquier decisión.",
      en: "Independent consultant in Lisbon. I like to explain everything clearly before any decision is made.",
      fr: "Consultante indépendante à Lisbonne. J'aime tout expliquer clairement avant toute décision.",
    },
  },
  {
    key: "ines",
    role: "leader",
    email: "ines@demo.local",
    name: "Inês Duarte",
    parent: "marta",
    locale: "pt",
    country: "PT",
    sponsor: "DEMO-1102",
    whatsapp: "+351910000003",
    brand_name: "Inês Pele Viva",
    brand_tagline: {
      pt: "Rotinas de pele e bem-estar sem complicação.",
      es: "Rutinas de cuidado sin complicaciones.",
      en: "Straightforward skincare and wellbeing routines.",
      fr: "Des routines de soin simples et accessibles.",
    },
    bio: {
      pt: "Comecei há dois anos, em part-time. Ajudo quem tem pouco tempo livre a organizar-se.",
      es: "Empecé hace dos años, a tiempo parcial. Ayudo a quien tiene poco tiempo libre a organizarse.",
      en: "I started two years ago, part-time. I help people with little spare time to get organised.",
      fr: "J'ai commencé il y a deux ans, à temps partiel. J'aide celles qui ont peu de temps libre à s'organiser.",
    },
  },
  {
    key: "carmen",
    role: "leader",
    email: "carmen@demo.local",
    name: "Carmen Vidal",
    parent: "atelier",
    locale: "es",
    country: "ES",
    sponsor: "DEMO-2201",
    whatsapp: "+34600000001",
    brand_name: "Carmen Belleza Consciente",
    brand_tagline: {
      pt: "Beleza consciente, com tempo para escolher.",
      es: "Belleza consciente, con tiempo para elegir.",
      en: "Conscious beauty, with time to choose.",
      fr: "Une beauté consciente, le temps de choisir.",
    },
    bio: {
      pt: "Consultora independente em Valência. Acompanho quem escreve em espanhol ou em português.",
      es: "Consultora independiente en Valencia. Acompaño a quien quiere empezar con cabeza y sin prisas.",
      en: "Independent consultant in Valencia. I support people who want to start thoughtfully and without rushing.",
      fr: "Consultante indépendante à Valence. J'accompagne celles qui veulent commencer sans se précipiter.",
    },
  },
];

// ---------------------------------------------------------------- contactos

type Stage = "novo" | "em_contacto" | "interessado" | "inscrito" | "ativo" | "perdido";
type Country = "PT" | "ES" | "FR" | "GB";
type Lang = "pt" | "es" | "fr" | "en";
type Source = "link_lider" | "direto" | "instagram" | "facebook" | "whatsapp" | "newsletter";

const LOCALE_OF: Record<Country, Lang> = { PT: "pt", ES: "es", FR: "fr", GB: "en" };
const PHONE: Record<Country, (n: number) => string> = {
  PT: (n) => `+35191000${pad(100 + n, 4)}`,
  ES: (n) => `+346000${pad(100 + n, 5)}`,
  FR: (n) => `+3363998${pad(100 + n, 4)}`,
  GB: (n) => `+447700900${pad(100 + n, 3)}`,
};

// objetivo, horas, contactos, experiencia, redes, consumo
type Quiz = [Answers["objetivo"], Answers["horas"], Answers["contactos"], Answers["experiencia"], Answers["redes"], Answers["consumo"]];

interface ContactSpec {
  name: string;
  country: Country;
  owner: Key;
  stage: Stage;
  daysAgo: number;
  source: Source;
  quiz?: Quiz; // diagnóstico concluído
  partial?: number; // diagnóstico incompleto: nº de respostas dadas
  lost?: string;
  note?: string; // nota do dono (na língua dele)
}

const CONTACTS: ContactSpec[] = [
  // Portugal
  { name: "Ana Sofia Carvalho", country: "PT", owner: "marta", stage: "ativo", daysAgo: 27, source: "instagram", quiz: ["negocio", "10+", "150+", "alguma", "muito", "80+"], note: "Primeira encomenda feita. Quer participar na formação de arranque de sexta." },
  { name: "Beatriz Nunes", country: "PT", owner: "marta", stage: "inscrito", daysAgo: 22, source: "link_lider", quiz: ["rendimento", "5-10", "50-150", "nenhuma", "ativo", "30-80"], note: "Inscreveu-se ontem. Combinar chamada de boas-vindas esta semana." },
  { name: "Catarina Matos", country: "PT", owner: "ines", stage: "interessado", daysAgo: 15, source: "link_lider", quiz: ["rendimento", "5-10", "50-150", "alguma", "ativo", "30-80"], note: "Tem dúvidas sobre o investimento inicial. Enviar o resumo das condições." },
  { name: "Diogo Ferreira", country: "PT", owner: "ines", stage: "em_contacto", daysAgo: 9, source: "facebook", quiz: ["comprar", "2-5", "<50", "nenhuma", "pouco", "<30"] },
  { name: "Filipa Antunes", country: "PT", owner: "marta", stage: "novo", daysAgo: 2, source: "instagram", quiz: ["rendimento", "2-5", "50-150", "nenhuma", "ativo", "30-80"] },
  { name: "Helena Correia", country: "PT", owner: "atelier", stage: "perdido", daysAgo: 20, source: "direto", lost: "Sem tempo neste momento", note: "Pediu para voltar a falar depois do verão." },
  { name: "Joana Pinheiro", country: "PT", owner: "atelier", stage: "ativo", daysAgo: 28, source: "newsletter", quiz: ["negocio", "10+", "150+", "muita", "muito", "80+"] },
  { name: "Rui Monteiro", country: "PT", owner: "ines", stage: "novo", daysAgo: 1, source: "whatsapp" },
  { name: "Sara Lopes", country: "PT", owner: "marta", stage: "em_contacto", daysAgo: 6, source: "instagram" },
  { name: "Teresa Andrade", country: "PT", owner: "atelier", stage: "interessado", daysAgo: 12, source: "direto", quiz: ["comprar", "5-10", "50-150", "alguma", "ativo", "80+"], note: "Quer sobretudo o desconto nas compras para a família." },
  // Espanha
  { name: "Lucía Fernández", country: "ES", owner: "carmen", stage: "ativo", daysAgo: 25, source: "instagram", quiz: ["negocio", "5-10", "150+", "alguma", "muito", "30-80"], note: "Ya tiene dos clientas fijas. Le interesa montar su propio equipo." },
  { name: "Marta Gil", country: "ES", owner: "carmen", stage: "inscrito", daysAgo: 18, source: "link_lider", quiz: ["rendimento", "5-10", "50-150", "alguma", "ativo", "30-80"] },
  { name: "Carlos Romero", country: "ES", owner: "carmen", stage: "em_contacto", daysAgo: 8, source: "facebook", quiz: ["comprar", "2-5", "<50", "nenhuma", "pouco", "30-80"] },
  { name: "Paula Navarro", country: "ES", owner: "atelier", stage: "interessado", daysAgo: 13, source: "newsletter" },
  { name: "Elena Ortega", country: "ES", owner: "carmen", stage: "perdido", daysAgo: 21, source: "link_lider", lost: "No responde a los mensajes", note: "Tres intentos sin respuesta. Cerrar si no contesta." },
  { name: "Javier Molina", country: "ES", owner: "carmen", stage: "novo", daysAgo: 3, source: "instagram", partial: 3 },
  // França
  { name: "Camille Dubois", country: "FR", owner: "atelier", stage: "interessado", daysAgo: 11, source: "instagram", quiz: ["rendimento", "5-10", "50-150", "alguma", "ativo", "30-80"], note: "Écrit en français. Je lui envoie le guide traduit." },
  { name: "Julien Moreau", country: "FR", owner: "marta", stage: "novo", daysAgo: 4, source: "facebook", quiz: ["comprar", "2-5", "<50", "nenhuma", "pouco", "<30"] },
  { name: "Chloé Lambert", country: "FR", owner: "atelier", stage: "em_contacto", daysAgo: 7, source: "whatsapp", quiz: ["negocio", "5-10", "150+", "nenhuma", "muito", "30-80"] },
  { name: "Mathieu Girard", country: "FR", owner: "ines", stage: "perdido", daysAgo: 16, source: "direto", lost: "Prefere comprar sem aderir" },
  { name: "Inès Faure", country: "FR", owner: "atelier", stage: "novo", daysAgo: 1, source: "instagram" },
  // Reino Unido
  { name: "Emily Clarke", country: "GB", owner: "atelier", stage: "inscrito", daysAgo: 19, source: "instagram", quiz: ["negocio", "5-10", "50-150", "alguma", "muito", "30-80"], note: "Signed up last week. Wants a plan she can follow after work." },
  { name: "Oliver Hughes", country: "GB", owner: "marta", stage: "em_contacto", daysAgo: 10, source: "facebook", quiz: ["comprar", "2-5", "<50", "nenhuma", "pouco", "30-80"] },
  { name: "Sophie Bennett", country: "GB", owner: "carmen", stage: "novo", daysAgo: 5, source: "newsletter", partial: 2 },
  { name: "James Whitfield", country: "GB", owner: "atelier", stage: "perdido", daysAgo: 24, source: "direto", lost: "Sem interesse em vender" },
];

// ---------------------------------------------------------------- validação dos dados fixos

function toAnswers(c: ContactSpec): Answers {
  const [objetivo, horas, contactos, experiencia, redes, consumo] = c.quiz!;
  const a: Answers = { pais: c.country, objetivo, horas, contactos, experiencia, redes, consumo };
  for (const [k, vals] of Object.entries(ANSWER_VALUES)) {
    if (!(vals as readonly string[]).includes(a[k as keyof Answers])) throw new Error(`resposta inválida em ${c.name}: ${k}=${a[k as keyof Answers]}`);
  }
  return a;
}

// ---------------------------------------------------------------- escrita

const STEPS: Record<Exclude<Stage, "perdido" | "novo">, Stage[]> = {
  em_contacto: ["em_contacto"],
  interessado: ["em_contacto", "interessado"],
  inscrito: ["em_contacto", "interessado", "inscrito"],
  ativo: ["em_contacto", "interessado", "inscrito", "ativo"],
};
const INTENT_OF = { comprar: "comprar", rendimento: "ambos", negocio: "aderir" } as const;

const iso = (ms: number) => new Date(ms).toISOString();

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  const password = demoPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = Date.now();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass', 'on', true)");

    // 1. Apagar o que é da organização demo (cascata: utilizadores, contactos, diagnósticos, atividades, eventos…).
    const old = (await client.query<{ id: string }>("SELECT id FROM organizations WHERE name = $1", [ORG_NAME])).rows;
    for (const o of old) {
      const real = (await client.query<{ n: string }>("SELECT count(*) AS n FROM contacts WHERE org_id = $1 AND NOT is_demo", [o.id])).rows[0].n;
      if (Number(real) > 0) throw new Error(`a organização "${ORG_NAME}" tem ${real} contactos que não são de demonstração; não apago.`);
      const strangers = (await client.query<{ email: string }>("SELECT email FROM users WHERE org_id = $1 AND NOT (lower(email) = ANY($2))", [o.id, USERS.map((u) => u.email.toLowerCase())])).rows;
      if (strangers.length) throw new Error(`a organização "${ORG_NAME}" tem ${strangers.length} utilizador(es) fora da demonstração; não apago.`);
      // activities.user_id e contacts.owner_id apontam para users sem cascata: tira primeiro contactos (e, por cascata, diagnósticos e atividades).
      await client.query("DELETE FROM contacts WHERE org_id = $1", [o.id]);
      await client.query("DELETE FROM invites WHERE org_id = $1", [o.id]);
      await client.query("DELETE FROM organizations WHERE id = $1", [o.id]);
    }
    const clash = await client.query<{ email: string }>("SELECT email FROM users WHERE lower(email) = ANY($1)", [USERS.map((u) => u.email)]);
    if (clash.rows.length) throw new Error(`já existem utilizadores com os e-mails de demonstração noutra organização: ${clash.rows.map((r) => r.email).join(", ")}`);
    const slugClash = await client.query<{ slug: string }>("SELECT slug FROM leader_profiles WHERE lower(slug) = ANY($1)", [USERS.map((u) => u.key)]);
    if (slugClash.rows.length) throw new Error(`já existem endereços de líder iguais aos da demonstração: ${slugClash.rows.map((r) => r.slug).join(", ")}`);

    // 2. Organização, utilizadores e perfis.
    const orgId = randomUUID();
    await client.query("INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)", [orgId, ORG_NAME, iso(now - 45 * DAY)]);

    const ids = new Map<Key, string>();
    const paths = new Map<Key, string>();
    for (const u of USERS) {
      const id = randomUUID();
      ids.set(u.key, id);
      paths.set(u.key, u.parent ? `${paths.get(u.parent)}.u${id.replace(/-/g, "").slice(0, 12)}` : "root");
    }
    for (const [i, u] of USERS.entries()) {
      const id = ids.get(u.key)!;
      await client.query(
        `INSERT INTO users (id, org_id, email, password_hash, name, role, parent_id, path, locale, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::ltree,$9,$10)`,
        [id, orgId, u.email, passwordHash, u.name, u.role, u.parent ? ids.get(u.parent) : null, paths.get(u.key), u.locale, iso(now - (44 - i * 2) * DAY)],
      );
      await client.query(
        `INSERT INTO leader_profiles (user_id, slug, sponsor_code, whatsapp_e164, photo_url, brand_name, brand_tagline, logo_url, country, bio) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
        [id, u.key, u.sponsor, u.whatsapp, `/avatars/${u.key}.svg`, u.brand_name, JSON.stringify(u.brand_tagline), null, u.country, JSON.stringify(u.bio)],
      );
    }

    // 3. Contactos, diagnósticos, atividades e eventos.
    const usedEmails = new Set<string>();
    let concluded = 0;
    for (const [i, c] of CONTACTS.entries()) {
      const owner = USERS.find((u) => u.key === c.owner)!;
      const ownerId = ids.get(c.owner)!;
      const lang = LOCALE_OF[c.country];
      const copy = getCopy(lang);

      let email = `${slugify(c.name)}@example.com`;
      if (usedEmails.has(email)) email = `${slugify(c.name)}.${i}@example.com`;
      usedEmails.add(email);

      const createdMs = now - c.daysAgo * DAY - int(0, 9) * 3_600_000 - int(0, 59) * 60_000;
      const utm =
        c.source === "link_lider" || c.source === "direto"
          ? {}
          : { utm_source: c.source, utm_medium: c.source === "newsletter" ? "email" : "social", utm_campaign: `outono-${pad(int(1, 3), 2)}` };
      const utmSource = (utm as { utm_source?: string }).utm_source;
      const source = utmSource ?? (c.source === "link_lider" ? "link_lider" : "direto");
      const consentText = fill(copy.chat.contact_step.consent_text, brandVars(owner.name, owner.brand_name));
      const contactId = randomUUID();

      // Linha do tempo (ms) e atividades, montadas antes de gravar para saber o updated_at.
      type Act = { at: number; user: string | null; type: "note" | "stage" | "system"; payload: Record<string, unknown> };
      type Ev = { at: number; type: string; source: string; payload: Record<string, unknown> };
      const acts: Act[] = [];
      const evs: Ev[] = [];
      let diagId: string | undefined;

      acts.push({ at: createdMs, user: null, type: "system", payload: { action: "lead_criado" } });

      let diagnostic: null | Record<string, unknown> = null;
      let intent: (typeof INTENT_OF)[keyof typeof INTENT_OF] | "indefinido" = "indefinido";
      let lastMs = createdMs;
      if (c.quiz) {
        const answers = toAnswers(c);
        const profile = profileOf(answers);
        const scen = computeScenarios(answers);
        const report = fallbackReport(profile, lang, owner.name, owner.brand_name);
        const token = randomBytes(32).toString("base64url");
        diagId = randomUUID();
        const completedMs = createdMs + int(4, 9) * 60_000 + int(0, 59) * 1000;
        diagnostic = {
          id: diagId,
          token_hash: hashToken(token),
          status: "concluido",
          locale: lang,
          answers: JSON.stringify(answers),
          profile,
          scenarios: JSON.stringify(scen),
          assumptions: JSON.stringify(assumptionsFor(answers, lang)),
          plan_version: scen.plan_version,
          analysis_text: report.analysis,
          plan30: JSON.stringify(report.plan30),
          ai_used: false,
          created_at: iso(createdMs),
          completed_at: iso(completedMs),
        };
        intent = INTENT_OF[answers.objetivo];
        lastMs = completedMs;
        concluded++;
        acts.push({ at: completedMs, user: null, type: "system", payload: { action: "diagnostico_concluido", diagnostic_id: diagId, profile, ai_used: false } });
        evs.push({ at: completedMs, type: "diagnostico.concluido", source: "diagnostico", payload: { contact_id: contactId, diagnostic_id: diagId, profile, ai_used: false, country: c.country } });
      } else if (c.partial) {
        diagId = randomUUID();
        const given: Record<string, string> = {};
        const order = ["pais", "objetivo", "horas", "contactos"] as const;
        for (const k of order.slice(0, c.partial)) given[k] = k === "pais" ? c.country : ANSWER_VALUES[k][0];
        diagnostic = {
          id: diagId,
          token_hash: hashToken(randomBytes(32).toString("base64url")),
          status: "incompleto",
          locale: lang,
          answers: JSON.stringify(given),
          profile: null,
          scenarios: null,
          assumptions: null,
          plan_version: null,
          analysis_text: null,
          plan30: null,
          ai_used: false,
          created_at: iso(createdMs),
          completed_at: null,
        };
      }
      evs.unshift({ at: createdMs, type: "lead.criado", source: "diagnostico", payload: { contact_id: contactId, diagnostic_id: diagId ?? null, owner_id: ownerId, source, locale: lang } });

      // Mudanças de etapa, espaçadas entre o início e agora.
      const chain: Stage[] = c.stage === "perdido" ? (c.daysAgo > 18 ? ["em_contacto", "interessado", "perdido"] : ["em_contacto", "perdido"]) : c.stage === "novo" ? [] : STEPS[c.stage];
      const t0 = lastMs + 3 * 3_600_000;
      const cap = now - 45 * 60_000;
      const gap = chain.length ? Math.max(0, Math.min(2.5 * DAY, (cap - t0) / chain.length)) : 0;
      let from: Stage = "novo";
      chain.forEach((to, k) => {
        const at = Math.round(t0 + gap * (k + 1) - gap * 0.2 * rnd());
        acts.push({ at, user: ownerId, type: "stage", payload: { from, to, lost_reason: to === "perdido" ? (c.lost ?? null) : null } });
        evs.push({ at, type: "lead.etapa_alterada", source: "crm", payload: { contact_id: contactId, from, to, by: ownerId } });
        from = to;
        lastMs = Math.max(lastMs, at);
      });
      if (c.note) {
        const at = Math.min(cap, Math.round(lastMs + (chain.length ? 0.3 : 1) * DAY * (0.3 + rnd()) + 3_600_000));
        acts.push({ at, user: ownerId, type: "note", payload: { text: c.note } });
        lastMs = Math.max(lastMs, at);
      }

      await client.query(
        `INSERT INTO contacts (id, org_id, owner_id, name, email, whatsapp_e164, country, locale, intent, stage, lost_reason, source, utm,
                               consent_at, consent_text, consent_ip, is_demo, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17,$18)`,
        [
          contactId, orgId, ownerId, c.name, email, PHONE[c.country](i + 1), c.country, lang, intent, c.stage,
          c.stage === "perdido" ? (c.lost ?? null) : null, source, JSON.stringify(utm),
          iso(createdMs), consentText, `192.0.2.${int(10, 240)}`, iso(createdMs), iso(lastMs),
        ],
      );
      if (diagnostic) {
        const d = diagnostic;
        await client.query(
          `INSERT INTO diagnostics (id, contact_id, token_hash, status, locale, answers, profile, scenarios, assumptions, plan_version,
                                    analysis_text, plan30, ai_used, created_at, completed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [d.id, contactId, d.token_hash, d.status, d.locale, d.answers, d.profile, d.scenarios, d.assumptions, d.plan_version, d.analysis_text, d.plan30, d.ai_used, d.created_at, d.completed_at],
        );
      }
      for (const a of acts.sort((x, y) => x.at - y.at)) {
        await client.query("INSERT INTO activities (contact_id, user_id, type, payload, created_at) VALUES ($1,$2,$3,$4,$5)", [contactId, a.user, a.type, JSON.stringify(a.payload), iso(a.at)]);
      }
      for (const e of evs.sort((x, y) => x.at - y.at)) {
        await client.query("INSERT INTO events (org_id, type, payload, source, created_at) VALUES ($1,$2,$3,$4,$5)", [orgId, e.type, JSON.stringify(e.payload), e.source, iso(e.at)]);
      }
    }

    // Contagens ainda dentro da transação (com app_rw, fora dela o RLS esconderia tudo).
    const count = async (sql: string) => Number((await client.query<{ n: string }>(sql, [orgId])).rows[0].n);
    const summary =
      `users=${await count("SELECT count(*) n FROM users WHERE org_id = $1")} ` +
      `contacts=${await count("SELECT count(*) n FROM contacts WHERE org_id = $1 AND is_demo")} ` +
      `diagnostics=${await count("SELECT count(*) n FROM diagnostics d JOIN contacts c ON c.id = d.contact_id WHERE c.org_id = $1")} ` +
      `(concluídos=${concluded}) ` +
      `activities=${await count("SELECT count(*) n FROM activities a JOIN contacts c ON c.id = a.contact_id WHERE c.org_id = $1")} ` +
      `events=${await count("SELECT count(*) n FROM events WHERE org_id = $1")}`;
    await client.query("COMMIT");

    // 4. Credenciais para quem vai ver a demonstração.
    const rows = USERS.map((u) => `| ${u.email} | ${u.role === "owner" ? "owner (dona da organização)" : "líder"} | \`${password}\` |`).join("\n");
    const md = `# Credenciais da demonstração

Geradas por \`scripts/seed-demo.ts\` em ${new Date(now).toISOString()}. **Só para desenvolvimento e demonstração.** Este ficheiro não vai para o git.
A mesma senha serve para os quatro utilizadores; é nova em cada corrida do seed.

| E-mail | Papel | Senha |
|---|---|---|
${rows}

Entrada no painel: ${process.env.APP_URL || "http://localhost:3000"}/painel/login

Páginas públicas de exemplo: \`/pt\` (owner), \`/pt/marta\`, \`/pt/ines\`, \`/es/carmen\`.
`;
    const file = fileURLToPath(new URL("./demo-credentials.md", import.meta.url));
    writeFileSync(file, md, { mode: 0o600 });
    chmodSync(file, 0o600);

    // 5. Resumo.
    console.log(`[seed-demo] organização: ${ORG_NAME}`);
    console.log(`[seed-demo] ${summary}`);
    console.log(`[seed-demo] credenciais gravadas em scripts/demo-credentials.md`);
    console.log(`[seed-demo] senha demo (os 4 utilizadores): ${password}`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

await main();
