import { json, route } from "@/core/http";
import { authed } from "@/modules/crm/api";
import { getTeam } from "@/modules/crm/team";

export const GET = route(async () => {
  const u = await authed("team.read");
  return json(await getTeam(u));
});
