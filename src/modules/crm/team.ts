import { randomUUID } from "node:crypto";
import { z } from "zod";
import { BRAND_NAME_MAX, BRAND_TAGLINE_MAX, IMAGE_URL_MAX, IMAGE_URL_MESSAGE, isLeaderImageUrl } from "@/core/brand";
import { withSystem, withUser, type SessionUser } from "@/core/db/client";
import { can, HttpError, isAncestorOrSelf } from "@/core/permissions";
import { forbidden, notFound, RESERVED_SLUGS, SLUG_RE } from "./common";
import { scopeSql } from "./leads";
import { toE164 } from "./phone";
import { hashToken, newToken } from "./tokens";

const LOCALES = ["pt", "es", "en", "fr"] as const;
export const INVITE_DAYS = 7;
export const MIN_PASSWORD = 10;

// ---------------------------------------------------------------- árvore

interface TeamNode {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  locale: string;
  created_at: Date;
  profile: null | {
    slug: string;
    sponsor_code: string | null;
    whatsapp_e164: string | null;
    photo_url: string | null;
    brand_name: string | null;
    brand_tagline: Record<string, string>;
    logo_url: string | null;
    country: string | null;
    bio: Record<string, string>;
  };
  lp_paths: Record<string, string> | null;
  leads_own: number;
  leads_total: number;
  children: TeamNode[];
}

/** Árvore da subárvore de quem pede: a raiz é o próprio utilizador. Assistentes aparecem como filhos de quem os convidou. */
export async function getTeam(user: SessionUser) {
  if (!can(user, "team.read")) throw forbidden();
  return withUser(user, async (db) => {
    const users = (
      await db.query(
        `SELECT u.id, u.parent_id, u.name, u.email, u.role, u.active, u.locale, u.created_at,
                lp.slug, lp.sponsor_code, lp.whatsapp_e164, lp.photo_url, lp.brand_name, lp.brand_tagline, lp.logo_url, lp.country, lp.bio
           FROM users u LEFT JOIN leader_profiles lp ON lp.user_id = u.id
          WHERE u.org_id = $1 AND u.path <@ $2::ltree
          ORDER BY nlevel(u.path), u.name`,
        [user.orgId, user.path],
      )
    ).rows;
    const params: unknown[] = [];
    const scope = scopeSql(user, params);
    const counts = new Map<string, number>(
      (await db.query(`SELECT c.owner_id, count(*)::int AS n FROM contacts c WHERE ${scope} GROUP BY c.owner_id`, params)).rows.map((r) => [r.owner_id as string, r.n as number]),
    );

    const nodes = new Map<string, TeamNode>();
    for (const r of users) {
      nodes.set(r.id, {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        active: r.active,
        locale: r.locale,
        created_at: r.created_at,
        profile: r.slug
          ? {
              slug: r.slug,
              sponsor_code: r.sponsor_code,
              whatsapp_e164: r.whatsapp_e164,
              photo_url: r.photo_url,
              brand_name: r.brand_name,
              brand_tagline: r.brand_tagline ?? {},
              logo_url: r.logo_url,
              country: r.country,
              bio: r.bio ?? {},
            }
          : null,
        lp_paths: r.slug ? Object.fromEntries(LOCALES.map((l) => [l, `/${l}/${r.slug}`])) : null,
        leads_own: counts.get(r.id) ?? 0,
        leads_total: 0,
        children: [],
      });
    }
    let root: TeamNode | null = null;
    for (const r of users) {
      const n = nodes.get(r.id)!;
      const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
      if (r.id === user.id) root = n;
      else if (parent) parent.children.push(n);
    }
    const total = (n: TeamNode): number => (n.leads_total = n.leads_own + n.children.reduce((s, c) => s + total(c), 0));
    if (root) total(root);
    return { tree: root ? [root] : [], app_url: process.env.APP_URL ?? null };
  });
}

// ---------------------------------------------------------------- desativar / reativar

export const activeSchema = z.object({ active: z.boolean() }).strict();

/**
 * Desativa (ou reativa) alguém da subárvore. Desativar sobe os leads do utilizador para o antepassado ativo mais próximo
 * (dentro da subárvore de quem pede), com atividade `owner` e evento `lead.dono_alterado` por lead, e termina as sessões.
 */
