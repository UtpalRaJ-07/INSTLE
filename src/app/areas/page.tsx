import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { VERIFIED_LOCALITIES } from '@/config/localities';
import styles from './areas.module.css';

export const metadata: Metadata = {
  title: `Bengaluru Micro-Market Gazetteer — ${CANONICAL_BRAND}`,
  description:
    'Curated micro-market intelligence across Bengaluru enclaves. Two-source claim-gated analysis of transit, zoning, and residential character.',
};

export default function AreasPage() {
  return (
    <div className={styles.areasWrapper}>
      <section className={styles.introSection} aria-labelledby="areas-heading">
        <div className={styles.container}>
          <div className={styles.metaRow}>
            <span className={styles.kicker}>BENGALURU GEOGRAPHY</span>
            <span className={styles.gateBadge}>TWO-SOURCE CLAIM GATE VERIFIED</span>
          </div>
          <h1 id="areas-heading" className={styles.heading}>
            Curated Bengaluru Micro-Market Directory
          </h1>
          <p className={styles.lead}>
            Locality guidance grounded in verified physical geography, operational transit infrastructure, and architectural typology—distinguishing between established enclaves and planned developmental corridors.
          </p>
        </div>
      </section>

      <section className={styles.listSection} aria-label="Verified Localities">
        <div className={styles.container}>
          <div className={styles.localityGrid}>
            {VERIFIED_LOCALITIES.map((loc) => (
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

                <div className={styles.cardAction}>
                  <Link href={`/areas/${loc.slug}`} className={styles.viewLink}>
                    View Detailed Locality Profile →
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.calloutCard}>
            <span className={styles.calloutLabel}>LOOKING TO EXPLORE A SPECIFIC ENCLAVE?</span>
            <p className={styles.calloutText}>
              Discuss your location parameters with our brokerage desk. We help evaluate commute trade-offs and micro-neighborhood acoustics.
            </p>
            <a href={PRIMARY_PHONE_TEL} className={styles.calloutPhone}>
              ☎ Call Advisory Desk: {PRIMARY_PHONE}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
