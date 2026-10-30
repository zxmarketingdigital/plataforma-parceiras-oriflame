// Aplica drizzle/*.sql por ordem, uma vez cada, como dono das tabelas (MIGRATE_DATABASE_URL).
// Também define a senha do papel app_rw a partir de APP_DB_PASSWORD.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL em falta");
  process.exit(1);
}

const dir = path.resolve(process.cwd(), "drizzle");
const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(path.join(dir, f), "utf8");
    console.log(`[migrate] ${f}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  const pw = process.env.APP_DB_PASSWORD;
  if (pw) {
    await client.query(`ALTER ROLE app_rw WITH LOGIN PASSWORD ${client.escapeLiteral(pw)}`);
  }
  console.log("[migrate] ok");
} finally {
  await client.end();
}
