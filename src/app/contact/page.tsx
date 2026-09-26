import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: `Contact Advisory Desk — ${CANONICAL_BRAND}`,
  description:
    'Direct telephone and digital communication with INSTLE REAL ESTATE in Bengaluru. Connect at 9353096264 for property advisory and client representation.',
};

export default function ContactPage() {
  return (
    <div className={styles.contactWrapper}>
      <section className={styles.introSection} aria-labelledby="contact-heading">
        <div className={styles.container}>
          <span className={styles.kicker}>DIRECT COMMUNICATIONS</span>
          <h1 id="contact-heading" className={styles.heading}>
            Connect with {CANONICAL_BRAND}
          </h1>
          <p className={styles.lead}>
            To discuss property requirements or owner representation in Bengaluru, connect directly with our brokerage team by telephone or share a tailored digital brief.
          </p>
        </div>
      </section>

      <section className={styles.contentSection} aria-label="Contact Channels">
        <div className={styles.container}>
          <div className={styles.channelsGrid}>
            {/* Primary Phone Box */}
            <div className={styles.phoneBox}>
              <span className={styles.boxTag}>DIRECT TELEPHONE DESK</span>
              <h2 className={styles.phoneHeading}>Voice Consultation</h2>
              <p className={styles.boxText}>
                Speak directly with a member of our brokerage team for guidance regarding Bengaluru residential micro-markets.
              </p>
              <a href={PRIMARY_PHONE_TEL} className={styles.bigPhoneLink}>
                ☎ {PRIMARY_PHONE}
              </a>
              <div className={styles.hoursMeta}>
                <span>Desk Connection: Direct phone access to brokerage team</span>
                <span>Focus Areas: Indiranagar, Koramangala, Sadashivanagar &amp; North Bengaluru</span>
              </div>
            </div>

            {/* Digital Briefs Box */}
            <div className={styles.briefBox}>
              <span className={styles.boxTag}>DIGITAL REQUIREMENT INTAKE</span>
              <h2 className={styles.boxHeading}>Share Your Requirement</h2>
              <p className={styles.boxText}>
                Prefer to outline spatial and capital parameters online before a phone consultation? Select your service pathway:
              </p>

              <div className={styles.trackList}>
                <Link href="/buy" className={styles.trackLink}>
                  <div className={styles.trackInfo}>
                    <strong>Buy a Home</strong>
                    <span>Independent residences, boutique apartments &amp; plots</span>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>

                <Link href="/rent" className={styles.trackLink}>
                  <div className={styles.trackInfo}>
                    <strong>Rent a Residence</strong>
                    <span>Executive leasing and corporate tenancy advisory</span>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>

                <Link href="/sell" className={styles.trackLink}>
                  <div className={styles.trackInfo}>
                    <strong>Sell or Lease Property</strong>
                    <span>Discreet representation for property owners and landlords</span>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Privacy and Boundaries */}
          <div className={styles.boundaryCard}>
            <h3 className={styles.boundaryTitle}>Communications &amp; Privacy Boundary</h3>
            <p className={styles.boundaryText}>
              In accordance with Indian privacy principles (DPDP Act 2023), personal contact details shared during phone consultations or digital briefs are utilized solely for direct advisory communication by {CANONICAL_BRAND}. We do not operate unsolicited telemarketing, automated promotional calls, or third-party lead resale.
            </p>
            <p className={styles.boundarySubtext}>
              * Physical consultations are scheduled by prior appointment. Corporate address disclosures are maintained in accordance with applicable statutory registration filings.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
