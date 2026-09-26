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
            {CANONICAL_BRAND} offers direct telephone consultation for property owners to discuss
            property representation, parameters, and next steps with the brokerage team.
          </p>
          <div className={styles.actions}>
            <a href={PRIMARY_PHONE_TEL} className={styles.primaryLink}>
              <span aria-hidden="true">☎</span> Call Brokerage: {PRIMARY_PHONE}
            </a>
            <Link href="/sell" className={styles.phoneLink}>
              View Owner Advisory Details →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
