import React from 'react';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { ArchitecturalGraphic } from '@/components/ArchitecturalGraphic/ArchitecturalGraphic';
import { IntentRail } from '@/components/IntentRail/IntentRail';
import { ProcessSteps } from '@/components/ProcessSteps/ProcessSteps';
import { OwnerSection } from '@/components/OwnerSection/OwnerSection';
import { ContactBand } from '@/components/ContactBand/ContactBand';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={`container ${styles.homeContainer}`}>
      {/* Editorial Hero Section */}
      <section className={styles.heroSection} aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            Bengaluru Real Estate Brokerage &amp; Property Advisory
          </span>
          <h1 id="hero-title" className={styles.title}>
            A considered approach to Bengaluru property decisions.
          </h1>
          <p className={styles.lead}>
            Call {CANONICAL_BRAND} at {PRIMARY_PHONE} to discuss what you are looking for in a
            Bengaluru property. Our brokerage team assists clients by telephone in clarifying
            priorities, evaluating local trade-offs, and discussing relevant next steps.
          </p>

          <div className={styles.actions}>
            <a href={PRIMARY_PHONE_TEL} className={styles.primaryCta}>
              <span aria-hidden="true">☎</span> Call {PRIMARY_PHONE}
            </a>
            <Link href="/contact" className={styles.secondaryCta}>
              Advisory Contact Details
            </Link>
          </div>
        </div>

        <div className={styles.heroMedia}>
          <ArchitecturalGraphic />
        </div>
      </section>

      {/* Primary Intent Pathways */}
      <IntentRail />

      {/* Advisory Process: 3 Steps */}
      <ProcessSteps />

      {/* Bengaluru Urban Geographic Context */}
      <section className={styles.geographySection} aria-labelledby="geo-title">
        <div className={styles.geoContent}>
          <span className={styles.eyebrow}>Local Context</span>
          <h2 id="geo-title" className={styles.geoTitle}>
            Navigating Bengaluru Property Decisions
          </h2>
          <p className={styles.geoDescription}>
            Tell {CANONICAL_BRAND} which parts of Bengaluru you are considering. Our brokerage
            team assists clients in discussing location preferences, clarifying priorities,
            and understanding relevant next steps.
          </p>
          <div className={styles.geoActions}>
            <Link href="/contact" className={styles.geoLink}>
              Discuss Your Preferred Areas with the Team →
            </Link>
          </div>
        </div>
      </section>

      {/* Owner & Representation Section */}
      <OwnerSection />

      {/* Direct Inquiries Contact Band */}
      <ContactBand />
    </div>
  );
}
