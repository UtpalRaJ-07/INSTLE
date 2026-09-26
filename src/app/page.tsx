import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={`container ${styles.homeContainer}`}>
      <section className={styles.heroSection} aria-labelledby="hero-title">
        <span className={styles.eyebrow}>Bengaluru Real Estate Brokerage</span>
        <h1 id="hero-title" className={styles.title}>
          Navigate Bengaluru property through local knowledge and responsive advisory.
        </h1>
        <p className={styles.lead}>
          {CANONICAL_BRAND} connects buyers, tenants, sellers, and landlords with a human-led
          brokerage process. We assist you in understanding local trade-offs, timing, and
          clarifying priorities across Bengaluru.
        </p>

        <div className={styles.actions}>
          <a href={PRIMARY_PHONE_TEL} className={styles.primaryCta}>
            <span aria-hidden="true">☎</span> Speak with our team: {PRIMARY_PHONE}
          </a>
        </div>
      </section>

      <section className={styles.pillarsSection} aria-labelledby="pillars-title">
        <h2 id="pillars-title" className={styles.sectionTitle}>
          Our Approach
        </h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Requirement-Led</h3>
            <p className={styles.cardText}>
              Tell our team what you need. We listen before recommending next steps or discussing
              suitable options.
            </p>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Human Follow-Up</h3>
            <p className={styles.cardText}>
              Every verified enquiry is reviewed by an accountable brokerage team member who
              coordinates directly with you.
            </p>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Local Clarity</h3>
            <p className={styles.cardText}>
              Honest area context, realistic timing, and transparent process boundaries across
              Bengaluru neighbourhoods.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
