import { z } from "zod";
import { currentUser, type AuthUser } from "@/core/auth/session";
import { HttpError, requireUser, type Permission } from "@/core/permissions";

export { clientIp } from "@/core/http";

/** Utilizador da sessão (cookie `sid`) com a permissão pedida, ou 401/403. Só para rotas. */
export async function authed(perm?: Permission): Promise<AuthUser> {
  return requireUser(await currentUser(), perm) as AuthUser;
}

/** Lê e valida o corpo JSON. Corpo ausente ou malformado → 400. */
export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Corpo JSON inválido");
  }
  return schema.parse(raw);
}
