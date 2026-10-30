import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { headers } from "next/headers";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import { pickLocale } from "@/core/locale";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const lang = pickLocale(requestHeaders.get("accept-language"));

  return (
    <html lang={lang} className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
