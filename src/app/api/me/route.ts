import { json, route } from "@/core/http";
import { permissionsOf } from "@/core/permissions";
import { authed } from "@/modules/crm/api";
import { getOrgInfo } from "@/modules/crm/settings";
import { getProfile } from "@/modules/crm/team";

export const GET = route(async () => {
  const u = await authed();
  const [{ user, profile }, info] = await Promise.all([getProfile(u), getOrgInfo(u)]);
  return json({ user, profile, permissions: permissionsOf(u), ...info });
});
