// Worker BullMQ do Diagnóstico: agent → pdf → email. Cada fila é idempotente (jobId = diagnosticId),
// por isso reentregas e repetições não duplicam PDF nem e-mail.
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import { pool, withSystem } from "@/core/db/client";
import { QUEUES, addFresh, redisConnection } from "@/core/queue";
import { sendReportEmail } from "@/modules/diagnostico/mail";
import { renderReportPdf } from "@/modules/diagnostico/pdf";
import { loadReportContext, pdfDir, pdfFilePath, type WorkerContext } from "@/modules/diagnostico/service";

type DiagJob = { diagnosticId: string };

function log(name: string, job: Job<DiagJob>, msg: string): void {
  console.log(`[worker:${name}] ${job.data.diagnosticId} ${msg}`);
}

/** Corre o job e regista quanto demorou, mesmo quando falha. */
async function timed(name: string, job: Job<DiagJob>, fn: () => Promise<string>): Promise<void> {
  const t0 = performance.now();
  try {
    const outcome = await fn();
    log(name, job, `${outcome} (${Math.round(performance.now() - t0)} ms)`);
  } catch (err) {
    log(name, job, `falhou após ${Math.round(performance.now() - t0)} ms (tentativa ${job.attemptsMade + 1}): ${(err as Error).message}`);
    throw err;
  }
}

async function loadConcluded(diagnosticId: string): Promise<WorkerContext | null> {
  const ctx = await withSystem((db) => loadReportContext(db, diagnosticId));
  if (!ctx || ctx.status !== "concluido") return null;
  return ctx;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- agent

async function handleAgent(job: Job<DiagJob>): Promise<string> {
  const { diagnosticId } = job.data;
  const ctx = await loadConcluded(diagnosticId);
  if (!ctx) return "diagnóstico inexistente ou não concluído, nada a fazer";
  await addFresh("pdf", "pdf", diagnosticId);
  return "pdf enfileirado";
}

// ---------------------------------------------------------------- pdf

async function handlePdf(job: Job<DiagJob>): Promise<string> {
  const { diagnosticId } = job.data;
  const ctx = await loadConcluded(diagnosticId);
  if (!ctx) return "diagnóstico inexistente ou não concluído, nada a fazer";

  let outcome = "pdf já existia";
  const fileName = `${diagnosticId}.pdf`;
  if (!ctx.pdfPath && (await fileExists(pdfFilePath(fileName)))) {
    // Corrida anterior escreveu o ficheiro mas não gravou o caminho: grava só o caminho, sem gerar de novo.
    await withSystem((db) => db.query("UPDATE diagnostics SET pdf_path = $2 WHERE id = $1 AND pdf_path IS NULL", [diagnosticId, fileName]));
    outcome = "pdf já estava no disco, caminho gravado";
  } else if (!(ctx.pdfPath && (await fileExists(pdfFilePath(ctx.pdfPath))))) {
    const pdf = await renderReportPdf(ctx);
    await mkdir(pdfDir(), { recursive: true });
    // Escrita atómica: quem lê (download) nunca apanha um ficheiro a meio.
    const tmp = path.join(pdfDir(), `${fileName}.${process.pid}.tmp`);
    await writeFile(tmp, pdf);
    await rename(tmp, pdfFilePath(fileName));
    await withSystem(async (db) => {
      await db.query("UPDATE diagnostics SET pdf_path = $2 WHERE id = $1", [diagnosticId, fileName]);
      await db.query("INSERT INTO activities (contact_id, type, payload) VALUES ($1,'pdf',$2)", [
        ctx.contactId,
        JSON.stringify({ action: "pdf_gerado", diagnostic_id: diagnosticId, file: fileName, bytes: pdf.length }),
      ]);
    });
    outcome = `pdf gerado (${pdf.length} bytes)`;
  }

  await addFresh("email", "email", diagnosticId);
  return `${outcome}, e-mail enfileirado`;
}

// ---------------------------------------------------------------- email

async function handleEmail(job: Job<DiagJob>): Promise<string> {
  const { diagnosticId } = job.data;
  const ctx = await loadConcluded(diagnosticId);
  if (!ctx) return "diagnóstico inexistente ou não concluído, nada a fazer";
  if (!ctx.contactEmail) return "contacto sem e-mail, nada a enviar";

  // Sem PDF no disco o job falha e o BullMQ repete com backoff (o job do pdf pode ainda estar a acabar).
  if (!ctx.pdfPath) throw new Error("pdf ainda não gerado");
  const pdf = await readFile(pdfFilePath(ctx.pdfPath));

  // Reserva antes de enviar (índice único activities_report_email_once): dois jobs em corrida, só um envia.
  // Se o processo cair entre o envio e a confirmação, a reserva fica em "a_enviar" e não há segundo envio.
  const payload = { action: "relatorio_enviado", diagnostic_id: diagnosticId };
  const reserved = await withSystem((db) =>
    db.query<{ id: string }>("INSERT INTO activities (contact_id, type, payload) VALUES ($1,'email',$2) ON CONFLICT DO NOTHING RETURNING id", [
      ctx.contactId,
      JSON.stringify({ ...payload, state: "a_enviar" }),
    ]),
  );
  const reservation = reserved.rows[0]?.id;
  if (!reservation) return "e-mail já enviado (ou a enviar) por outro job, nada a fazer";

  try {
    await sendReportEmail(ctx, pdf);
  } catch (err) {
    // O SMTP recusou: liberta a reserva para o BullMQ tentar de novo.
    await withSystem((db) => db.query("DELETE FROM activities WHERE id = $1", [reservation]));
    throw err;
  }
  await withSystem((db) => db.query("UPDATE activities SET payload = $2 WHERE id = $1", [reservation, JSON.stringify({ ...payload, state: "enviado" })]));
  return "e-mail enviado";
}

// ---------------------------------------------------------------- arranque e encerramento

function start(name: keyof typeof QUEUES, handler: (job: Job<DiagJob>) => Promise<string>, concurrency: number): Worker<DiagJob> {
  const w = new Worker<DiagJob>(QUEUES[name], (job) => timed(name, job, () => handler(job)), { connection: redisConnection(), concurrency });
  w.on("error", (err) => console.error(`[worker:${name}] erro:`, err.message));
  w.on("failed", (job, err) => {
    if (job) console.error(`[worker:${name}] ${job.data.diagnosticId} job falhado: ${err.message}`);
  });
  return w;
}

const workers = [start("agent", handleAgent, 5), start("pdf", handlePdf, 2), start("email", handleEmail, 3)];
console.log(`[worker] à escuta: ${workers.map((w) => w.name).join(", ")}`);

let closing = false;
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;
  console.log(`[worker] ${signal} recebido, a encerrar`);
  const force = setTimeout(() => {
    console.error("[worker] encerramento forçado após 25 s");
    process.exit(1);
  }, 25000);
  force.unref();
  try {
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(Object.values((globalThis as unknown as { __queues?: Record<string, { close(): Promise<void> }> }).__queues ?? {}).map((q) => q.close()));
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("[worker] erro ao encerrar:", (err as Error).message);
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
