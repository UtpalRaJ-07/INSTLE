import React from 'react';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './OwnerSection.module.css';

export const OwnerSection: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="owner-title">
      <div className={styles.card}>
        <div className={styles.content}>
          <span className={styles.eyebrow}>Property Owners &amp; Landlords</span>
          <h2 id="owner-title" className={styles.title}>
            Looking to Sell or Rent Out Property in Bengaluru?
          </h2>
          <p className={styles.description}>
            {CANONICAL_BRAND} works with property owners who want to sell or rent out. Share your property details, or call our team directly at {PRIMARY_PHONE}.
          </p>
          <div className={styles.actions}>
            <a href={PRIMARY_PHONE_TEL} className={styles.primaryLink}>
              <span aria-hidden="true">☎</span> Call Our Team: {PRIMARY_PHONE}
            </a>
            <Link href="/sell" className={styles.phoneLink}>
              Share Property Details →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
