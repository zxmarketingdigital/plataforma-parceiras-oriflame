import Anthropic from "@anthropic-ai/sdk";
import { AGENTS } from "./modules";

export function agentManifest(name: string) {
  const a = AGENTS.find((x) => x.nome === name);
  if (!a) throw new Error(`agente desconhecido: ${name}`);
  return a;
}

/**
 * Uma chamada ao modelo com teto de tempo. Devolve o texto, ou null se não houver chave, der erro ou passar do tempo:
 * quem chama usa então o texto fixo do manifesto (fallback).
 */
export async function callModel(opts: { system: string; user: string; timeoutMs?: number; maxTokens?: number; apiKey?: string }): Promise<string | null> {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const timeoutMs = opts.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS || 20000);
  const t0 = Date.now();
  try {
    const client = new Anthropic({ apiKey, maxRetries: 0 });
    const msg = await client.messages.create(
      {
        model: process.env.AI_MODEL || "claude-sonnet-5-5",
        max_tokens: opts.maxTokens ?? 1500,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      },
      { timeout: timeoutMs },
    );
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    console.log(`[agent] modelo respondeu em ${Date.now() - t0} ms (teto ${timeoutMs} ms)`);
    return text || null;
  } catch (err) {
    console.error(`[agent] falhou em ${Date.now() - t0} ms (teto ${timeoutMs} ms):`, (err as Error).message);
    return null;
  }
}
