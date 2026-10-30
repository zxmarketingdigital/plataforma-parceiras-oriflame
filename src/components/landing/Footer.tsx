import type { Copy } from "@/core/i18n";
import styles from "./Footer.module.css";

type FooterProps = {
  copy: Copy;
};

export function Footer({ copy }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <strong>{copy.brand.name}</strong>
          <p>{copy.brand.independent_notice}</p>
        </div>
        <div className={styles.legal}>
          <p>{copy.lp.footer.legal}</p>
          <p>{copy.lp.footer.privacy}</p>
          <small>{copy.lp.footer.made_by}</small>
        </div>
      </div>
    </footer>
  );
}
