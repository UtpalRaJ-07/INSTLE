'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Concept1Pillars.module.css';

export function Concept1Pillars() {
  return (
    <section className={styles.section} aria-labelledby="c1-pillars-title">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.eyebrow}>
            <span>SERVICE STRUCTURE · ADVISORY PILLARS</span>
          </div>
          <h2 id="c1-pillars-title" className={styles.sectionTitle}>
            Three deliberate advisory disciplines. Grounded in Bengaluru property diligence.
          </h2>
          <p className={styles.sectionLead}>
            Rather than maintaining an unverified catalogue of public listings, we operate on dedicated human briefs. Each client mandate receives rigorous market research, physical reconnaissance, and accountable transaction coordination.
          </p>
        </div>

        <div className={styles.dossierGrid}>
          {/* Featured Large Dossier: Acquisition */}
          <article className={styles.dossierFeatured} aria-labelledby="dossier-01-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>DISCIPLINE 01</span>
              <span className={styles.dossierScope}>RESIDENTIAL ACQUISITIONS</span>
            </div>

            <h3 id="dossier-01-title" className={styles.dossierTitle}>
              Private Acquisition Representation
            </h3>

            <p className={styles.dossierText}>
              Tailored brokerage for individuals, families, and family offices acquiring prime residential real estate in Bengaluru. We bridge fragmented market inventory through discreet off-market enquiry, zoning checks, and verified documentation review.
            </p>

            <ul className={styles.serviceList} aria-label="Acquisition Advisory Scope">
              <li className={styles.serviceItem}>
                <span className={styles.bullet} aria-hidden="true">—</span>
                <span>Independent villas, master-planned enclaves &amp; residential plots</span>
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.bullet} aria-hidden="true">—</span>
                <span>Direct owner outreach &amp; multi-channel verification</span>
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.bullet} aria-hidden="true">—</span>
                <span>Bengaluru civic &amp; cadastral boundary cross-referencing</span>
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.bullet} aria-hidden="true">—</span>
                <span>Accompanied private inspections &amp; negotiation stewardship</span>
              </li>
            </ul>

            <div className={styles.dossierAction}>
              <Link href="/buy" className={styles.dossierLink}>
                <span>Share Buyer Requirement</span>
                <span className={styles.arrow} aria-hidden="true">→</span>
              </Link>
            </div>
          </article>

          {/* Complementary Dossier 02: Prime Tenancy */}
          <article className={styles.dossierCard} id="tenancies" aria-labelledby="dossier-02-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>DISCIPLINE 02</span>
              <span className={styles.dossierScope}>RESIDENTIAL LEASING</span>
            </div>

            <h3 id="dossier-02-title" className={styles.dossierTitle}>
              Prime Residential Tenancies
            </h3>

            <p className={styles.dossierText}>
              Representing corporate executives, senior professionals, and relocating families seeking residences in Bengaluru’s premier residential communities.
            </p>

            <div className={styles.cardFeatures}>
              <span className={styles.featureBadge}>Gated Enclaves</span>
              <span className={styles.featureBadge}>Central Penthouses</span>
              <span className={styles.featureBadge}>Executive Villas</span>
            </div>

            <div className={styles.dossierAction}>
              <Link href="/rent" className={styles.secondaryLink}>
                <span>Share Rental Requirement →</span>
              </Link>
            </div>
          </article>

          {/* Complementary Dossier 03: Owner Mandates */}
          <article className={styles.dossierCard} id="owner-mandates" aria-labelledby="dossier-03-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>DISCIPLINE 03</span>
              <span className={styles.dossierScope}>OWNER REPRESENTATION</span>
            </div>

            <h3 id="dossier-03-title" className={styles.dossierTitle}>
              Owner &amp; Landlord Representation
            </h3>

            <p className={styles.dossierText}>
              Discreet brokerage representation for property owners seeking qualified buyers or vetted corporate tenants without broadcast marketing or unvetted footfall.
            </p>

            <div className={styles.cardFeatures}>
              <span className={styles.featureBadge}>Confidential Sourcing</span>
              <span className={styles.featureBadge}>Counterparty Vetting</span>
              <span className={styles.featureBadge}>Deal Governance</span>
            </div>

            <div className={styles.dossierAction}>
              <Link href="/sell" className={styles.secondaryLink}>
                <span>Represent Property →</span>
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
