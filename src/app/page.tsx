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
            {CANONICAL_BRAND} provides dedicated, human-led brokerage advisory for residential
            buyers, tenants, and property owners across Bengaluru. We assist in clarifying
            priorities, evaluating local trade-offs, and coordinating transactions without
            unverified listings or automated pressure.
          </p>

          <div className={styles.actions}>
            <Link href="/buy" className={styles.primaryCta}>
              State Your Requirement →
            </Link>
            <Link href="/sell" className={styles.secondaryCta}>
              List Your Property
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

      {/* Bengaluru Urban Geographic Context (Broad Citywide Focus) */}
      <section className={styles.geographySection} aria-labelledby="geo-title">
        <div className={styles.geoContent}>
          <span className={styles.eyebrow}>Geographic Context</span>
          <h2 id="geo-title" className={styles.geoTitle}>
            Navigating Bengaluru&apos;s Dynamic Corridors
          </h2>
          <p className={styles.geoDescription}>
            Bengaluru&apos;s property landscape spans established central precincts, tech
            corridors, and emerging peripheral developments. Each geography presents distinct
            infrastructure, commute parameters, and civic characteristics.
          </p>
          <p className={styles.geoDescription}>
            {CANONICAL_BRAND} evaluates requirements across the city based on verified access,
            documentation transparency, and realistic commute realities. Specific neighbourhood
            dossiers are prepared under rigorous two-source factual verification before publication.
          </p>
          <div className={styles.geoActions}>
            <Link href="/contact" className={styles.geoLink}>
              Discuss Specific Corridors with our Team →
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
