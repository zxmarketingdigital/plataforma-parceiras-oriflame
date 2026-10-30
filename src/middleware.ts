import { NextResponse, type NextRequest } from "next/server";
import { isLocale, pickLocale } from "@/core/locale";

// "/" → /<idioma>; /painel/* sem cookie → login. A sessão é validada a sério no layout do painel (Node).
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/") {
    const lang = pickLocale(req.headers.get("accept-language"));
    return NextResponse.redirect(new URL(`/${lang}${search}`, req.url));
  }
  if (pathname.startsWith("/painel") && pathname !== "/painel/login" && !req.cookies.get("sid")) {
    return NextResponse.redirect(new URL("/painel/login", req.url));
  }
  const first = pathname.split("/")[1];
  const res = NextResponse.next();
  if (isLocale(first)) res.headers.set("content-language", first);
  return res;
}

export const config = { matcher: ["/", "/painel/:path*", "/(pt|es|en|fr)/:path*"] };
