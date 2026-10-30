import { Pool, type PoolClient } from "pg";

// A app liga-se como app_rw (sujeito ao RLS). Toda a query passa por withUser ou withSystem.
const globalForPool = globalThis as unknown as { __pgPool?: Pool };

export const pool: Pool =
  globalForPool.__pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 10) });
if (process.env.NODE_ENV !== "production") globalForPool.__pgPool = pool;

export type Db = PoolClient;

export interface SessionUser {
  id: string;
  orgId: string;
  path: string;
  role: "owner" | "leader" | "assistant";
}

async function tx<T>(setup: (c: PoolClient) => Promise<void>, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setup(client);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Transação limitada à subárvore do utilizador (RLS + filtros da app). */
export function withUser<T>(user: SessionUser, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!user.path) throw new Error("withUser sem path");
  return tx(async (c) => {
    await c.query("SELECT set_config('app.user_path', $1, true), set_config('app.org_id', $2, true)", [user.path, user.orgId]);
  }, fn);
}

/** Transação de sistema (rotas públicas do diagnóstico, worker, seed, auth). Ignora o RLS. */
export function withSystem<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return tx(async (c) => {
    await c.query("SELECT set_config('app.bypass', 'on', true)");
  }, fn);
}
