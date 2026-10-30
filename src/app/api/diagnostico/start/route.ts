import { clientIp, json, route } from "@/core/http";
import { HttpError } from "@/core/permissions";
import { rateLimit } from "@/core/ratelimit";
import { fakeStartResult, startDiagnostic } from "@/modules/diagnostico/service";

// PLAN.md: 10 pedidos por minuto por IP no início do diagnóstico.
const START_LIMIT = 10;
const START_WINDOW_SEC = 60;

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  if (!(await rateLimit(`diag-start:${ip}`, START_LIMIT, START_WINDOW_SEC))) throw new HttpError(429, "rate_limited", "Demasiados pedidos");
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "invalid", "Dados inválidos");
  // Campo armadilha: um robô preenche, uma pessoa não o vê. Resposta normal, nada gravado.
  const trap = (body as { website?: unknown }).website;
  if (typeof trap === "string" && trap.trim() !== "") return json(fakeStartResult(), 201);
  return json(await startDiagnostic(body, { ip }), 201);
});
