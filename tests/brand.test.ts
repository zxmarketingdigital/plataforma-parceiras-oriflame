import { describe, expect, it } from "vitest";
import {
  fillDeep,
  resolveBrandName,
  resolveBrandTagline,
  resolveLogoUrl,
  resolvePublicBrand,
} from "@/core/brand";
import { withLeader } from "@/components/landing/types";
import type { PublicLeader } from "@/components/landing/public-leader";

describe("marca pública da líder", () => {
  it("usa a marca preenchida e o nome quando a marca está vazia", () => {
    expect(resolveBrandName("Ana", "Casa Ana")).toBe("Casa Ana");
    for (const value of ["", "   ", 42, null, undefined, [], {}]) expect(resolveBrandName("Ana", value)).toBe("Ana");
  });

  it("resolve o slogan no idioma pedido e recua para o default", () => {
    const taglines = { pt: "Pele ao teu ritmo.", en: "Skincare at your pace." };
    expect(resolveBrandTagline(taglines, "pt", "Default")).toBe("Pele ao teu ritmo.");
    expect(resolveBrandTagline(taglines, "es", "Default")).toBe("Default");
    expect(resolveBrandTagline({ pt: "   " }, "pt", "Default")).toBe("Default");
    expect(resolveBrandTagline("não é jsonb", "pt", "Default")).toBe("Default");
    expect(resolveBrandTagline(["Pele"], "pt", "Default")).toBe("Default");
    expect(resolveBrandTagline(taglines, "de", "Default")).toBe("Default");
  });

  it.each([
    ["https://example.com/logo.svg", "https://example.com/logo.svg"],
    ["/avatars/ana.svg", "/avatars/ana.svg"],
    ["http://example.com/logo.svg", null],
    ["javascript:alert(1)", null],
    ["//example.com/logo.svg", null],
    ["https://example.com/logo file.svg", null],
    ["/avatars/../ana.svg", null],
    ["x".repeat(501), null],
    ["", null],
    [42, null],
  ])("aceita ou rejeita o logótipo %j", (value, expected) => {
    expect(resolveLogoUrl(value)).toBe(expected);
  });

  it("resolve os três campos públicos juntos", () => {
    expect(resolvePublicBrand({ name: "Ana", brand_name: "Casa Ana", brand_tagline: { es: "Cuidado consciente." }, logo_url: "/logos/ana.svg" }, "es", "Default")).toEqual({
      brand_name: "Casa Ana",
      brand_tagline: "Cuidado consciente.",
      logo_url: "/logos/ana.svg",
    });
    expect(resolvePublicBrand({ name: "Ana", brand_name: " ", brand_tagline: {}, logo_url: "http://bad" }, "pt", "Default")).toEqual({
      brand_name: "Ana",
      brand_tagline: "Default",
      logo_url: null,
    });
  });

  it("preenche strings, listas e objetos sem reexpandir o valor da marca", () => {
    const input = { title: "{brand_name}", list: ["{leader_name}", { nested: "{currency}" }], untouched: 7 };
    expect(fillDeep(input, { brand_name: "Casa {currency}", leader_name: "Ana" })).toEqual({
      title: "Casa {currency}",
      list: ["Ana", { nested: "{currency}" }],
      untouched: 7,
    });
  });

  it("mantém o nome da líder e usa a marca no caminho completo withLeader", () => {
    const leader: PublicLeader = {
      name: "Ana Norte",
      slug: "ana-norte",
      photo_url: null,
      brand_name: "Casa Ana",
      brand_tagline: "Cuidado consciente.",
      logo_url: null,
      whatsapp_e164: null,
      bio: null,
      country: "PT",
    };
    expect(withLeader("{brand_name} acompanha {leader_name}.", leader)).toBe("Casa Ana acompanha Ana Norte.");
    expect(withLeader("{brand_name} acompanha {leader_name}.", { ...leader, brand_name: "Ana Norte" })).toBe("Ana Norte acompanha Ana Norte.");
  });
});
