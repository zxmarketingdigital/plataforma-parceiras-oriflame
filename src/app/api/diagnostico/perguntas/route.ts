import { json, route } from "@/core/http";
import { isLocale } from "@/core/locale";
import { listQuestions } from "@/modules/diagnostico/service";

export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  const raw = url.searchParams.get("lang") ?? "pt";
  return json(listQuestions(isLocale(raw) ? raw : "pt", url.searchParams.get("country")));
});
