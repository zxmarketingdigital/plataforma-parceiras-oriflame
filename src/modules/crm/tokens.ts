import { createHash, randomBytes } from "node:crypto";

// Mesmo algoritmo de src/core/auth/session.ts (sha256 hex), sem importar next/headers: usável em testes e scripts.
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
