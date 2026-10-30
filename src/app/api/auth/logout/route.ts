import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, sessionCookieOptions, SESSION_COOKIE } from "@/core/auth/session";
import { route } from "@/core/http";

export const POST = route(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
});
