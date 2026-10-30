import IORedis from "ioredis";

const g = globalThis as unknown as { __rl?: IORedis };

function redis(): IORedis {
  g.__rl ??= new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 2, lazyConnect: false });
  return g.__rl;
}

/** Janela fixa: devolve true se ainda está dentro do limite. Redis em baixo → deixa passar (o honeypot continua). */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const n = await redis().incr(k);
    if (n === 1) await redis().expire(k, windowSec);
    return n <= limit;
  } catch (err) {
    console.error("[ratelimit] redis indisponível", err);
    return true;
  }
}
