import React from 'react';
import Link from 'next/link';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './OwnerSection.module.css';

export const OwnerSection: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="owner-title">
      <div className={styles.card}>
        <div className={styles.content}>
          <span className={styles.eyebrow}>Owner Advisory & Representation</span>
          <h2 id="owner-title" className={styles.title}>
            Looking to Sell or Lease Property in Bengaluru?
          </h2>
          <p className={styles.description}>
            INSTLE REAL ESTATE provides confidential, structured brokerage representation for
            property owners. We coordinate directly with you to understand your property parameters,
            discuss market trade-offs, and handle qualified inquiries without public catalog noise.
          </p>
          <div className={styles.actions}>
            <Link href="/sell" className={styles.primaryLink}>
              Inquire About Listing →
            </Link>
            <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
              <span aria-hidden="true">☎</span> Speak with Brokerage: {PRIMARY_PHONE}
            </a>
          </div>
          <p className={styles.boundaryNote}>
            * We evaluate representation on an individual basis. No automated valuation or guaranteed
            transaction duration is implied.
          </p>
        </div>
      </div>
    </section>
  );
};
