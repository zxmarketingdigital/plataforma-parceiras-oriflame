import { DiagnosticCallout } from "./DiagnosticCallout";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { LeaderSection } from "./LeaderSection";
import { Paths } from "./Paths";
import { Steps } from "./Steps";
import type { LandingProps } from "./types";
import styles from "./LandingPage.module.css";

export function LandingPage({ copy, lang, leader, diagnosticHref, tracking }: LandingProps) {
  return (
    <div className={styles.page}>
      <Header copy={copy} lang={lang} leaderSlug={leader.slug} tracking={tracking} diagnosticHref={diagnosticHref} />
      <main id="conteudo" className={styles.main}>
        <Hero copy={copy} leader={leader} diagnosticHref={diagnosticHref} />
        <Paths copy={copy} leader={leader} diagnosticHref={diagnosticHref} />
        <Steps copy={copy} leader={leader} />
        <DiagnosticCallout copy={copy} diagnosticHref={diagnosticHref} />
        <LeaderSection copy={copy} leader={leader} />
        <Faq copy={copy} leader={leader} />
        <FinalCta copy={copy} diagnosticHref={diagnosticHref} />
      </main>
      <Footer copy={copy} />
    </div>
  );
}
