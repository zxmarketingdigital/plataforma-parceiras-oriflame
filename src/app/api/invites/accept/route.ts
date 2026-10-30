import { NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookieOptions, SESSION_COOKIE } from "@/core/auth/session";
import { clientIp, json, route } from "@/core/http";
import { rateLimit } from "@/core/ratelimit";
import { readBody } from "@/modules/crm/api";
import { acceptInvite, acceptSchema } from "@/modules/crm/team";

// Público: o convite é a credencial. Cria a conta e inicia sessão.
export const POST = route(async (req: Request) => {
  if (!(await rateLimit(`invite-accept:${clientIp(req)}`, 20, 600))) {
    return json({ error: { code: "rate_limited", message: "Demasiadas tentativas. Tente mais tarde." } }, 429);
  }
  const body = await readBody(req, acceptSchema);
  const created = await acceptInvite(body, await hashPassword(body.password));
  const token = await createSession(created.id);
  const res = NextResponse.json({ user: { id: created.id, email: created.email, name: created.name, role: created.role } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
