/**
 * TypographicPlate — the name, set large, over the layout grid texture.
 *
 * This is what Requirement 9.15 asks for and it is worth being exact about what it
 * forbids: where no illustration and no map applies to a page that must carry a
 * Bengaluru element, the typographic treatment renders *alone*. No placeholder
 * image, no empty frame, no substitute graphic. So there is no `<img>` here, no
 * empty `<svg>` box and nothing shaped like a picture that failed to load — a
 * name, a kicker, and a texture drawn from the same layout geometry the rest of
 * the identity uses.
 *
 * The name is HTML text rather than SVG text, which matters twice: it scales with
 * the reader's font size at 150%, and it wraps instead of overflowing when the
 * area name is long.
 *
 * Text sits over the texture here, so Requirement 9.5 applies to both colours the
 * texture presents behind it. The register declares them and the token test
 * computes 4.5:1 for each against both text colours the pages use.
 */

import React from 'react';
import { LayoutGridMotif } from './LayoutGridMotif';
import styles from './Bengaluru.module.css';

export function TypographicPlate({
  name,
  kicker,
  note,
}: {
  /** The locality or city name to set. */
  name: string;
  /** A short label above the name. */
  kicker: string;
  /**
   * The visible line explaining why the typographic treatment is what renders.
   * Shown so a reader is not left wondering whether an image failed.
   */
  note: string;
}) {
  return (
    <figure className={styles.figure}>
      <div className={styles.plate}>
        <LayoutGridMotif className={styles.plateTexture} />
        <div className={styles.plateBody}>
          <span className={styles.plateKicker}>{kicker}</span>
          <p className={styles.plateName}>{name}</p>
        </div>
      </div>
      <figcaption className={styles.caption}>{note}</figcaption>
    </figure>
  );
}