export async function setUserActive(user: SessionUser, targetId: string, active: boolean) {
  if (!can(user, "team.deactivate")) throw forbidden();
  const out = await withUser(user, async (db) => {
    const t = (
      await db.query(`SELECT id, parent_id, role, active, path::text AS path FROM users WHERE id = $1 AND org_id = $2 AND path <@ $3::ltree FOR UPDATE`, [
        targetId,
        user.orgId,
        user.path,
      ])
    ).rows[0] as undefined | { id: string; parent_id: string | null; role: string; active: boolean; path: string };
    if (!t) throw notFound();
    if (t.id === user.id) throw new HttpError(400, "cannot_change_self", "Não pode desativar a sua própria conta");
    if (t.role === "owner") throw forbidden();
    if (t.active === active) return { ok: true, active, leads_moved: 0, moved_to: null as string | null };

    if (active) {
      await db.query(`UPDATE users SET active = true WHERE id = $1`, [t.id]);
      return { ok: true, active, leads_moved: 0, moved_to: null as string | null };
    }

    // Antepassado ativo mais próximo, sem sair da subárvore de quem pede.
    const tree = (await db.query(`SELECT id, parent_id, active FROM users WHERE org_id = $1 AND path <@ $2::ltree`, [user.orgId, user.path])).rows as {
      id: string;
      parent_id: string | null;
      active: boolean;
    }[];
    const byId = new Map(tree.map((r) => [r.id, r]));
    let cur = t.parent_id ? byId.get(t.parent_id) : undefined;
    while (cur && !cur.active) cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    const destId = cur?.id ?? user.id;

    await db.query(`UPDATE users SET active = false WHERE id = $1`, [t.id]);
    const moved = await db.query(
      `WITH moved AS (
         UPDATE contacts SET owner_id = $2, updated_at = now() WHERE owner_id = $1 AND org_id = $4 RETURNING id
       ), act AS (
         INSERT INTO activities (contact_id, user_id, type, payload)
         SELECT id, $3, 'owner', jsonb_build_object('from', $1::text, 'to', $2::text, 'reason', 'deactivated') FROM moved
       ), ev AS (
         INSERT INTO events (org_id, type, payload, source)
         SELECT $4, 'lead.dono_alterado', jsonb_build_object('contact_id', id, 'from_owner_id', $1::text, 'to_owner_id', $2::text, 'reason', 'deactivated', 'by', $3::text), 'crm'
           FROM moved
       )
       SELECT count(*)::int AS n FROM moved`,
      [t.id, destId, user.id, user.orgId],
    );
    return { ok: true, active, leads_moved: moved.rows[0].n as number, moved_to: destId };
  });
  if (!active) await withSystem((db) => db.query(`DELETE FROM sessions WHERE user_id = $1`, [targetId]));
  return out;
}

// ---------------------------------------------------------------- convites

export const inviteSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(200)), role: z.enum(["leader", "assistant"]).default("leader") }).strict();

export async function createInvite(user: SessionUser, body: z.infer<typeof inviteSchema>) {
  if (!can(user, "team.invite")) throw forbidden();
  const taken = await withSystem(async (db) => (await db.query(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [body.email])).rowCount);
  if (taken) throw new HttpError(409, "email_in_use", "Já existe uma conta com este e-mail");
  const token = newToken();
  const row = await withUser(user, async (db) => {
    // Um convite pendente por e-mail: o novo substitui os anteriores ainda por aceitar.
    await db.query(`DELETE FROM invites WHERE org_id = $1 AND lower(email) = lower($2) AND accepted_at IS NULL`, [user.orgId, body.email]);
    return (
      await db.query(
        `INSERT INTO invites (org_id, email, invited_by, role, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval) RETURNING id, email, role, expires_at, created_at`,
        [user.orgId, body.email, user.id, body.role, hashToken(token), String(INVITE_DAYS)],
      )
    ).rows[0];
  });
  // O token só existe aqui; o e-mail de convite fica a cargo de quem consome `link` (ver NOTAS-CONTRATO.md).
  return { ...row, link: `${process.env.APP_URL ?? ""}/convite/${token}`, email_sent: false };
}

