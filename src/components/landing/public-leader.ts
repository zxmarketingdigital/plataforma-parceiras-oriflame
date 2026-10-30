import "server-only";
import { cache } from "react";
import { brandVars, resolvePublicBrand } from "@/core/brand";
import { fill, getCopy, isLocale } from "@/core/i18n";
import { withSystem } from "@/core/db/client";

export type PublicLeader = {
  name: string;
  slug: string | null;
  photo_url: string | null;
  brand_name: string;
  brand_tagline: string;
  logo_url: string | null;
  whatsapp_e164: string | null;
  bio: string | null;
  country: string | null;
};

type LeaderRow = Omit<PublicLeader, "bio" | "brand_name" | "brand_tagline" | "logo_url"> & {
  bio: unknown;
  brand_name: unknown;
  brand_tagline: unknown;
  logo_url: unknown;
};
type BioByLocale = Partial<Record<"pt" | "es" | "en" | "fr", unknown>>;

const PUBLIC_SLUG = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveBio(value: unknown, lang: string): string {
  const requested = isLocale(lang) ? lang : "pt";
  const bio = value && typeof value === "object" && !Array.isArray(value) ? (value as BioByLocale) : undefined;

  return (
    asNullableString(bio?.[requested]) ??
    getCopy(requested).lp.lider.fallback_bio
  );
}

function toPublicLeader(row: LeaderRow, lang: string): PublicLeader | null {
  const name = asNullableString(row.name);
  if (!name) return null;
  const brand = resolvePublicBrand(row, lang, getCopy(lang).brand.tagline);

  return {
    name,
    slug: asNullableString(row.slug),
    photo_url: asNullableString(row.photo_url),
    brand_name: brand.brand_name,
    brand_tagline: brand.brand_tagline,
    logo_url: brand.logo_url,
    whatsapp_e164: asNullableString(row.whatsapp_e164),
    bio: fill(resolveBio(row.bio, lang), brandVars(name, row.brand_name)),
    country: asNullableString(row.country),
  };
}

/**
 * Perfil mínimo que pode chegar à LP pública. A consulta nunca seleciona IDs,
 * credenciais, hierarquia, organização ou campos de sessão.
 */
export const getPublicLeader = cache(async (lang: string, slug?: string): Promise<PublicLeader | null> => {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (slug !== undefined && (!normalizedSlug || !PUBLIC_SLUG.test(normalizedSlug))) return null;

  const row = await withSystem(async (db) => {
    if (normalizedSlug) {
      const result = await db.query<LeaderRow>(
        `SELECT u.name, lp.slug, lp.photo_url, lp.brand_name, lp.brand_tagline, lp.logo_url, lp.whatsapp_e164, lp.bio, lp.country
           FROM users AS u
           INNER JOIN leader_profiles AS lp ON lp.user_id = u.id
          WHERE u.active = TRUE AND lower(lp.slug) = lower($1)
          LIMIT 1`,
        [normalizedSlug],
      );
      return result.rows[0] ?? null;
    }

    const result = await db.query<LeaderRow>(
      `SELECT u.name, lp.slug, lp.photo_url, lp.brand_name, lp.brand_tagline, lp.logo_url, lp.whatsapp_e164, lp.bio, lp.country
         FROM users AS u
         LEFT JOIN leader_profiles AS lp ON lp.user_id = u.id
        WHERE u.active = TRUE AND u.role = $1
        ORDER BY u.created_at ASC
        LIMIT 1`,
      ["owner"],
    );
    return result.rows[0] ?? null;
  });

  return row ? toPublicLeader(row, lang) : null;
});
