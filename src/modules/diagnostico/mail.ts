// E-mail do relatório: assunto e corpo vêm de report_fallback.email (na língua do diagnóstico), PDF em anexo.
import nodemailer, { type Transporter } from "nodemailer";
import { fill, getCopy } from "@/core/i18n";
import type { WorkerContext } from "./service";

const g = globalThis as unknown as { __mailer?: Transporter };

function transporter(): Transporter {
  const url = process.env.SMTP_URL;
  if (!url) throw new Error("SMTP_URL em falta");
  g.__mailer ??= nodemailer.createTransport(url);
  return g.__mailer;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Envia o relatório para o e-mail do contacto. Lança se não houver e-mail, SMTP_URL ou MAIL_FROM. */
export async function sendReportEmail(ctx: WorkerContext, pdf: Buffer): Promise<void> {
  if (!ctx.contactEmail) throw new Error("contacto sem e-mail");
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM em falta");
  const copy = getCopy(ctx.lang);
  const vars = { name: firstName(ctx.contactName), leader_name: ctx.leader.name?.trim() || copy.brand.name };
  await transporter().sendMail({
    from,
    to: ctx.contactEmail,
    subject: fill(copy.report_fallback.email.subject, vars),
    text: fill(copy.report_fallback.email.body, vars),
    attachments: [{ filename: `${copy.brand.name.replace(/[^\p{L}\p{N}]+/gu, "-")}-${ctx.id.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
}
