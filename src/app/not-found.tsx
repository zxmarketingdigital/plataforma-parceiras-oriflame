import { headers } from "next/headers";
import { fill, getCopy } from "@/core/i18n";
import { pickLocale } from "@/core/locale";
import styles from "@/styles/not-found.module.css";

export default async function NotFound() {
  const requestHeaders = await headers();
  const lang = pickLocale(requestHeaders.get("accept-language"));
  const copy = getCopy(lang);
  const vars = { brand_name: copy.brand.name, leader_name: copy.brand.name };

  return (
    <main className={styles.page} lang={lang}>
      <div>
        <p>{fill(copy.brand.name, vars)}</p>
        <h1>{fill(copy.brand.tagline, vars)}</h1>
        <p>{fill(copy.lp.footer.legal, vars)}</p>
        <a href={`/${lang}/diagnostico`}>{fill(copy.lp.hero.cta_primary, vars)}</a>
      </div>
    </main>
  );
}
