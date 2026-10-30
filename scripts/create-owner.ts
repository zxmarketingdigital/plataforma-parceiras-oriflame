// Cria a organização e o dono (owner) da plataforma, uma única vez, na VPS do aluno.
// Interativo (pergunta o que faltar) ou por variáveis de ambiente:
//   OWNER_EMAIL, OWNER_NAME, OWNER_PASSWORD, ORG_NAME, OWNER_SLUG
// Se já existir um dono, diz isso e sai com 0 (seguro para correr no install.sh).
// Liga-se com MIGRATE_DATABASE_URL (dono das tabelas) ou, se não existir, com DATABASE_URL.
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { Client } from "pg";

const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL (ou DATABASE_URL) em falta");
  process.exit(1);
}

// Iguais às de src/modules/crm/common.ts (aqui duplicadas para o script não arrancar a ligação da app).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_SLUGS = ["diagnostico", "painel", "api", "convite", "admin", "login", "privacidade", "legal", "static", "assets", "avatars", "_next"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 10;

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

function validate(field: "email" | "name" | "password" | "org" | "slug", value: string): string | null {
  switch (field) {
    case "email":
      return EMAIL_RE.test(value) ? null : "E-mail inválido.";
    case "name":
      return value.length >= 2 ? null : "Indique o nome.";
    case "org":
      return value.length >= 2 ? null : "Indique o nome da organização.";
    case "password":
      return value.length >= MIN_PASSWORD ? null : `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`;
    case "slug":
      if (!SLUG_RE.test(value)) return "O endereço só pode ter letras minúsculas, números e hífens (3 a 30).";
      if (RESERVED_SLUGS.includes(value)) return "Este endereço está reservado.";
      return null;
  }
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.bypass', 'on', true)");
    // Trava a criação em paralelo (dois installs ao mesmo tempo): o índice único users_one_owner_per_org só protege dentro da mesma org.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('create-owner'))");
    const existing = await client.query<{ email: string }>("SELECT email FROM users WHERE role = 'owner' LIMIT 1");
    if (existing.rows[0]) {
      await client.query("ROLLBACK");
      console.log(`[create-owner] Já existe um dono (${existing.rows[0].email}). Nada a fazer.`);
      return;
    }

    const env = process.env;
    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true }) : null;
    let muted = false;
    if (rl) {
      // Esconde o que se escreve ao pedir a senha.
      const w = rl as unknown as { _writeToOutput?: (s: string) => void };
      const original = w._writeToOutput?.bind(rl);
      w._writeToOutput = (s: string) => {
        if (muted) {
          if (s.includes("\n") || s.includes("\r")) process.stdout.write(s);
          return;
        }
        original?.(s);
      };
    }
    const ask = (q: string, secret = false) =>
      new Promise<string>((resolve) => {
        process.stdout.write(q);
        muted = secret;
        rl!.question("", (a) => {
          muted = false;
          resolve(a.trim());
        });
      });

    async function get(field: "email" | "name" | "password" | "org" | "slug", envKey: string, label: string, def?: string): Promise<string> {
      const fromEnv = env[envKey]?.trim();
      if (fromEnv) {
        const err = validate(field, fromEnv);
        if (err) throw new Error(`${envKey}: ${err}`);
        return fromEnv;
      }
      if (!rl) throw new Error(`${envKey} em falta (e não há terminal para perguntar)`);
      for (;;) {
        const raw = await ask(def ? `${label} [${def}]: ` : `${label}: `, field === "password");
        const value = raw || def || "";
        const err = validate(field, value);
        if (!err) return value;
        console.log(err);
      }
    }

    try {
      const org = await get("org", "ORG_NAME", "Nome da organização");
      const name = await get("name", "OWNER_NAME", "O seu nome");
      const email = (await get("email", "OWNER_EMAIL", "O seu e-mail")).toLowerCase();
      const slug = (await get("slug", "OWNER_SLUG", "Endereço da sua página (ex.: o seu nome)", slugify(name))).toLowerCase();
      const password = await get("password", "OWNER_PASSWORD", "Senha");
      if (rl && !env.OWNER_PASSWORD?.trim()) {
        const again = await ask("Repita a senha: ", true);
        if (again !== password) throw new Error("As senhas não coincidem.");
      }

      const taken = await client.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
      if (taken.rows[0]) throw new Error(`O e-mail ${email} já está em uso.`);
      const slugTaken = await client.query("SELECT 1 FROM leader_profiles WHERE lower(slug) = $1", [slug]);
      if (slugTaken.rows[0]) throw new Error(`O endereço "${slug}" já está em uso.`);

      const orgId = randomUUID();
      const userId = randomUUID();
      const passwordHash = await bcrypt.hash(password, 12); // mesmo custo que hashPassword em src/core/auth/session.ts
      await client.query("INSERT INTO organizations (id, name) VALUES ($1, $2)", [orgId, org]);
      await client.query(
        `INSERT INTO users (id, org_id, email, password_hash, name, role, parent_id, path)
         VALUES ($1,$2,$3,$4,$5,'owner',NULL,'root'::ltree)`,
        [userId, orgId, email, passwordHash, name],
      );
      await client.query("INSERT INTO leader_profiles (user_id, slug) VALUES ($1, $2)", [userId, slug]);
      await client.query("COMMIT");

      const base = (env.APP_URL || "").replace(/\/$/, "");
      console.log(`[create-owner] Criado: ${org} · ${name} <${email}>`);
      console.log(`[create-owner] Painel: ${base}/painel/login`);
      console.log(`[create-owner] Página pública: ${base}/pt (diagnóstico com o seu endereço: ?l=${slug})`);
    } finally {
      rl?.close();
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[create-owner] ${(err as Error).message}`);
  process.exit(1);
});
