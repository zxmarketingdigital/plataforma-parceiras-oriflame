import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingPage } from "@/components/landing/LandingPage";
import type { PublicLeader } from "@/components/landing/public-leader";
import { getCopy, LOCALES, type Copy } from "@/core/i18n";

const PLACEHOLDERS = /\{(?:brand_name|leader_name)\}/;
const MARKER = " [{brand_name}|{leader_name}]";

const leader: PublicLeader = {
  name: "Marta Silva",
  slug: "marta",
  photo_url: null,
  brand_name: "Marta Cuida",
  brand_tagline: "Pele ao seu ritmo",
  logo_url: null,
  whatsapp_e164: "+351910000000",
  bio: null,
  country: "PT",
};

/** Chaves que são identificadores/numeração (data-path, key do React, "01"), não texto público. */
const IDENTIFIER_KEYS = new Set(["id", "key", "n"]);

/** Acrescenta os dois placeholders a TODA a string de texto da copy pública, para provar que nenhuma fica sem preencher. */
function seeded<T>(value: T, key = ""): T {
  if (typeof value === "string") return (IDENTIFIER_KEYS.has(key) ? value : value + MARKER) as T;
  if (Array.isArray(value)) return value.map((v) => seeded(v, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, seeded(v, k)])) as T;
  }
  return value;
}

function render(copy: Copy, lang: (typeof LOCALES)[number], who: PublicLeader): string {
  return renderToStaticMarkup(
    createElement(LandingPage, { copy, lang, leader: who, diagnosticHref: `/${lang}/diagnostico?lider=marta`, tracking: {} }),
  );
}

describe("página pública da líder: {brand_name} e {leader_name} preenchidos em todo o lado", () => {
  it.each([...LOCALES])("não deixa placeholder literal (%s), com copy real e com placeholders em cada texto", (lang) => {
    const real = getCopy(lang);
    expect(render(real, lang, leader)).not.toMatch(PLACEHOLDERS);

    const copy = { ...real, lp: seeded(real.lp), brand: seeded(real.brand) } as Copy;
    const html = render(copy, lang, leader);
    expect(html).not.toMatch(PLACEHOLDERS);
    expect(html).toContain("[Marta Cuida|Marta Silva]");
  });

  it("sem marca própria, {brand_name} recua para o nome da líder", () => {
    const html = render({ ...getCopy("pt"), lp: seeded(getCopy("pt").lp) } as Copy, "pt", { ...leader, brand_name: leader.name });
    expect(html).not.toMatch(PLACEHOLDERS);
    expect(html).toContain("[Marta Silva|Marta Silva]");
  });

  it("o cabeçalho mostra a marca e o slogan da líder, não os da plataforma", () => {
    const html = render(getCopy("pt"), "pt", leader);
    expect(html).toContain("Marta Cuida");
    expect(html).toContain("Pele ao seu ritmo");
  });
});
