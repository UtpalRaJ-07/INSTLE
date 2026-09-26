'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './Concept1Hero.module.css';

export function Concept1Hero() {
  return (
    <section className={styles.heroSection} aria-labelledby="c1-hero-title">
      <div className={styles.container}>
        {/* Left / Top on Mobile: Editorial Content Column */}
        <div className={styles.contentColumn}>
          <div className={styles.dossierBadge}>
            <span className={styles.dossierNum}>BENGALURU</span>
            <span className={styles.dossierDivider} aria-hidden="true" />
            <span className={styles.dossierType}>PROPERTY ADVISORY &amp; BROKERAGE</span>
          </div>

          <h1 id="c1-hero-title" className={styles.heroTitle}>
            Property Advisory &amp; Brokerage in Bengaluru
          </h1>

          <p className={styles.heroSummary}>
            Direct advisory, ground diligence, and private brokerage for buyers, tenants, and property owners across Bengaluru’s prime residential enclaves. No public listings; purely dedicated client representation.
          </p>

          {/* Quick Dual Action Group */}
          <div className={styles.actionGroup}>
            <Link href="/buy" className={styles.primaryAction}>
              <span>Share Requirement</span>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </Link>

            <a href={PRIMARY_PHONE_TEL} className={styles.phoneAction}>
              <span>☎ Call {PRIMARY_PHONE}</span>
            </a>
          </div>

          {/* Secondary Intent Links */}
          <div className={styles.intentRow}>
            <span className={styles.intentLabel}>Direct Services:</span>
            <Link href="/buy" className={styles.intentLink}>Buy</Link>
            <span className={styles.intentDivider}>·</span>
            <Link href="/rent" className={styles.intentLink}>Rent</Link>
            <span className={styles.intentDivider}>·</span>
            <Link href="/sell" className={styles.intentLink}>Sell / Lease</Link>
            <span className={styles.intentDivider}>·</span>
            <Link href="/areas" className={styles.intentLink}>Localities</Link>
          </div>

          {/* Direct Phone Line */}
          <div className={styles.phoneTouchpoint}>
            <div className={styles.phoneMeta}>
              <span className={styles.phoneLabel}>Advisory Desk Telephone:</span>
            </div>
            <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
              {PRIMARY_PHONE}
            </a>
            <span className={styles.phoneSubtext}>Direct connection to an accountable brokerage team member</span>
          </div>
        </div>

        {/* Right / Beneath on Mobile: Architectural Conceptual Media */}
        <div className={styles.mediaColumn}>
          <div className={styles.imageFrame}>
            <Image
              src="/media/concept1-garden-modernism.jpg"
              alt="Conceptual architectural rendering exploring modern Bengaluru residential design principles with stone and garden elements"
              width={1600}
              height={900}
              priority
              className={styles.heroImage}
            />
            <div className={styles.imageOverlay}>
              <div className={styles.imageTag}>
                <span className={styles.tagDot} aria-hidden="true" />
                <span>ARCHITECTURAL STUDY · CONCEPTUAL</span>
              </div>
              <span className={styles.studyBadge}>NON-INVENTORY</span>
            </div>
          </div>
          <p className={styles.mediaCaption}>
            Conceptual architectural rendering illustrating stone and courtyard elements in Bengaluru. Prototype design study; not an authentic location photograph.
          </p>
        </div>
      </div>
    </section>
  );
}
