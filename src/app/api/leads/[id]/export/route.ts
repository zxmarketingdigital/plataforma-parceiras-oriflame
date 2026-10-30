import { route } from "@/core/http";
import { authed } from "@/modules/crm/api";
import { uuidParam } from "@/modules/crm/common";
import { exportLead } from "@/modules/crm/leads";

// RGPD: tudo o que existe sobre o contacto, como ficheiro JSON.
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await authed("leads.export");
  const id = uuidParam((await params).id);
  const data = await exportLead(u, id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="contacto-${id}.json"`,
      "cache-control": "no-store",
    },
  });
});