export async function listInvites(user: SessionUser) {
  if (!can(user, "team.invite")) throw forbidden();
  return withUser(user, async (db) => {
    const r = await db.query(
      `SELECT i.id, i.email, i.role, i.expires_at, i.created_at, i.accepted_at, u.name AS invited_by_name
         FROM invites i JOIN users u ON u.id = i.invited_by
        WHERE i.org_id = $1 ORDER BY i.created_at DESC LIMIT 200`,
      [user.orgId],
    );
    return { items: r.rows };
  });
}

export const acceptSchema = z
  .object({
    token: z.string().min(20).max(200),
    name: z.string().trim().min(2).max(120),
    password: z.string().min(MIN_PASSWORD, `Mínimo ${MIN_PASSWORD} caracteres`).max(200),
    slug: z.string().trim().toLowerCase().optional(),
    sponsor_code: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/, "Código inválido").optional(),
    whatsapp: z.string().trim().max(40).optional(),
    locale: z.enum(LOCALES).optional(),
    country: z.string().trim().length(2).toUpperCase().optional(),
  })
  .strict();

export function validateSlug(slug: string) {
  if (!SLUG_RE.test(slug)) throw new HttpError(400, "invalid_slug", "O endereço só pode ter letras minúsculas, números e hífens (3 a 30)");
  if (RESERVED_SLUGS.includes(slug)) throw new HttpError(400, "reserved_slug", "Este endereço está reservado");
}

/** Cria a conta a partir de um convite válido. Rota pública (modo sistema); respostas de token inválido/expirado/usado são iguais. */
export async function acceptInvite(body: z.infer<typeof acceptSchema>, passwordHash: string) {
  const whatsapp = body.whatsapp ? toE164(body.whatsapp) : null;
  if (body.whatsapp && !whatsapp) throw new HttpError(400, "invalid_whatsapp", "WhatsApp inválido: use o formato internacional (+351...)");
  try {
    return await withSystem(async (db) => {
      const inv = (
        await db.query(
          `SELECT i.id, i.org_id, i.email, i.role, u.id AS inviter_id, u.path::text AS inviter_path
             FROM invites i JOIN users u ON u.id = i.invited_by AND u.active
            WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.expires_at > now() FOR UPDATE OF i`,
          [hashToken(body.token)],
        )
      ).rows[0] as undefined | { id: string; org_id: string; email: string; role: "leader" | "assistant"; inviter_id: string; inviter_path: string };
      if (!inv) throw new HttpError(404, "invalid_invite", "Convite inválido ou expirado");

      if (inv.role === "leader") {
        if (!body.slug) throw new HttpError(400, "slug_required", "Escolha o seu endereço (slug)");
        validateSlug(body.slug);
      }
      const id = randomUUID();
      // Assistente partilha a subárvore de quem o convidou (vê e trabalha os mesmos leads); líder abre um ramo novo.
      const path = inv.role === "assistant" ? inv.inviter_path : `${inv.inviter_path}.u${id.replace(/-/g, "").slice(0, 12)}`;
      await db.query(
        `INSERT INTO users (id, org_id, email, password_hash, name, role, parent_id, path, locale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::ltree, $9)`,
        [id, inv.org_id, inv.email, passwordHash, body.name, inv.role, inv.inviter_id, path, body.locale ?? "pt"],
      );
      if (inv.role === "leader") {
        await db.query(
          `INSERT INTO leader_profiles (user_id, slug, sponsor_code, whatsapp_e164, country) VALUES ($1, $2, $3, $4, $5)`,
          [id, body.slug, body.sponsor_code || null, whatsapp, body.country ?? null],
        );
      }
      await db.query(`UPDATE invites SET accepted_at = now() WHERE id = $1`, [inv.id]);
      return { id, orgId: inv.org_id, role: inv.role, email: inv.email, name: body.name };
    });
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e.code === "23505") {
      if (e.constraint === "leader_profiles_slug_uq") throw new HttpError(409, "slug_taken", "Este endereço já está em uso");
      if (e.constraint === "users_email_uq") throw new HttpError(409, "email_in_use", "Já existe uma conta com este e-mail");
    }
    throw err;
  }
}

// ---------------------------------------------------------------- perfil

