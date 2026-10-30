import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { getProfile, profileSchema, updateProfile } from "@/modules/crm/team";

export const GET = route(async () => json(await getProfile(await authed())));

export const PATCH = route(async (req: Request) => {
  const u = await authed();
  return json(await updateProfile(u, await readBody(req, profileSchema)));
});
