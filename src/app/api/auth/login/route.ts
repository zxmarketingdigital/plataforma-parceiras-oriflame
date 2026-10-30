import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, sessionCookieOptions, SESSION_COOKIE, verifyLogin } from "@/core/auth/session";
import { clientIp, json, route } from "@/core/http";
import { rateLimit } from "@/core/ratelimit";
import { readBody } from "@/modules/crm/api";

const bodySchema = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200) }).strict();

// Tentativas por janela. Variáveis de ambiente afinam sem mexer no código.
const WINDOW_SEC = Number(process.env.LOGIN_WINDOW_SEC) > 0 ? Number(process.env.LOGIN_WINDOW_SEC) : 600;
const PER_IP_EMAIL = Number(process.env.LOGIN_MAX_PER_IP_EMAIL) > 0 ? Number(process.env.LOGIN_MAX_PER_IP_EMAIL) : 8;
const PER_IP = Number(process.env.LOGIN_MAX_PER_IP) > 0 ? Number(process.env.LOGIN_MAX_PER_IP) : 30;

export const POST = route(async (req: Request) => {
  const { email, password } = await readBody(req, bodySchema);
  const ip = clientIp(req);
  const okPair = await rateLimit(`login:${ip}:${email.toLowerCase()}`, PER_IP_EMAIL, WINDOW_SEC);
  const okIp = await rateLimit(`login-ip:${ip}`, PER_IP, WINDOW_SEC);
  if (!okPair || !okIp) return json({ error: { code: "rate_limited", message: "Demasiadas tentativas. Tente mais tarde." } }, 429);

  const user = await verifyLogin(email, password);
  // Mesma resposta para e-mail inexistente, senha errada e conta desativada.
  if (!user) return json({ error: { code: "invalid_credentials", message: "E-mail ou senha incorretos" } }, 401);

  const token = await createSession(user.id);
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, locale: user.locale } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
