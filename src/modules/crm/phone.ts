import { parsePhoneNumberFromString } from "libphonenumber-js";

/** WhatsApp internacional → E.164 (`+351...`). Exige o prefixo do país (+ ou 00); nunca assume DDD nem país. null se inválido. */
export function toE164(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "").replace(/^00/, "+");
  if (!raw.startsWith("+")) return null;
  const p = parsePhoneNumberFromString(raw);
  return p && p.isPossible() ? p.number : null;
}
