import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./permissions";

/** Envolve um handler de rota: erros viram {error:{code,message}} com o status certo. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message } }, err.status);
      if (err instanceof ZodError) return json({ error: { code: "invalid", message: "Dados inválidos", issues: err.issues } }, 400);
      console.error("[api]", err);
      return json({ error: { code: "internal", message: "Erro interno" } }, 500);
    }
  };
}

export function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status });
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  const ip = xf ? xf.split(",")[0] : req.headers.get("x-real-ip");
  return ip?.trim() || "0.0.0.0";
}
