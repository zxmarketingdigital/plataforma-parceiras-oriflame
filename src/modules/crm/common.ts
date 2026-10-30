import { HttpError } from "@/core/permissions";

// Utilitários puros do módulo CRM (sem next/headers: importáveis em testes e scripts).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Id de rota inválido responde 404 (nunca deixa o Postgres falhar com 22P02). */
export function uuidParam(v: string): string {
  if (!isUuid(v)) throw new HttpError(404, "not_found", "Não encontrado");
  return v;
}

export const notFound = () => new HttpError(404, "not_found", "Não encontrado");
export const forbidden = () => new HttpError(403, "forbidden", "Sem permissão");

/** Segmento de URL de um líder: minúsculas, dígitos e hífens. Os reservados colidem com rotas `/[lang]/<x>`. */
export const RESERVED_SLUGS = ["diagnostico", "painel", "api", "convite", "admin", "login", "privacidade", "legal", "static", "assets", "avatars", "_next"];
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
