import { json, route } from "@/core/http";
import { authed } from "@/modules/crm/api";
import { getMetrics, metricsQuerySchema } from "@/modules/crm/metrics";

export const GET = route(async (req: Request) => {
  const u = await authed("leads.read");
  const sp = new URL(req.url).searchParams;
  const q = metricsQuerySchema.parse({ from: sp.get("from") || undefined, to: sp.get("to") || undefined });
  return json(await getMetrics(u, q));
});
