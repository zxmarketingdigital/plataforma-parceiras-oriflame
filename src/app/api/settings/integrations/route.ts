import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { getIntegrations, integrationsPutSchema, putIntegrations } from "@/modules/crm/settings";

// A chave de IA e a palavra-passe SMTP entram cifradas e nunca voltam: só "configurada: sim/não".
export const GET = route(async () => json(await getIntegrations(await authed("settings.write"))));

export const PUT = route(async (req: Request) => {
  const u = await authed("settings.write");
  return json(await putIntegrations(u, await readBody(req, integrationsPutSchema)));
});
