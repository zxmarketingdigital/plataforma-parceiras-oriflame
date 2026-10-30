import { json, route } from "@/core/http";
import { authed, readBody } from "@/modules/crm/api";
import { uuidParam } from "@/modules/crm/common";
import { activeSchema, setUserActive } from "@/modules/crm/team";

// Desativar sobe os leads do utilizador para a upline e emite lead.dono_alterado por lead.
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await authed("team.deactivate");
  const { active } = await readBody(req, activeSchema);
  return json(await setUserActive(u, uuidParam((await params).id), active));
});
