import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { OwnerIntake } from '@/components/OwnerIntake/OwnerIntake';
import styles from './sell.module.css';

export const metadata: Metadata = {
  title: `Owner & Landlord Representation — ${CANONICAL_BRAND}`,
  description:
    'Confidential property representation for Bengaluru owners and landlords. Connect with our advisory desk at 9353096264 to discuss sale or leasing mandates.',
};

export default function SellPage() {
  return (
    <div className={styles.sellPageWrapper}>
      <section className={styles.introSection} aria-labelledby="sell-heading">
        <div className={styles.container}>
          <div className={styles.badgeRow}>
            <span className={styles.kicker}>DISCREET OWNER REPRESENTATION</span>
            <span className={styles.phoneQuick}>
              CALL DESK: <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>{PRIMARY_PHONE}</a>
            </span>
          </div>
          <h1 id="sell-heading" className={styles.heading}>
            Property Representation with {CANONICAL_BRAND}
          </h1>
          <p className={styles.lead}>
            We provide discreet brokerage representation for owners of independent homes, prime apartments, and land parcels across Bengaluru. Qualified buyer matching and corporate tenant placement without public listing broadcasts.
          </p>
        </div>
      </section>

      <OwnerIntake />

      <section className={styles.pillarsSection} aria-labelledby="owner-standards-title">
        <div className={styles.container}>
          <h2 id="owner-standards-title" className={styles.standardsTitle}>
            Representation Commitments
          </h2>
          <div className={styles.standardsGrid}>
            <div className={styles.standardCard}>
              <h3 className={styles.cardHeading}>Confidentiality First</h3>
              <p className={styles.cardText}>
                No signboards, no public internet listing broadcasts. Your property identity is only disclosed to vetted counter-parties after pre-qualification.
              </p>
            </div>
            <div className={styles.standardCard}>
              <h3 className={styles.cardHeading}>Direct Diligence</h3>
              <p className={styles.cardText}>
                We assist with documentation organization, encumbrance verification, and coordination with your legal counsel for clean transaction execution.
              </p>
            </div>
            <div className={styles.standardCard}>
              <h3 className={styles.cardHeading}>Fiduciary Guidance</h3>
              <p className={styles.cardText}>
                Honest evaluation of pricing benchmarks and realistic transaction timelines. Call {PRIMARY_PHONE} for a confidential preliminary discussion.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
