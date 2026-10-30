// Relatório em PDF do Diagnóstico (pdfkit, sem Chromium). Todo o texto vem da copy da língua do diagnóstico;
// os números vêm do motor (já gravados em scenarios). Fontes padrão (Helvetica, WinAnsi) cobrem PT/ES/FR/EN.
import PDFDocument from "pdfkit";
import { fill, getCopy } from "@/core/i18n";
import type { ScenarioKey } from "./engine";
import type { WorkerContext } from "./service";

const INK = "#1B1B1B";
const SAGE = "#5E7A5A";
const SAGE_SOFT = "#EEF2ED";
const MUTED = "#6B6B6B";
const LINE = "#D9DED7";
const WHITE = "#FFFFFF";

const MARGIN = 48;
const SCENARIO_ORDER: ScenarioKey[] = ["conservador", "provavel", "ambicioso"];

/** Helvetica só tem WinAnsi: espaços finos/estreitos que o Intl mete (ex.: fr) ficam como lixo, por isso viram espaço normal. */
function winAnsiSafe(text: string): string {
  return (
    text
      .replace(/[\u202f\u2009\u2007\u2008]/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[\u2010\u2011\u2212]/g, "-")
      // O visualizador (macOS/poppler) desenha o € da Helvetica mais largo do que o pdfkit mede e come o espaço seguinte
      // ("55 €por mês"). Um segundo espaço depois do € compensa; sem texto a seguir não se nota.
      .replace(/\u20ac (?=\S)/g, "\u20ac  ")
  );
}

// A copy é de Portugal (e Reino Unido para inglês): "pt" a secas daria formato do Brasil.
const INTL_LOCALE: Record<string, string> = { pt: "pt-PT", es: "es-ES", en: "en-GB", fr: "fr-FR" };

