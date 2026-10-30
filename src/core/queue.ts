import { Queue } from "bullmq";

// Filas do worker. Jobs pequenos e idempotentes por jobId (diagnosticId), para reentregas não duplicarem.
export const QUEUES = { agent: "agent", pdf: "pdf", email: "email" } as const;

export function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const g = globalThis as unknown as { __queues?: Record<string, Queue> };
g.__queues ??= {};

export function queue(name: keyof typeof QUEUES): Queue {
  g.__queues![name] ??= new Queue(QUEUES[name], {
    connection: redisConnection(),
    defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 500, removeOnFail: 1000 },
  });
  return g.__queues![name];
}

/**
 * Enfileira com jobId = diagnosticId. Um job antigo com o mesmo id já concluído ou falhado
 * (retido por removeOnComplete/removeOnFail) faria o BullMQ ignorar o novo: esse é removido antes.
 * Jobs à espera ou ativos ficam como estão (o add é ignorado, o que é o desejado).
 */
export async function addFresh(name: keyof typeof QUEUES, jobName: string, diagnosticId: string): Promise<void> {
  const q = queue(name);
  const old = await q.getJob(diagnosticId);
  if (old && ((await old.isCompleted()) || (await old.isFailed()))) await old.remove();
  await q.add(jobName, { diagnosticId }, { jobId: diagnosticId });
}
