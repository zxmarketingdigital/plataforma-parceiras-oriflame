import { json, route } from "@/core/http";
import { authed } from "@/modules/crm/api";
import { listLeads, parseLeadFilters } from "@/modules/crm/leads";

export const GET = route(async (req: Request) => {
  const u = await authed("leads.read");
  return json(await listLeads(u, parseLeadFilters(new URL(req.url).searchParams)));
});
