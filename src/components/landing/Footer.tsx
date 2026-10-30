import type { Copy } from "@/core/i18n";
import { LeaderLogo } from "./LeaderLogo";
import type { PublicLeader } from "./public-leader";
import { withLeader } from "./types";
import leaderBrand from "./LeaderBrand.module.css";
import styles from "./Footer.module.css";

type FooterProps = {
  copy: Copy;
  leader: PublicLeader;
};

export function Footer({ copy, leader }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          {leader.logo_url ? <LeaderLogo className={`${leaderBrand.logo} ${leaderBrand.footerLogo}`} src={leader.logo_url} brand={leader.brand_name} /> : null}
          <strong>{leader.brand_name}</strong>
          <p>{withLeader(copy.brand.independent_notice, leader)}</p>
        </div>
        <div className={styles.legal}>
          <p>{withLeader(copy.lp.footer.legal, leader)}</p>
          <p>{withLeader(copy.lp.footer.privacy, leader)}</p>
          <small>{withLeader(copy.lp.footer.made_by, leader)}</small>
        </div>
      </div>
    </footer>
  );
}