const photoUrl = z.string().trim().max(IMAGE_URL_MAX).refine(isLeaderImageUrl, IMAGE_URL_MESSAGE);

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    locale: z.enum(LOCALES).optional(),
    whatsapp: z.string().trim().max(40).nullable().optional(),
    sponsor_code: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/, "Código inválido").nullable().optional(),
    photo_url: photoUrl.nullable().optional(),
    brand_name: z.string().trim().max(BRAND_NAME_MAX).transform((v) => (v === "" ? null : v.replace(/\s+/g, " "))).nullable().optional(),
    brand_tagline: z.partialRecord(z.enum(LOCALES), z.string().trim().max(BRAND_TAGLINE_MAX).transform((v) => v.replace(/\s+/g, " "))).optional(),
    logo_url: photoUrl.nullable().optional(),
    country: z.string().trim().length(2).toUpperCase().nullable().optional(),
    bio: z.partialRecord(z.enum(LOCALES), z.string().trim().max(800)).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nada para alterar");

export async function getProfile(user: SessionUser) {
  return withUser(user, async (db) => {
    const r = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.locale, lp.slug, lp.sponsor_code, lp.whatsapp_e164, lp.photo_url, lp.brand_name, lp.brand_tagline, lp.logo_url, lp.country, lp.bio
         FROM users u LEFT JOIN leader_profiles lp ON lp.user_id = u.id WHERE u.id = $1`,
      [user.id],
    );
    const x = r.rows[0];
    if (!x) throw notFound();
    return {
      user: { id: x.id, email: x.email, name: x.name, role: x.role, locale: x.locale },
      profile: x.slug
        ? {
            slug: x.slug,
            sponsor_code: x.sponsor_code,
            whatsapp_e164: x.whatsapp_e164,
            photo_url: x.photo_url,
            brand_name: x.brand_name,
            brand_tagline: x.brand_tagline ?? {},
            logo_url: x.logo_url,
            country: x.country,
            bio: x.bio ?? {},
          }
        : null,
    };
  });
}

export async function updateProfile(user: SessionUser, body: z.infer<typeof profileSchema>) {
  let whatsapp: string | null | undefined;
  if (body.whatsapp !== undefined) {
    whatsapp = body.whatsapp ? toE164(body.whatsapp) : null;
    if (body.whatsapp && !whatsapp) throw new HttpError(400, "invalid_whatsapp", "WhatsApp inválido: use o formato internacional (+351...)");
  }
  await withUser(user, async (db) => {
    if (body.name !== undefined || body.locale !== undefined) {
      await db.query(`UPDATE users SET name = coalesce($2, name), locale = coalesce($3, locale) WHERE id = $1`, [user.id, body.name ?? null, body.locale ?? null]);
    }
    const profileTouched = [whatsapp, body.sponsor_code, body.photo_url, body.brand_name, body.brand_tagline, body.logo_url, body.country, body.bio].some((v) => v !== undefined);
    if (profileTouched) {
      const sets: string[] = [];
      const params: unknown[] = [user.id];
      const add = (col: string, v: unknown, cast = "") => {
        params.push(v);
        sets.push(`${col} = $${params.length}${cast}`);
      };
      if (whatsapp !== undefined) add("whatsapp_e164", whatsapp);
      if (body.sponsor_code !== undefined) add("sponsor_code", body.sponsor_code || null);
      if (body.photo_url !== undefined) add("photo_url", body.photo_url);
      if (body.brand_name !== undefined) add("brand_name", body.brand_name);
      if (body.brand_tagline !== undefined) {
        params.push(JSON.stringify(body.brand_tagline));
        sets.push(`brand_tagline = brand_tagline || $${params.length}::jsonb`);
      }
      if (body.logo_url !== undefined) add("logo_url", body.logo_url);
      if (body.country !== undefined) add("country", body.country);
      if (body.bio !== undefined) {
        params.push(JSON.stringify(body.bio));
        sets.push(`bio = bio || $${params.length}::jsonb`);
      }
      const r = await db.query(`UPDATE leader_profiles SET ${sets.join(", ")} WHERE user_id = $1`, params);
      if (!r.rowCount) throw new HttpError(400, "no_leader_profile", "Esta conta não tem perfil público");
    }
  });
  return getProfile(user);
}

export { isAncestorOrSelf };
