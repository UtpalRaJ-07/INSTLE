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
        {/* Left/Top: Architectural Fine Media Composition */}
        <div className={styles.mediaColumn}>
          <div className={styles.imageFrame}>
            <Image
              src="/media/concept1-garden-modernism.jpg"
              alt="Architectural study of a contemporary residence in Bengaluru surrounded by raintrees and stone reflection pool"
              width={1600}
              height={900}
              priority
              className={styles.heroImage}
            />
            <div className={styles.imageOverlay}>
              <div className={styles.imageTag}>
                <span className={styles.tagDot} aria-hidden="true" />
                <span>ARCHITECTURAL SANCTUARY · BENGALURU</span>
              </div>
              <span className={styles.imageCoordinate}>12°58′N 77°35′E</span>
            </div>
          </div>
          <p className={styles.mediaCaption}>
            Conceptual architectural atmosphere representing Bengaluru modernism (Sadahalli granite, teak louvers, and raintree canopy). Non-inventory editorial reference.
          </p>
        </div>

        {/* Right/Bottom: Editorial Dossier Card */}
        <div className={styles.contentColumn}>
          <div className={styles.dossierBadge}>
            <span className={styles.dossierNum}>DOSSIER NO. 01</span>
            <span className={styles.dossierDivider} aria-hidden="true" />
            <span className={styles.dossierType}>PROPERTY ADVISORY</span>
          </div>

          <h1 id="c1-hero-title" className={styles.heroTitle}>
            Deliberate property advisory for acquisitions, tenancies, and owner representation.
          </h1>

          <p className={styles.heroSummary}>
            We connect buyers, tenants, and property owners with a considered human advisory process—focused on Bengaluru’s mature enclaves and evolving growth belts. No public listings; purely dedicated representation.
          </p>

          {/* Quick Dual Action Group */}
          <div className={styles.actionGroup}>
            <Link href="/concept-1/intake" className={styles.primaryAction}>
              <span>Commission Acquisition Brief</span>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </Link>

            <Link href="#owner-mandates" className={styles.secondaryAction}>
              <span>Owner Representation</span>
            </Link>
          </div>

          {/* Direct Phone Line */}
          <div className={styles.phoneTouchpoint}>
            <div className={styles.phoneMeta}>
              <span className={styles.phoneIcon} aria-hidden="true">☎</span>
              <span className={styles.phoneLabel}>Direct Telephone Consultation:</span>
            </div>
            <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
              {PRIMARY_PHONE}
            </a>
            <span className={styles.phoneSubtext}>Human brokerage team available Mon–Sat 9:30–18:30 IST</span>
          </div>
        </div>
      </div>
    </section>
  );
}
