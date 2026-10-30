import { describe, expect, it } from "vitest";
import { profileSchema } from "@/modules/crm/team";

describe("profileSchema: marca da líder", () => {
  it("normaliza a marca vazia e limita a 60 caracteres", () => {
    expect(profileSchema.safeParse({ brand_name: "" }).data?.brand_name).toBeNull();
    expect(profileSchema.safeParse({ brand_name: "  Casa Ana  " }).data?.brand_name).toBe("Casa Ana");
    expect(profileSchema.safeParse({ brand_name: "a".repeat(60) }).success).toBe(true);
    expect(profileSchema.safeParse({ brand_name: "a".repeat(61) }).success).toBe(false);
    expect(profileSchema.safeParse({ brand_name: null }).success).toBe(true);
  });

  it("colapsa quebras de linha e espaços repetidos na marca e no slogan", () => {
    expect(profileSchema.safeParse({ brand_name: "Casa\r\nAna\t Norte" }).data?.brand_name).toBe("Casa Ana Norte");
    expect(profileSchema.safeParse({ brand_tagline: { pt: "Pele\n\nao  ritmo" } }).data?.brand_tagline).toEqual({ pt: "Pele ao ritmo" });
  });

  it.each([
    ["https://example.com/logo.svg", true],
    ["/avatars/ana.svg", true],
    ["http://example.com/logo.svg", false],
    ["javascript:alert(1)", false],
    ["//example.com/logo.svg", false],
    ["https://example.com/logo file.svg", false],
    ["/avatars/../ana.svg", false],
  ])("aplica ao logótipo e à foto a mesma regra para %j", (value, accepted) => {
    expect(profileSchema.safeParse({ logo_url: value }).success).toBe(accepted);
    expect(profileSchema.safeParse({ photo_url: value }).success).toBe(accepted);
  });

  it("valida o slogan por idioma e aceita o limite de 120 caracteres", () => {
    expect(profileSchema.safeParse({ brand_tagline: { pt: "a".repeat(120) } }).success).toBe(true);
    expect(profileSchema.safeParse({ brand_tagline: { pt: "a".repeat(121) } }).success).toBe(false);
    expect(profileSchema.safeParse({ brand_tagline: { de: "Deutsch" } }).success).toBe(false);
  });

  it("mantém o objeto estrito e exige pelo menos um campo", () => {
    expect(profileSchema.safeParse({}).success).toBe(false);
    expect(profileSchema.safeParse({ campo_desconhecido: true }).success).toBe(false);
  });
});
