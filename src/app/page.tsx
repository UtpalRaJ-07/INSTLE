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
            Tell {CANONICAL_BRAND} what you are looking for; the team will understand the
            requirement and discuss relevant next steps. We assist in clarifying priorities,
            evaluating local trade-offs, and discussing next steps directly with clients.
          </p>

          <div className={styles.actions}>
            <Link href="/buy" className={styles.primaryCta}>
              State Your Requirement →
            </Link>
            <Link href="/sell" className={styles.secondaryCta}>
              Discuss Your Property
            </Link>
          </div>

          <div className={styles.directContactPrompt}>
            <span>Prefer an immediate conversation?</span>{' '}
            <a href={PRIMARY_PHONE_TEL} className={styles.phonePromptLink}>
              Call {PRIMARY_PHONE}
            </a>
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
