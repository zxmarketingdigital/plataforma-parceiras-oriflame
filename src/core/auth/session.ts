import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { withSystem, type SessionUser } from "../db/client";

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 14;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export interface AuthUser extends SessionUser {
  email: string;
  name: string;
  locale: string;
}

/** Valida e-mail e senha. Devolve o utilizador ativo ou null (mesma resposta para e-mail inexistente e senha errada). */
export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const row = await withSystem(async (db) => {
    const r = await db.query(
      `SELECT id, org_id, path::text AS path, role, email, name, locale, password_hash, active
         FROM users WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    return r.rows[0];
  });
  // Compara sempre, para o tempo de resposta não revelar se o e-mail existe.
  const ok = await bcrypt.compare(password, row?.password_hash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!row || !ok || !row.active) return null;
  return { id: row.id, orgId: row.org_id, path: row.path, role: row.role, email: row.email, name: row.name, locale: row.locale };
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  await withSystem((db) =>
    db.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)", [
      userId,
      hashToken(token),
      String(SESSION_DAYS),
    ]),
  );
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await withSystem((db) => db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]));
}

export async function userFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  return withSystem(async (db) => {
    const r = await db.query(
      `SELECT u.id, u.org_id, u.path::text AS path, u.role, u.email, u.name, u.locale
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
      [hashToken(token)],
    );
    const u = r.rows[0];
    return u ? { id: u.id, orgId: u.org_id, path: u.path, role: u.role, email: u.email, name: u.name, locale: u.locale } : null;
  });
}

/** Utilizador da sessão atual (Server Components e rotas). */
export async function currentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}
