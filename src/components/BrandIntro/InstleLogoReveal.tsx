import React from 'react';
import { CANONICAL_BRAND, CUSTOMER_INTENTS, PRIMARY_NAV_ITEMS, SHORT_BRAND } from '@/config/constants';
import styles from './BrandIntro.module.css';

/**
 * InstleLogoReveal — the lockup as it appears in the film.
 *
 * The site has no drawn logo: its identity is the typeset lockup in
 * `BrandLockup` — CANONICAL_BRAND in the display stack at 700 with 0.02em
 * tracking, over BENGALURU at 600 with 0.22em. This is that lockup, set large,
 * with the same family, weight and tracking, so that at the end of the film each
 * part can fly into the header and land on the real lockup without changing
 * shape (see transition.ts). Only the arrangement differs: the name is given
 * room to be the subject of the shot.
 *
 * Each word is a stack of identical text layers — extrusion, unlit face, lit
 * face, glint and ink — so depth, light and the final colour change are opacity
 * changes on the compositor rather than repaints of a text shadow.
 */

const ESTATE = CANONICAL_BRAND.slice(SHORT_BRAND.length).trim();
/** The descriptor BrandLockup sets under the name. */
const PLACE = 'BENGALURU';

/** The four intents, labelled as the navigation labels them. */
const JOURNEY = CUSTOMER_INTENTS.map(
  (intent) => PRIMARY_NAV_ITEMS.find((item) => item.href === intent.href)?.label ?? intent.intent
);

function Layers({ text, depth }: { text: string; depth?: boolean }) {
  return (
    <>
      {depth ? (
        <span className={`${styles.layer} ${styles.depth}`} data-layer="depth">
          {text}
        </span>
      ) : null}
      {depth ? (
        <span className={`${styles.layer} ${styles.face}`} data-layer="face">
          {text}
        </span>
      ) : null}
      <span className={`${styles.layer} ${styles.lit}`} data-layer="lit" data-intro-text="">
        {text}
      </span>
      {depth ? (
        <span className={`${styles.layer} ${styles.glint}`} data-layer="glint">
          {text}
        </span>
      ) : null}
      <span className={`${styles.layer} ${styles.ink}`} data-layer="ink">
        {text}
      </span>
    </>
  );
}

export function InstleLogoReveal() {
  return (
    <div className={`container ${styles.titleBox}`}>
      <div className={styles.lockup}>
        <span className={styles.backlight} />
        <span className={`${styles.word} ${styles.wordName}`} data-intro-part="name">
          <Layers text={SHORT_BRAND} depth />
        </span>
        <span className={`${styles.word} ${styles.wordEstate}`} data-intro-part="estate">
          <Layers text={ESTATE} />
        </span>
        <span className={`${styles.word} ${styles.wordPlace}`} data-intro-part="place">
          <Layers text={PLACE} />
        </span>
      </div>
      <div className={styles.journey}>
        {JOURNEY.map((label) => (
          <span key={label} className={styles.journeyItem}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
