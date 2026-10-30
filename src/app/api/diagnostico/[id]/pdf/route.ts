import { route } from "@/core/http";
import { HttpError } from "@/core/permissions";
import { uuidParam } from "@/modules/crm/common";
import { readPdf } from "@/modules/diagnostico/service";

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidParam((await params).id);
  const token = new URL(req.url).searchParams.get("token");
  if (!token) throw new HttpError(404, "not_found", "Não encontrado");
  const pdf = await readPdf(id, token);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="diagnostico-${id.slice(0, 8)}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
});
