import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { createInvite, inviteSchema, listInvites } from "@/modules/crm/team";

export const GET = route(async () => {
  const u = await authed("team.invite");
  return json(await listInvites(u));
});

// Devolve `link` uma única vez (o token não fica guardado em claro).
export const POST = route(async (req: Request) => {
  const u = await authed("team.invite");
  return json(await createInvite(u, await readBody(req, inviteSchema)), 201);
});
