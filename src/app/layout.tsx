import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { headers } from "next/headers";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import { pickLocale } from "@/core/locale";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});

export const metadata: Metadata = {
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const lang = pickLocale(requestHeaders.get("accept-language"));

  return (
    <html lang={lang} className={`${figtree.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
