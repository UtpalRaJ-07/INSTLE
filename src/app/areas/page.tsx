import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { getPublishedLocalities } from '@/config/localities';
import styles from './areas.module.css';

export const metadata: Metadata = {
  title: `Bengaluru Micro-Markets — ${CANONICAL_BRAND}`,
  description:
    'Curated micro-market intelligence across prime Bengaluru enclaves. Sourced from official transit and municipal planning data.',
};

export default function AreasPage() {
  const publishedLocalities = getPublishedLocalities();

  return (
    <div className={styles.areasWrapper}>
      <section className={styles.introSection} aria-labelledby="areas-heading">
        <div className={styles.container}>
          <div className={styles.metaRow}>
            <span className={styles.kicker}>BENGALURU GEOGRAPHY</span>
            <span className={styles.gateBadge}>MUNICIPAL &amp; TRANSIT REFERENCE</span>
          </div>
          <h1 id="areas-heading" className={styles.heading}>
            Curated Bengaluru Micro-Markets
          </h1>
          <p className={styles.lead}>
            Locality profiles grounded in verified urban planning, operational transit routes, and established residential typologies—distinguishing between mature enclaves and developmental growth sectors.
          </p>
        </div>
      </section>

      <section className={styles.listSection} aria-label="Published Localities">
        <div className={styles.container}>
          <div className={styles.localityGrid}>
            {publishedLocalities.map((loc) => (
              <article key={loc.slug} className={styles.localityCard}>
                <div className={styles.cardTop}>
                  <span className={styles.quadrantTag}>{loc.quadrant}</span>
                  <span className={styles.zoneText}>{loc.bbmpZone}</span>
                </div>

                <h2 className={styles.cardTitle}>
                  <Link href={`/areas/${loc.slug}`} className={styles.titleLink}>
                    {loc.name}
                  </Link>
                </h2>

                <p className={styles.cardDesc}>{loc.character}</p>

                <div className={styles.infraBlock}>
                  <div className={styles.infraRow}>
                    <strong className={styles.infraKey}>Operational Transit:</strong>
                    <span>{loc.transitOperational}</span>
                  </div>
                  <div className={styles.infraRow}>
                    <strong className={styles.infraKey}>Planned Infrastructure:</strong>
                    <span>{loc.transitPlanned}</span>
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <span className={styles.typologyText}>
                    <strong>Typology:</strong> {loc.typicalResidentialTypology}
                  </span>
                  <Link href={`/areas/${loc.slug}`} className={styles.viewLink}>
                    View Enclave Profile →
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.contactDeskRow}>
            <div className={styles.deskText}>
              <h3>Looking for properties in other Bengaluru micro-markets?</h3>
              <p>
                Our brokerage team handles customized acquisition briefs across both mature layouts and emerging residential belts.
              </p>
            </div>
            <div className={styles.deskActions}>
              <a href={PRIMARY_PHONE_TEL} className={styles.phoneDeskBtn}>
                ☎ Call Desk: {PRIMARY_PHONE}
              </a>
              <Link href="/buy" className={styles.intakeBtn}>
                Share Requirement →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
