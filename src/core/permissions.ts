import type { SessionUser } from "./db/client";

// Regras da app (o RLS repete a regra de visibilidade no Postgres).
export type Permission =
  | "leads.read" | "leads.write" | "leads.delete" | "leads.export"
  | "team.read" | "team.invite" | "team.deactivate"
  | "settings.write" | "agents.read";

const BY_ROLE: Record<SessionUser["role"], Permission[]> = {
  owner: ["leads.read", "leads.write", "leads.delete", "leads.export", "team.read", "team.invite", "team.deactivate", "settings.write", "agents.read"],
  leader: ["leads.read", "leads.write", "leads.delete", "leads.export", "team.read", "team.invite", "team.deactivate", "agents.read"],
  assistant: ["leads.read", "leads.write"],
};

export function permissionsOf(user: SessionUser): Permission[] {
  return BY_ROLE[user.role];
}

export function can(user: SessionUser, p: Permission): boolean {
  return BY_ROLE[user.role].includes(p);
}

/** `ancestor` está acima de (ou é) `descendant` na árvore? Paths ltree como texto: "root.a.b". */
export function isAncestorOrSelf(ancestorPath: string, descendantPath: string): boolean {
  return descendantPath === ancestorPath || descendantPath.startsWith(ancestorPath + ".");
}

/**
 * Mudar o dono de um lead: só quem está acima do dono atual (upline estrita) e só para alguém da própria subárvore.
 * O owner é a raiz, logo pode sempre (exceto reatribuir a partir de si próprio para fora da árvore, que não existe).
 */
export function canReassign(actor: SessionUser, currentOwnerPath: string, newOwnerPath: string): boolean {
  if (!can(actor, "leads.write") || actor.role === "assistant") return false;
  const aboveCurrent = actor.role === "owner" ? isAncestorOrSelf(actor.path, currentOwnerPath) : isAncestorOrSelf(actor.path, currentOwnerPath) && actor.path !== currentOwnerPath;
  return aboveCurrent && isAncestorOrSelf(actor.path, newOwnerPath);
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export function requireUser(user: SessionUser | null, p?: Permission): SessionUser {
  if (!user) throw new HttpError(401, "unauthorized");
  if (p && !can(user, p)) throw new HttpError(403, "forbidden");
  return user;
}
