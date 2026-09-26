import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: `Contact Advisory Desk — ${CANONICAL_BRAND}`,
  description:
    'Direct telephone and digital communication with INSTLE REAL ESTATE in Bengaluru. Connect at 9353096264 for acquisition briefs and owner mandates.',
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
            To discuss property requirements or owner representation in Bengaluru, connect directly with our brokerage team by telephone or submit a tailored digital brief.
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
                Speak directly with an assigned member of our brokerage team for immediate guidance regarding Bengaluru micro-markets.
              </p>
              <a href={PRIMARY_PHONE_TEL} className={styles.bigPhoneLink}>
                ☎ {PRIMARY_PHONE}
              </a>
              <div className={styles.hoursMeta}>
                <span>Operational Hours: Monday – Saturday, 09:30 – 18:30 IST</span>
                <span>Location Coverage: Bengaluru Metropolitan Region</span>
              </div>
            </div>

            {/* Digital Briefs Box */}
            <div className={styles.briefBox}>
              <span className={styles.boxTag}>DIGITAL INTAKE TRACKS</span>
              <h2 className={styles.boxHeading}>Structured Requirements</h2>
              <p className={styles.boxText}>
                Prefer to share spatial and capital parameters online before a phone consultation? Select the appropriate pathway:
              </p>

              <div className={styles.trackList}>
                <Link href="/buy" className={styles.trackLink}>
                  <div className={styles.trackInfo}>
                    <strong>Commission Acquisition Brief</strong>
                    <span>Independent homes, luxury residences &amp; land parcels</span>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>

                <Link href="/rent" className={styles.trackLink}>
                  <div className={styles.trackInfo}>
                    <strong>Prime Tenancy Brief</strong>
                    <span>Executive leasing and corporate relocation</span>
                  </div>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                </Link>

                <Link href="/sell" className={styles.trackLink}>
                  <div className={styles.trackInfo}>
                    <strong>Owner Representation Mandate</strong>
                    <span>Discreet sale and landlord leasing representation</span>
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
              In accordance with the India DPDP Act 2023, personal data shared during phone calls or digital briefs is utilized strictly for direct brokerage communication by {CANONICAL_BRAND}. We do not operate unsolicited telemarketing, automated promotional robocalls, or third-party lead distribution networks.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
