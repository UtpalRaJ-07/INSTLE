import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: `About ${CANONICAL_BRAND} — Advisory Mandate`,
  description:
    'The advisory philosophy and operating principles of INSTLE REAL ESTATE in Bengaluru. Service-led brokerage, privacy governance, and human representation.',
};

export default function AboutPage() {
  return (
    <div className={styles.aboutWrapper}>
      <section className={styles.introSection} aria-labelledby="about-heading">
        <div className={styles.container}>
          <span className={styles.kicker}>ORGANIZATIONAL PURPOSE</span>
          <h1 id="about-heading" className={styles.heading}>
            Service-Led Real Estate Brokerage in Bengaluru
          </h1>
          <p className={styles.lead}>
            {CANONICAL_BRAND} is established as an advisory-first real estate brokerage platform. We represent buyers, tenants, and property owners through direct human engagement, rejecting the inflated listing scrapers and lead resale that characterize standard property portals.
          </p>
        </div>
      </section>

      <section className={styles.principlesSection} aria-labelledby="principles-heading">
        <div className={styles.container}>
          <h2 id="principles-heading" className={styles.subHeading}>
            Our Operating Principles
          </h2>

          <div className={styles.principlesGrid}>
            <div className={styles.principleCard}>
              <span className={styles.pNum}>01</span>
              <h3 className={styles.pTitle}>Client Representation Over Catalogue Volume</h3>
              <p className={styles.pText}>
                We do not manufacture sample listings or publish unverified inventory to simulate market scale. Every property reviewed by our brokerage is investigated specifically for an active client mandate.
              </p>
            </div>

            <div className={styles.principleCard}>
              <span className={styles.pNum}>02</span>
              <h3 className={styles.pTitle}>Ground-Level Bengaluru Diligence</h3>
              <p className={styles.pText}>
                Our advisory is rooted in the physical and legal realities of Bengaluru: cadastral boundaries, municipal sanctions, water source security, and operational vs. planned transit infrastructure.
              </p>
            </div>

            <div className={styles.principleCard}>
              <span className={styles.pNum}>03</span>
              <h3 className={styles.pTitle}>Data Privacy &amp; Anti-Spam Governance</h3>
              <p className={styles.pText}>
                Your contact details and financial capacity are never monetized, traded, or shared with third-party telemarketers. We operate in strict alignment with India DPDP Act 2023 principles.
              </p>
            </div>
          </div>

          {/* Corporate Profile Note */}
          <div className={styles.holdingNote}>
            <span className={styles.noteTag}>CORPORATE GOVERNANCE</span>
            <h4 className={styles.noteTitle}>Brokerage Mandate &amp; Professional Standards</h4>
            <p className={styles.noteText}>
              {CANONICAL_BRAND} operates as a human-led residential real estate brokerage and advisory practice in Bengaluru. Formal statutory disclosures and credentials are coordinated in accordance with applicable regulatory frameworks and are available upon formal client engagement. For all direct consultations, contact our central brokerage desk at {PRIMARY_PHONE}.
            </p>
          </div>

          <div className={styles.actionRow}>
            <a href={PRIMARY_PHONE_TEL} className={styles.primaryBtn}>
              ☎ Speak with Advisory Lead: {PRIMARY_PHONE}
            </a>
            <Link href="/contact" className={styles.secondaryBtn}>
              Advisory Contact Channels →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
