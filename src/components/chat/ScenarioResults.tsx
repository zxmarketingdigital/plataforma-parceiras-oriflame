import { fill } from "@/core/i18n";
import { PdfStatus } from "./PdfStatus";
import { Plan30 } from "./Plan30";
import { ScenarioChart } from "./ScenarioChart";
import type { ChatCopy, DiagnosticResult, DiagnosticSession, ScenarioKey, SupportedCountry, SupportedLanguage } from "./types";
import styles from "./DiagnosticChat.module.css";

interface ScenarioResultsProps {
  result: DiagnosticResult;
  session: DiagnosticSession;
  copy: ChatCopy;
  lang: SupportedLanguage;
  country: SupportedCountry;
  contactName: string;
  onRestart: () => void;
}

const scenarioOrder: ScenarioKey[] = ["conservador", "provavel", "ambicioso"];

function fallbackCurrencyFor(country: SupportedCountry) {
  return country === "GB" ? "GBP" : "EUR";
}

function localeFor(country: SupportedCountry, lang: SupportedLanguage) {
  if (country === "GB") return "en-GB";
  if (country === "PT") return "pt-PT";
  if (country === "ES") return "es-ES";
  if (country === "FR") return "fr-FR";
  return lang;
}

function formatCurrency(value: number, currency: string, country: SupportedCountry, lang: SupportedLanguage) {
  return new Intl.NumberFormat(localeFor(country, lang), { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function safeHttpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ScenarioResults({ result, session, copy, lang, country, contactName, onRestart }: ScenarioResultsProps) {
  const signupUrl = safeHttpUrl(result.cta?.signup_url);
  const whatsappUrl = safeHttpUrl(result.cta?.whatsapp_url);
  const currency = result.currency || fallbackCurrencyFor(country);

  return (
    <section className={styles.results}>
      <p className={styles.resultIntro}>{copy.result.intro}</p>
      <div className={styles.scenarioGrid}>
        {scenarioOrder.map((key) => {
          const scenario = result.scenarios[key];
          const { monthly, month12, avg_monthly: average, rank_label: rank } = scenario;
          return (
            <article className={`${styles.scenarioCard} ${key === "provavel" ? styles.scenarioLikely : ""}`} key={key}>
              <h2>{copy.result.scenarios[key]}</h2>
              <p className={styles.scenarioValue}>{formatCurrency(month12, currency, country, lang)} <span>{copy.result.per_month}</span></p>
              <dl>
                <div><dt>{copy.result.month12_label}</dt><dd>{formatCurrency(month12, currency, country, lang)}</dd></div>
                <div><dt>{copy.result.avg_label}</dt><dd>{formatCurrency(average, currency, country, lang)}</dd></div>
                <div><dt>{copy.result.rank_label}</dt><dd>{rank}</dd></div>
              </dl>
              <details>
                <summary>{copy.result.per_month}</summary>
                <div className={styles.monthTable}>
                  <table>
                    <caption className={styles.srOnly}>{copy.result.scenarios[key]}</caption>
                    <thead><tr>{monthly.map((_, index) => <th scope="col" key={index}>{index + 1}</th>)}</tr></thead>
                    <tbody><tr>{monthly.map((value, index) => <td key={index}>{formatCurrency(value, currency, country, lang)}</td>)}</tr></tbody>
                  </table>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <ScenarioChart scenarios={result.scenarios} labels={copy.result.scenarios} />
      <section className={styles.resultSection}>
        <h2>{copy.result.assumptions_title}</h2>
        <ul className={styles.assumptions}>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        {result.is_example !== false && result.example_notice ? <p className={styles.exampleNotice}>{result.example_notice}</p> : null}
        <p className={styles.disclaimer}>{result.disclaimer || copy.result.disclaimer}</p>
      </section>
      <Plan30 copy={copy.result} analysis={result.analysis} weeks={result.plan30} />
      <div className={styles.resultActions}>
        {signupUrl ? <a className={styles.primaryButton} href={signupUrl}>{fill(copy.result.cta_signup, { leader_name: result.cta.leader.name })}</a> : null}
        {whatsappUrl ? <a className={styles.secondaryButton} href={whatsappUrl}>{fill(copy.result.cta_whatsapp, { leader_name: result.cta.leader.name, name: contactName })}</a> : null}
        <PdfStatus id={session.id} token={session.token} initialStatus={result.pdf_status} copy={copy.result} />
        <button className={styles.textButton} type="button" onClick={onRestart}>{copy.result.restart}</button>
      </div>
    </section>
  );
}
