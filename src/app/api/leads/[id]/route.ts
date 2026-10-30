import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { uuidParam } from "@/modules/crm/common";
import { deleteLead, getLead, patchLead, patchLeadSchema } from "@/modules/crm/leads";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const u = await authed("leads.read");
  return json(await getLead(u, uuidParam((await params).id)));
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const u = await authed("leads.write");
  const body = await readBody(req, patchLeadSchema);
  return json(await patchLead(u, uuidParam((await params).id), body));
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const u = await authed("leads.delete");
  return json(await deleteLead(u, uuidParam((await params).id)));
});
