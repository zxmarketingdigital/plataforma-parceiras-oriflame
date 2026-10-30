import { z } from "zod";
import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { listLeads, parseLeadFilters } from "@/modules/crm/leads";

const filterValue = z.union([z.string().max(200), z.number()]).optional();
const searchSchema = z.object({ stage: filterValue, owner: filterValue, country: filterValue, locale: filterValue, q: filterValue, page: filterValue, limit: filterValue }).strict();

// Pesquisa por POST: o termo livre (e-mail, telefone, nome) vai no corpo, nunca na URL, para não cair em logs de acesso.
export const POST = route(async (req: Request) => {
  const u = await authed("leads.read");
  const body = await readBody(req, searchSchema);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) if (v !== undefined) params.set(k, String(v));
  return json(await listLeads(u, parseLeadFilters(params)));
});
