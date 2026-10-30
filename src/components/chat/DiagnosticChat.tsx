"use client";

import { brandVars } from "@/core/brand";
import { fill } from "@/core/i18n";
import { Bubble } from "./Bubble";
import { ChipGroup } from "./ChipGroup";
import { ContactCard } from "./ContactCard";
import { Conversation } from "./Conversation";
import { Progress } from "./Progress";
import { ScenarioResults } from "./ScenarioResults";
import type { ChatCopy, SupportedLanguage, UTMValues } from "./types";
import { useDiagnosticFlow } from "./useDiagnosticFlow";
import styles from "./DiagnosticChat.module.css";

interface DiagnosticChatProps {
  copy: ChatCopy;
  lang: SupportedLanguage;
  leader: { name: string; slug: string | null; brand_name: string; photo_url?: string | null };
  utm?: UTMValues;
}

export function DiagnosticChat({ copy, lang, leader, utm }: DiagnosticChatProps) {
  const flow = useDiagnosticFlow({ lang, leaderSlug: leader.slug ?? undefined, utm, copy });
  const afterContact = flow.contact && flow.session ? fill(copy.after_contact, { name: flow.contact.name }) : null;
  const reaction = flow.phase === "questions" && flow.answers.length > 1 && flow.currentQuestion
    ? copy.reactions[(flow.answers.length - 2) % copy.reactions.length] ?? null
    : null;
  const showInlineRetry = Boolean(flow.error && flow.retryOperation !== "start");

  return (
    <main className={styles.page}>
      <section className={styles.chatShell} aria-labelledby="diagnostic-title">
        <header className={styles.header}>
          {leader.photo_url ? <img className={styles.avatar} src={leader.photo_url} alt="" /> : null}
          <div>
            <h1 id="diagnostic-title">{fill(copy.header.title, brandVars(leader.name, leader.brand_name))}</h1>
            <p>{copy.header.status}</p>
          </div>
        </header>
        <Progress completed={flow.completed} />
        <Conversation
          greeting={copy.greeting.map((message) => fill(message, brandVars(leader.name, leader.brand_name)))}
          afterContact={afterContact}
          answers={flow.answers}
          reaction={reaction}
          typingLabel={(flow.phase === "finishing" && flow.busy) || (flow.busy && flow.phase === "questions") ? copy.calculating : null}
        >
          {flow.phase === "contact" && flow.countryQuestion && !flow.session ? (
            <ContactCard
              copy={copy.contact_step}
              leaderName={leader.name}
              leaderBrandName={leader.brand_name}
              countries={flow.countryQuestion.options}
              busy={flow.busy}
              serverError={flow.retryOperation === "start" ? flow.error : null}
              onSubmit={flow.startContact}
            />
          ) : null}
          {flow.phase === "questions" && flow.currentQuestion ? (
            <>
              <div id="diagnostic-question"><Bubble>{flow.currentQuestion.text}</Bubble></div>
              <ChipGroup labelledBy="diagnostic-question" questionKey={flow.currentQuestion.key} options={flow.currentQuestion.options} disabled={flow.busy} onSelect={flow.submitAnswer} />
            </>
          ) : null}
          {flow.phase === "result" && flow.result && flow.session && flow.contact ? (
            <ScenarioResults
              result={flow.result}
              session={flow.session}
              copy={copy}
              lang={lang}
              country={flow.contact.country}
              contactName={flow.contact.name}
              onRestart={flow.restart}
            />
          ) : null}
          {showInlineRetry ? (
            <div className={styles.recovery} role="alert">
              <p>{flow.error}</p>
              <button className={styles.secondaryButton} type="button" onClick={() => void flow.retry()} disabled={flow.busy}>
                {copy.contact_step.submit}
              </button>
            </div>
          ) : null}
        </Conversation>
      </section>
    </main>
  );
}
