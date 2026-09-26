import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { getPublishedLocalities, getPublishedLocalityBySlug } from '@/config/localities';
import styles from './locality.module.css';

interface LocalityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPublishedLocalities().map((loc) => ({
    slug: loc.slug,
  }));
}

export async function generateMetadata({ params }: LocalityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locality = getPublishedLocalityBySlug(slug);
  if (!locality) return { title: `Locality Not Found — ${CANONICAL_BRAND}` };

  return {
    title: `${locality.name} Property Advisory — ${CANONICAL_BRAND}`,
    description: `Micro-market intelligence for ${locality.name}, Bengaluru. Transit infrastructure, zoning parameters, and bespoke client advisory.`,
  };
}

export default async function LocalityPage({ params }: LocalityPageProps) {
  const { slug } = await params;
  const locality = getPublishedLocalityBySlug(slug);

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
            <span className={styles.gateBadge}>Reviewed: {locality.lastReviewedAt}</span>
          </div>

          <h1 id="loc-title" className={styles.heading}>
            {locality.name}
          </h1>

          <p className={styles.characterLead}>
            {locality.character}
          </p>
        </div>
      </section>

      {/* Main Body Dossier */}
      <div className={styles.dossierContainer}>
        <div className={styles.twoColumnGrid}>
          {/* Main Intelligence Column */}
          <div className={styles.intelColumn}>
            {/* Transit Infrastructure Realities */}
            <section className={styles.sectionBlock} aria-labelledby="transit-heading">
              <h2 id="transit-heading" className={styles.subHeading}>
                Transit &amp; Arterial Road Reality
              </h2>
              <div className={styles.factCard}>
                <div className={styles.factRow}>
                  <strong className={styles.factKey}>Operational Transit:</strong>
                  <span>{locality.transitOperational}</span>
                </div>
                <div className={styles.factRow}>
                  <strong className={styles.factKey}>Under Construction / Planned:</strong>
                  <span>{locality.transitPlanned}</span>
                </div>
              </div>
            </section>

            {/* Residential Typologies */}
            <section className={styles.sectionBlock} aria-labelledby="typology-heading">
              <h2 id="typology-heading" className={styles.subHeading}>
                Prevalent Residential Typologies
              </h2>
              <p className={styles.bodyText}>
                {locality.typicalResidentialTypology}
              </p>
            </section>

            {/* Advisory Focus */}
            <section className={styles.sectionBlock} aria-labelledby="focus-heading">
              <h2 id="focus-heading" className={styles.subHeading}>
                Advisory Guidance in {locality.name}
              </h2>
              <p className={styles.bodyText}>
                {locality.advisoryFocus}
              </p>
            </section>

            {/* Citations & Municipal References */}
            <section className={styles.sourceSection} aria-labelledby="sources-heading">
              <h3 id="sources-heading" className={styles.sourceHeading}>
                Authoritative Sources &amp; Municipal Citations
              </h3>
              <ul className={styles.sourceList}>
                {locality.citations.map((c, idx) => (
                  <li key={idx} className={styles.sourceItem}>
                    <strong>Claim {idx + 1}:</strong> {c.claim}
                    <div className={styles.sourceCiteMeta}>
                      <span>Source: {c.sourceName}</span>
                      <span>·</span>
                      <span>Reference: {c.referenceUrlOrDoc}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className={styles.disclaimerText}>
                * Published observations are cross-referenced with public municipal and transit records. No speculative pricing or unverified development dates are published.
              </p>
            </section>
          </div>

          {/* Sidebar CTA */}
          <aside className={styles.sidebarColumn} aria-label="Engage Advisory">
            <div className={styles.ctaBox}>
              <span className={styles.ctaBadge}>LOCALITY CONSULTATION</span>
              <h3 className={styles.ctaTitle}>
                Discuss Property in {locality.name}
              </h3>
              <p className={styles.ctaDesc}>
                Seeking an independent house, apartment, or plot in this micro-market? Connect with our desk directly or submit your requirement.
              </p>
              <Link
                href={`/buy?locality=${locality.slug}`}
                className={styles.primaryAction}
              >
                Share Buyer Requirement →
              </Link>
              <div className={styles.phoneDivider}>
                <span>OR TELEPHONE DIRECTLY:</span>
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