function money(value: number, currency: string, lang: string): string {
  const s = new Intl.NumberFormat(INTL_LOCALE[lang] ?? "pt-PT", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  return winAnsiSafe(s);
}

export function renderReportPdf(ctx: WorkerContext): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const copy = getCopy(ctx.lang);
      const r = copy.chat.result;
      const brand = copy.brand;
      const leaderName = ctx.leader.name?.trim() || brand.name;
      const { currency, is_example } = ctx.scenarios;

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN, bottom: 64, left: MARGIN, right: MARGIN },
        bufferPages: true,
        info: { Title: `${brand.name} · ${ctx.contactName}`, Author: brand.name },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageW = doc.page.width;
      const left = MARGIN;
      const contentW = pageW - MARGIN * 2;
      const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
      const ensure = (h: number) => {
        if (doc.y + h > bottomLimit()) doc.addPage();
      };
      const heading = (text: string) => {
        ensure(60);
        doc.moveDown(0.8);
        doc.font("Helvetica-Bold").fontSize(13).fillColor(SAGE).text(winAnsiSafe(text), left, doc.y, { width: contentW });
        const y = doc.y + 3;
        doc.moveTo(left, y).lineTo(left + contentW, y).lineWidth(0.75).strokeColor(LINE).stroke();
        doc.y = y + 8;
      };

      // ---- Cabeçalho: marca
      doc.rect(0, 0, pageW, 8).fill(SAGE);
      doc.y = MARGIN;
      doc.font("Helvetica-Bold").fontSize(20).fillColor(SAGE).text(winAnsiSafe(brand.name), left, doc.y, { width: contentW });
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(winAnsiSafe(brand.tagline), left, doc.y + 1, { width: contentW });

      // ---- Pessoa e perfil
      doc.moveDown(1.2);
      doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(winAnsiSafe(ctx.contactName), left, doc.y, { width: contentW });
      doc.font("Helvetica").fontSize(12).fillColor(SAGE).text(winAnsiSafe(copy.report_fallback.perfis[ctx.profile].label), left, doc.y + 2, { width: contentW });
      doc.moveDown(0.8);
      doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(winAnsiSafe(r.intro), left, doc.y, { width: contentW });

      // ---- Cenários (o provável em destaque)
      doc.moveDown(0.8);
      const gap = 10;
      const cardW = (contentW - gap * 2) / 3;
      const cardH = 150;
      ensure(cardH + 10);
      const top = doc.y;
      SCENARIO_ORDER.forEach((key, i) => {
        const sc = ctx.scenarios[key];
        const x = left + i * (cardW + gap);
        const hi = key === "provavel";
        const fg = hi ? WHITE : INK;
        const sub = hi ? "#E3EBE1" : MUTED;
        doc.save();
        if (hi) doc.roundedRect(x, top, cardW, cardH, 6).fill(SAGE);
        else doc.roundedRect(x, top, cardW, cardH, 6).lineWidth(1).fillAndStroke(SAGE_SOFT, LINE);
        doc.restore();
        const pad = 10;
        const w = cardW - pad * 2;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(hi ? WHITE : SAGE).text(winAnsiSafe(r.scenarios[key]).toUpperCase(), x + pad, top + 12, { width: w });
        doc.font("Helvetica-Bold").fontSize(20).fillColor(fg).text(money(sc.avg_monthly, currency, ctx.lang), x + pad, top + 32, { width: w });
        doc.font("Helvetica").fontSize(8.5).fillColor(sub).text(winAnsiSafe(`${r.per_month} · ${r.avg_label}`), x + pad, doc.y + 1, { width: w });
        doc.font("Helvetica").fontSize(8.5).fillColor(sub).text(winAnsiSafe(r.month12_label), x + pad, top + 92, { width: w });
        doc.font("Helvetica-Bold").fontSize(13).fillColor(fg).text(winAnsiSafe(`${money(sc.month12, currency, ctx.lang)} ${r.per_month}`), x + pad, doc.y + 1, { width: w });
        doc.font("Helvetica").fontSize(8).fillColor(sub).text(winAnsiSafe(`${r.rank_label}: ${sc.rank_label}`), x + pad, doc.y + 4, { width: w });
      });
      doc.y = top + cardH + 6;

      // ---- Pressupostos
      heading(r.assumptions_title);
      for (const a of ctx.assumptions) {
        ensure(24);
        const y = doc.y;
        doc.circle(left + 3, y + 5, 1.6).fill(SAGE);
        doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(winAnsiSafe(a), left + 14, y, { width: contentW - 14 });
        doc.moveDown(0.25);
      }

      // ---- Aviso de tabela de exemplo + disclaimer
      doc.moveDown(0.6);
      if (is_example) {
        const countryName = (copy.chat.questions.pais.options as Record<string, string>)[ctx.answers.pais] ?? ctx.answers.pais;
        const notice = winAnsiSafe(fill(r.example_table_notice, { country: countryName }));
        doc.font("Helvetica-Bold").fontSize(9.5);
        const h = doc.heightOfString(notice, { width: contentW - 20 }) + 16;
        ensure(h + 4);
        const y = doc.y;
        doc.roundedRect(left, y, contentW, h, 4).fill(SAGE_SOFT);
        doc.rect(left, y, 3, h).fill(SAGE);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(notice, left + 14, y + 8, { width: contentW - 24 });
        doc.y = y + h + 8;
      }
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(winAnsiSafe(r.disclaimer), left, doc.y, { width: contentW });

      // ---- Análise
      heading(r.analysis_title);
      for (const para of ctx.analysis.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean)) {
        doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(winAnsiSafe(para), left, doc.y, { width: contentW, lineGap: 2, align: "left" });
        doc.moveDown(0.5);
      }

      // ---- Plano de 30 dias, por semana
      heading(r.plan_title);
      for (const wk of ctx.plan30) {
        const actions = wk.actions.map((a) => winAnsiSafe(a));
        doc.font("Helvetica").fontSize(10);
        const need = 24 + actions.reduce((s, a) => s + doc.heightOfString(a, { width: contentW - 30 }) + 3, 0);
        ensure(need);
        const y = doc.y;
        doc.roundedRect(left, y, 64, 18, 9).fill(SAGE);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE).text(winAnsiSafe(`${r.week_label} ${wk.week}`), left, y + 5, { width: 64, align: "center" });
        doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(winAnsiSafe(wk.title), left + 74, y + 3, { width: contentW - 74 });
        doc.y = Math.max(doc.y, y + 18) + 4;
        for (const a of actions) {
          const ay = doc.y;
          doc.circle(left + 12, ay + 5, 1.6).fill(SAGE);
          doc.font("Helvetica").fontSize(10).fillColor(INK).text(a, left + 24, ay, { width: contentW - 30 });
          doc.y += 3;
        }
        doc.moveDown(0.5);
      }

      // ---- Contacto da líder
      ensure(110);
      heading(leaderName);
      const wa = ctx.leader.whatsapp_e164?.trim();
      if (wa && ctx.cta.whatsapp_url) {
        doc.font("Helvetica-Bold").fontSize(10.5).fillColor(SAGE).text(winAnsiSafe(fill(r.cta_whatsapp, { leader_name: leaderName })), left, doc.y, { width: contentW, link: ctx.cta.whatsapp_url, underline: true });
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(winAnsiSafe(wa), left, doc.y + 1, { width: contentW });
        doc.moveDown(0.6);
      }
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(SAGE).text(winAnsiSafe(fill(r.cta_signup, { leader_name: leaderName })), left, doc.y, { width: contentW, link: ctx.cta.signup_url, underline: true });
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(ctx.cta.signup_url, left, doc.y + 1, { width: contentW });

      // ---- Rodapé em todas as páginas (aviso de parceira independente + número de página)
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const prevBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // sem isto escrever no rodapé abriria uma página nova
        const fy = doc.page.height - 44;
        doc.moveTo(left, fy - 6).lineTo(left + contentW, fy - 6).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(winAnsiSafe(brand.independent_notice), left, fy, { width: contentW - 40, lineBreak: true, height: 26 });
        doc.text(`${i - range.start + 1} / ${range.count}`, left + contentW - 36, fy, { width: 36, align: "right", lineBreak: false });
        doc.page.margins.bottom = prevBottom;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
