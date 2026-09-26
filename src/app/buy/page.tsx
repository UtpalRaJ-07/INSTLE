import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { Concept1Intake } from '@/components/Concept1/Concept1Intake';
import styles from './buy.module.css';

export const metadata: Metadata = {
  title: `Residential Acquisition Advisory — ${CANONICAL_BRAND}`,
  description:
    'Private residential acquisition representation in Bengaluru. Define your parameters or call 9353096264 to discuss independent homes, luxury apartments, and land parcels.',
};

export default function BuyPage() {
  return (
    <div className={styles.buyPageWrapper}>
      {/* Editorial Introduction */}
      <section className={styles.introSection} aria-labelledby="buy-heading">
        <div className={styles.container}>
          <div className={styles.badgeRow}>
            <span className={styles.kicker}>ACQUISITION REPRESENTATION</span>
            <span className={styles.phoneQuick}>
              CALL DESK: <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>{PRIMARY_PHONE}</a>
            </span>
          </div>
          <h1 id="buy-heading" className={styles.heading}>
            Bespoke Residential Acquisitions in Bengaluru
          </h1>
          <p className={styles.lead}>
            We represent private buyers acquiring independent homes, luxury apartments, and land parcels across Bengaluru’s established residential enclaves. No public listings; purely dedicated human representation.
          </p>
        </div>
      </section>

      {/* Stepped Acquisition Brief */}
      <Concept1Intake />

      {/* Direct Advisory Guidance */}
      <section className={styles.guidanceSection} aria-labelledby="advisory-focus-title">
        <div className={styles.container}>
          <h2 id="advisory-focus-title" className={styles.focusTitle}>
            Our Acquisition Advisory Focus
          </h2>
          <div className={styles.focusGrid}>
            <div className={styles.focusCard}>
              <h3 className={styles.cardHeading}>Independent Villas &amp; Plots</h3>
              <p className={styles.cardText}>
                We research municipal sanctions, title deed histories, and layout approvals for standalone properties in prime residential sectors.
              </p>
            </div>
            <div className={styles.focusCard}>
              <h3 className={styles.cardHeading}>Prime Apartments &amp; Penthouses</h3>
              <p className={styles.cardText}>
                Curated selection of high-specification low-density residential developments in Indiranagar, Koramangala, Sadashivanagar, and Outer Ring Road.
              </p>
            </div>
            <div className={styles.focusCard}>
              <h3 className={styles.cardHeading}>Direct Fiduciary Representation</h3>
              <p className={styles.cardText}>
                We act exclusively on your behalf, coordinating physical inspections and counterparty negotiations with total confidentiality.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
