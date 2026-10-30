import { headers } from "next/headers";
import { getCopy } from "@/core/i18n";
import { pickLocale } from "@/core/locale";
import styles from "@/styles/not-found.module.css";

export default async function NotFound() {
  const requestHeaders = await headers();
  const lang = pickLocale(requestHeaders.get("accept-language"));
  const copy = getCopy(lang);

  return (
    <main className={styles.page} lang={lang}>
      <div>
        <p>{copy.brand.name}</p>
        <h1>{copy.brand.tagline}</h1>
        <p>{copy.lp.footer.legal}</p>
        <a href={`/${lang}/diagnostico`}>{copy.lp.hero.cta_primary}</a>
      </div>
    </main>
  );
}
