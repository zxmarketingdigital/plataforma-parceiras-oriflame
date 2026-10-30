import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { copyPutSchema, getCopySettings, putCopySettings } from "@/modules/crm/settings";

export const GET = route(async () => json(await getCopySettings(await authed("settings.write"))));

export const PUT = route(async (req: Request) => {
  const u = await authed("settings.write");
  return json(await putCopySettings(u, await readBody(req, copyPutSchema)));
});
