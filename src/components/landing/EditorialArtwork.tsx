import styles from "./EditorialArtwork.module.css";

export function EditorialArtwork() {
  return (
    <div className={styles.artwork} aria-hidden="true">
      <svg viewBox="0 0 560 610" focusable="false">
        <path className={styles.wash} d="M53 218C68 72 221 22 348 70c138 52 181 193 119 351-46 117-180 159-293 106C73 484 39 359 53 218Z" />
        <path className={styles.arc} d="M95 414C168 518 333 549 442 426" />
        <path className={styles.arcFine} d="M105 163C183 77 337 75 431 155" />
        <g className={styles.bottleTall}>
          <rect x="174" y="197" width="120" height="253" rx="58" />
          <rect x="206" y="145" width="56" height="70" rx="15" />
          <path d="M206 178h56" />
        </g>
        <g className={styles.bottleRound}>
          <circle cx="343" cy="353" r="89" />
          <path d="M314 270v-42c0-16 13-29 29-29s29 13 29 29v42" />
          <path d="M281 353h124" />
        </g>
        <path className={styles.leaf} d="M116 317c-52-25-66-86-37-130 55 16 80 79 37 130Z" />
        <path className={styles.leafLine} d="M80 205c19 33 28 66 36 110" />
        <circle className={styles.dot} cx="446" cy="204" r="13" />
      </svg>
    </div>
  );
}
