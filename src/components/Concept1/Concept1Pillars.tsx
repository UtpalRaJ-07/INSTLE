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
            <span>OUR SERVICES</span>
          </div>
          <h2 id="c1-pillars-title" className={styles.sectionTitle}>
            How we can help you with Bengaluru property
          </h2>
          <p className={styles.sectionLead}>
            Whether you want to buy, rent, sell or rent out property in Bengaluru, our brokerage team is here to assist you with honest guidance and direct discussions.
          </p>
        </div>

        <div className={styles.dossierGrid}>
          {/* Service 1: Buy property */}
          <article className={styles.dossierCard} aria-labelledby="service-buy-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>01. BUY</span>
              <span className={styles.dossierScope}>HOMES &amp; SITES</span>
            </div>

            <h3 id="service-buy-title" className={styles.dossierTitle}>
              Buy Property
            </h3>

            <p className={styles.dossierText}>
              Tell us what you are looking for, your preferred area and your budget. We assist you with flats, independent houses, villas and residential plots across Bengaluru.
            </p>

            <div className={styles.cardFeatures}>
              <span className={styles.featureBadge}>Flats / Apartments</span>
              <span className={styles.featureBadge}>Independent Houses</span>
              <span className={styles.featureBadge}>Villas</span>
              <span className={styles.featureBadge}>Sites / Plots</span>
            </div>

            <div className={styles.dossierAction}>
              <Link href="/buy" className={styles.dossierLink}>
                <span>I want to buy →</span>
              </Link>
            </div>
          </article>

          {/* Service 2: Rent a home */}
          <article className={styles.dossierCard} aria-labelledby="service-rent-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>02. RENT</span>
              <span className={styles.dossierScope}>HOMES FOR TENANTS</span>
            </div>

            <h3 id="service-rent-title" className={styles.dossierTitle}>
              Rent a Home
            </h3>

            <p className={styles.dossierText}>
              Tell us where you want to stay, your monthly rent budget and when you plan to move. We help families and professionals find suitable homes with clear lease terms.
            </p>

            <div className={styles.cardFeatures}>
              <span className={styles.featureBadge}>Gated Communities</span>
              <span className={styles.featureBadge}>Family Homes</span>
              <span className={styles.featureBadge}>Quiet Layouts</span>
            </div>

            <div className={styles.dossierAction}>
              <Link href="/rent" className={styles.dossierLink}>
                <span>I want to rent →</span>
              </Link>
            </div>
          </article>

          {/* Service 3: Sell property */}
          <article className={styles.dossierCard} aria-labelledby="service-sell-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>03. SELL</span>
              <span className={styles.dossierScope}>FOR PROPERTY OWNERS</span>
            </div>

            <h3 id="service-sell-title" className={styles.dossierTitle}>
              Sell Property
            </h3>

            <p className={styles.dossierText}>
              Share your property type, area and when you would like to sell. We speak to interested buyers about their budget and requirement before arranging any visit.
            </p>

            <div className={styles.cardFeatures}>
              <span className={styles.featureBadge}>Buyer Conversations</span>
              <span className={styles.featureBadge}>Price Discussion</span>
              <span className={styles.featureBadge}>Paperwork Guidance</span>
            </div>

            <div className={styles.dossierAction}>
              <Link href="/sell" className={styles.dossierLink}>
                <span>I want to sell →</span>
              </Link>
            </div>
          </article>

          {/* Service 4: Rent out property */}
          <article className={styles.dossierCard} aria-labelledby="service-lease-title">
            <div className={styles.dossierMeta}>
              <span className={styles.dossierTag}>04. RENT OUT</span>
              <span className={styles.dossierScope}>FOR LANDLORDS</span>
            </div>

            <h3 id="service-lease-title" className={styles.dossierTitle}>
              Rent Out Property
            </h3>

            <p className={styles.dossierText}>
              Share your property details and when the property is available. We speak to prospective tenants about their requirement before arranging a visit. This is a filtering conversation, not a background check.
            </p>

            <div className={styles.cardFeatures}>
              <span className={styles.featureBadge}>Tenant Conversations</span>
              <span className={styles.featureBadge}>Lease Agreements</span>
              <span className={styles.featureBadge}>Smooth Handover</span>
            </div>

            <div className={styles.dossierAction}>
              <Link href="/sell" className={styles.dossierLink}>
                <span>I want to rent out →</span>
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
