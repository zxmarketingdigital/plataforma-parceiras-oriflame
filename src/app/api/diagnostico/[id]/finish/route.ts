import { json, route } from "@/core/http";
import { uuidParam } from "@/modules/crm/common";
import { finishDiagnostic } from "@/modules/diagnostico/service";

// A IA tem até 20 s; a rota precisa de folga acima disso.
export const maxDuration = 60;

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidParam((await params).id);
  return json(await finishDiagnostic(id, await req.json().catch(() => null)));
});
