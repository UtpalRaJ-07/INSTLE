import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { Concept1Methodology } from '@/components/Concept1/Concept1Methodology';
import styles from './how-it-works.module.css';

export const metadata: Metadata = {
  title: `How ${CANONICAL_BRAND} Operates — Advisory Methodology`,
  description:
    'Our human-led brokerage methodology in Bengaluru. Learn how requirement intake, off-market research, and DPDP-compliant representation work.',
};

export default function HowItWorksPage() {
  return (
    <div className={styles.methodologyWrapper}>
      {/* Intro Hero */}
      <section className={styles.introSection} aria-labelledby="methodology-heading">
        <div className={styles.container}>
          <span className={styles.kicker}>ADVISORY METHODOLOGY</span>
          <h1 id="methodology-heading" className={styles.heading}>
            How {CANONICAL_BRAND} Operates
          </h1>
          <p className={styles.lead}>
            A structured human brokerage model designed for discerning clients. We eliminate public inventory scrapers, lead resale, and unvetted property feeds in favor of accountable advisory representation.
          </p>
        </div>
      </section>

      {/* 4-Stage Methodology Breakdown */}
      <Concept1Methodology />

      {/* The Non-Portal Difference */}
      <section className={styles.differenceSection} aria-labelledby="diff-heading">
        <div className={styles.container}>
          <h2 id="diff-heading" className={styles.diffTitle}>
            Why a Service-Led Model Over a Public Listing Portal?
          </h2>

          <div className={styles.diffGrid}>
            <div className={styles.diffCard}>
              <h3 className={styles.cardHeading}>Service-Led Sourcing</h3>
              <p className={styles.cardText}>
                We maintain no public inventory database. Properties are evaluated directly in response to specific client briefs, eliminating stale catalogues and outdated listings.
              </p>
            </div>

            <div className={styles.diffCard}>
              <h3 className={styles.cardHeading}>Data Minimization &amp; Privacy</h3>
              <p className={styles.cardText}>
                We do not sell client contact details to third-party telemarketers or broadcast requirements to multi-broker networks. All communication adheres to Indian privacy principles.
              </p>
            </div>

            <div className={styles.diffCard}>
              <h3 className={styles.cardHeading}>Accountable Human Advisory</h3>
              <p className={styles.cardText}>
                From initial intake through accompanied walkthroughs, you work with an accountable brokerage partner responsible for requirement coordination and transaction guidance.
              </p>
            </div>
          </div>

          <div className={styles.ctaBanner}>
            <div className={styles.bannerContent}>
              <h3 className={styles.bannerTitle}>Ready to discuss your Bengaluru property requirement?</h3>
              <p className={styles.bannerText}>
                Call our advisory desk directly or share your requirements online.
              </p>
            </div>
            <div className={styles.bannerActions}>
              <a href={PRIMARY_PHONE_TEL} className={styles.phoneActionBtn}>
                ☎ Call {PRIMARY_PHONE}
              </a>
              <Link href="/buy" className={styles.briefActionBtn}>
                Share Requirement →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
