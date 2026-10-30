import { route } from "@/core/http";
import { authed } from "@/modules/crm/api";
import { exportLeadsCsv, parseLeadFilters } from "@/modules/crm/leads";

// Mesmos filtros da listagem, sem paginação; sempre limitado à subárvore de quem pede.
export const GET = route(async (req: Request) => {
  const u = await authed("leads.export");
  const csv = await exportLeadsCsv(u, parseLeadFilters(new URL(req.url).searchParams));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
});
