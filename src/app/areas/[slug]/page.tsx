import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { VERIFIED_LOCALITIES } from '@/config/localities';
import styles from './locality.module.css';

interface LocalityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return VERIFIED_LOCALITIES.map((loc) => ({
    slug: loc.slug,
  }));
}

export async function generateMetadata({ params }: LocalityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locality = VERIFIED_LOCALITIES.find((l) => l.slug === slug);
  if (!locality) return { title: `Locality Not Found — ${CANONICAL_BRAND}` };

  return {
    title: `${locality.name} Property Advisory — ${CANONICAL_BRAND}`,
    description: `Verified micro-market intelligence for ${locality.name}, Bengaluru. Transit reality, zoning parameters, and bespoke acquisition advisory.`,
  };
}

export default async function LocalityPage({ params }: LocalityPageProps) {
  const { slug } = await params;
  const locality = VERIFIED_LOCALITIES.find((l) => l.slug === slug);

  if (!locality) {
    notFound();
  }

  return (
    <div className={styles.localityWrapper}>
      {/* Editorial Header */}
      <section className={styles.headerSection} aria-labelledby="loc-title">
        <div className={styles.container}>
          <div className={styles.breadcrumb}>
            <Link href="/areas" className={styles.bcLink}>Bengaluru Directory</Link>
            <span aria-hidden="true">/</span>
            <span className={styles.bcCurrent}>{locality.name}</span>
          </div>

          <div className={styles.metaRow}>
            <span className={styles.kicker}>{locality.quadrant}</span>
            <span className={styles.zoneBadge}>{locality.bbmpZone}</span>
            <span className={styles.gateBadge}>VERIFIED: {locality.reviewDate}</span>
          </div>

          <h1 id="loc-title" className={styles.heading}>
            {locality.name}
          </h1>

          <p className={styles.characterLead}>
            {locality.character}
          </p>
        </div>
      </section>

      {/* Main Analysis Body */}
      <div className={styles.container}>
        <div className={styles.contentLayout}>
          <div className={styles.mainColumn}>
            {/* Transit Infrastructure Breakdown */}
            <section className={styles.sectionBlock} aria-labelledby="transit-heading">
              <h2 id="transit-heading" className={styles.subHeading}>
                Transit &amp; Municipal Infrastructure
              </h2>
              <div className={styles.infraGrid}>
                <div className={styles.infraCard}>
                  <span className={styles.infraStatus}>OPERATIONAL TRANSIT</span>
                  <p className={styles.infraText}>{locality.transitOperational}</p>
                </div>
                <div className={styles.infraCard}>
                  <span className={styles.infraStatus}>UNDER CONSTRUCTION / PLANNED</span>
                  <p className={styles.infraText}>{locality.transitPlanned}</p>
                </div>
              </div>
            </section>

            {/* Typical Residential Profile */}
            <section className={styles.sectionBlock} aria-labelledby="profile-heading">
              <h2 id="profile-heading" className={styles.subHeading}>
                Residential Character &amp; Asset Typology
              </h2>
              <p className={styles.bodyText}>
                {locality.typicalResidentialTypology}
              </p>
            </section>

            {/* Advisory Focus */}
            <section className={styles.sectionBlock} aria-labelledby="focus-heading">
              <h2 id="focus-heading" className={styles.subHeading}>
                INSTLE Brokerage Diligence in {locality.name}
              </h2>
              <p className={styles.bodyText}>
                {locality.advisoryFocus}
              </p>
            </section>

            {/* Two-Source Claim Gate Register */}
            <section className={styles.sourceSection} aria-labelledby="sources-heading">
              <h3 id="sources-heading" className={styles.sourceHeading}>
                Authoritative Sources &amp; Governance
              </h3>
              <ul className={styles.sourceList}>
                {locality.sources.map((s, idx) => (
                  <li key={idx} className={styles.sourceItem}>
                    <strong>Source {idx + 1}:</strong> {s.title} ({s.ref})
                  </li>
                ))}
              </ul>
              <p className={styles.disclaimerText}>
                * All locality observations comply with the two-source claim gate. No unconfirmed commercial timelines or speculative market price trends are published.
              </p>
            </section>
          </div>

          {/* Sticky Sidebar CTA */}
          <aside className={styles.sidebarColumn} aria-label="Engage Advisory">
            <div className={styles.ctaBox}>
              <span className={styles.ctaBadge}>LOCALITY CONSULTATION</span>
              <h3 className={styles.ctaTitle}>
                Commission an Acquisition Brief for {locality.name}
              </h3>
              <p className={styles.ctaDesc}>
                Looking for an independent home, apartment, or plot in this enclave? Our team evaluates off-market opportunities directly.
              </p>
              <Link
                href={`/buy?locality=${locality.slug}`}
                className={styles.primaryAction}
              >
                Begin Acquisition Brief →
              </Link>
              <div className={styles.phoneDivider}>
                <span>OR SPEAK TO A BROKER DIRECTLY:</span>
                <a href={PRIMARY_PHONE_TEL} className={styles.phoneBtn}>
                  ☎ {PRIMARY_PHONE}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
