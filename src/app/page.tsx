import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={`container ${styles.homeContainer}`}>
      <section className={styles.heroSection} aria-labelledby="hero-title">
        <span className={styles.eyebrow}>Bengaluru Real Estate Brokerage</span>
        <h1 id="hero-title" className={styles.title}>
          {CANONICAL_BRAND}
        </h1>
        <p className={styles.lead}>
          Bengaluru Real Estate Brokerage &amp; Property Advisory Platform.
        </p>

        <div className={styles.actions}>
          <a href={PRIMARY_PHONE_TEL} className={styles.primaryCta}>
            <span aria-hidden="true">☎</span> Direct Inquiries: {PRIMARY_PHONE}
          </a>
        </div>
      </section>

      <section className={styles.statusSection} aria-labelledby="status-title">
        <h2 id="status-title" className={styles.sectionTitle}>
          Platform Scaffolding (Milestone 1)
        </h2>
        <p className={styles.statusText}>
          Core foundation and design architecture established. Public requirement capture,
          verified locality guidance, and advisory workflows are in preparation for subsequent
          approved milestones.
        </p>
      </section>
    </div>
  );
}
