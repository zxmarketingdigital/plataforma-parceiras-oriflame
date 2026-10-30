import { json, route } from "@/core/http";
import { HttpError } from "@/core/permissions";
import { authed } from "@/modules/crm/api";
import { getPlanSettings, putPlanSettings } from "@/modules/crm/settings";

export const GET = route(async () => json(await getPlanSettings(await authed("settings.write"))));

// Corpo = a tabela completa (mesmo formato de config/plano-oriflame.json). Inválida → 400 com o caminho do campo.
export const PUT = route(async (req: Request) => {
  const u = await authed("settings.write");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Corpo JSON inválido");
  }
  return json(await putPlanSettings(u, raw));
});
