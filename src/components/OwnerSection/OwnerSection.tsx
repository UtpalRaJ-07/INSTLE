import React from 'react';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './OwnerSection.module.css';

export const OwnerSection: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="owner-title">
      <div className={styles.card}>
        <div className={styles.content}>
          <span className={styles.eyebrow}>Owner Advisory &amp; Representation</span>
          <h2 id="owner-title" className={styles.title}>
            Looking to Sell or Lease Property in Bengaluru?
          </h2>
          <p className={styles.description}>
            {CANONICAL_BRAND} offers a direct way for property owners to share property basics and
            request a conversation with the brokerage team to discuss representation and next steps.
          </p>
          <div className={styles.actions}>
            <Link href="/sell" className={styles.primaryLink}>
              Discuss Your Property →
            </Link>
            <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
              <span aria-hidden="true">☎</span> Speak with Brokerage: {PRIMARY_PHONE}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
