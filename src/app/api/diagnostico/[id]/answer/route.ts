import { json, route } from "@/core/http";
import { uuidParam } from "@/modules/crm/common";
import { answerDiagnostic } from "@/modules/diagnostico/service";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidParam((await params).id);
  return json(await answerDiagnostic(id, await req.json().catch(() => null)));
});
