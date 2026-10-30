import type { Copy } from "@/core/i18n";
import { LeaderAvatar } from "./LeaderAvatar";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import styles from "./LeaderSection.module.css";

type LeaderSectionProps = {
  copy: Copy;
  leader: PublicLeader;
};

function whatsappHref(value: string | null): string | null {
  const phone = value?.replace(/\D/g, "") ?? "";
  return phone.length >= 7 ? `https://wa.me/${phone}` : null;
}

export function LeaderSection({ copy, leader }: LeaderSectionProps) {
  const whatsapp = whatsappHref(leader.whatsapp_e164);

  return (
    <section className={styles.section} aria-labelledby="leader-title">
      <div className={styles.portrait}>
        <LeaderAvatar leader={leader} />
        <span aria-hidden="true" />
      </div>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{copy.lp.lider.eyebrow}</p>
        <h2 id="leader-title">{withLeader(copy.lp.lider.title, leader)}</h2>
        <p>{leader.bio ?? withLeader(copy.lp.lider.fallback_bio, leader)}</p>
        {whatsapp ? (
          <a href={whatsapp} rel="noreferrer" target="_blank">
            {withLeader(copy.lp.lider.cta_whatsapp, leader)}
          </a>
        ) : null}
      </div>
    </section>
  );
}
