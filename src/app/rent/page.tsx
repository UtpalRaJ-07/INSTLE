import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { RentalIntake } from '@/components/RentalIntake/RentalIntake';
import styles from './rent.module.css';

export const metadata: Metadata = {
  title: `Residential Tenancies — ${CANONICAL_BRAND}`,
  description:
    'Executive tenancy advisory in Bengaluru. Connect directly with our advisory desk at 9353096264 for high-specification residences and private leasing representation.',
};

export default function RentPage() {
  return (
    <div className={styles.rentPageWrapper}>
      <section className={styles.introSection} aria-labelledby="rent-heading">
        <div className={styles.container}>
          <div className={styles.badgeRow}>
            <span className={styles.kicker}>PRIME TENANCY REPRESENTATION</span>
            <span className={styles.phoneQuick}>
              CALL DESK: <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>{PRIMARY_PHONE}</a>
            </span>
          </div>
          <h1 id="rent-heading" className={styles.heading}>
            Curated Residential Tenancies in Bengaluru
          </h1>
          <p className={styles.lead}>
            We assist corporate executives, leaders, and relocating families in securing high-specification residences across Bengaluru’s established residential enclaves. Direct landlord communication and transparent lease terms.
          </p>
        </div>
      </section>

      <RentalIntake />

      <section className={styles.serviceSection} aria-labelledby="tenancy-standards-title">
        <div className={styles.container}>
          <h2 id="tenancy-standards-title" className={styles.standardsTitle}>
            Our Tenancy Advisory Standards
          </h2>
          <div className={styles.standardsGrid}>
            <div className={styles.standardCard}>
              <h3 className={styles.cardHeading}>Established Enclaves</h3>
              <p className={styles.cardText}>
                We prioritize tranquil residential streets in Indiranagar, Koramangala, Sadashivanagar, and master-planned North Bengaluru gated communities.
              </p>
            </div>
            <div className={styles.standardCard}>
              <h3 className={styles.cardHeading}>Lease Terms Review</h3>
              <p className={styles.cardText}>
                We assist in structuring clear lease terms, maintenance protocols, deposit schedules, and move-in conditions before commitment.
              </p>
            </div>
            <div className={styles.standardCard}>
              <h3 className={styles.cardHeading}>Direct Coordination</h3>
              <p className={styles.cardText}>
                Every requirement receives direct attention from our brokerage team. Call {PRIMARY_PHONE} for immediate consultation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
