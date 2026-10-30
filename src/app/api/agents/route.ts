import { json, route } from "@/core/http";
import { authed } from "@/modules/crm/api";
import { listAgents } from "@/modules/crm/settings";

export const GET = route(async () => json(await listAgents(await authed("agents.read"))));
