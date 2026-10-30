import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Segredos guardados em `settings` (chave Anthropic, palavra-passe SMTP): AES-256-GCM com chave derivada de APP_SECRET.
// Formato: "v1.<iv>.<tag>.<cifra>" em base64url. Nunca devolver o valor decifrado por API.

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) throw new Error("APP_SECRET em falta ou curto demais (mínimo 16 caracteres)");
  return createHash("sha256").update(`plataforma-parceiras:settings:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

/** Decifra um valor produzido por encryptSecret. Lança se estiver adulterado ou se APP_SECRET mudou. */
export function decryptSecret(payload: string): string {
  const [v, iv, tag, enc] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("segredo cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
}
