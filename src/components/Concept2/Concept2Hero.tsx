'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './Concept2Hero.module.css';

export function Concept2Hero() {
  const [activeIntent, setActiveIntent] = useState<'acquire' | 'represent'>('acquire');

  return (
    <section className={styles.heroSection} aria-labelledby="c2-hero-title">
      {/* Background Architectural Canvas */}
      <div className={styles.canvasContainer}>
        <Image
          src="/media/concept2-metropolitan-monolith.jpg"
          alt="Contemporary luxury residential building in Bengaluru with monolithic dark granite cantilevered balconies and illuminated glass curtain walls"
          width={1920}
          height={1080}
          priority
          className={styles.canvasImage}
        />
        <div className={styles.canvasScrim} />
      </div>

      <div className={styles.container}>
        {/* Technical HUD Banner */}
        <div className={styles.hudBadgeRow}>
          <div className={styles.hudTag}>
            <span className={styles.hudDot} aria-hidden="true" />
            <span>METROPOLITAN BROKERAGE INFRASTRUCTURE</span>
          </div>
          <span className={styles.hudMetric}>LAT: 12.9716° N / LON: 77.5946° E</span>
        </div>

        {/* Main Monolith Heading */}
        <div className={styles.headlineBlock}>
          <h1 id="c2-hero-title" className={styles.displayHeading}>
            PRECISION REAL ESTATE BROKERAGE FOR BENGALURU.
          </h1>
          <p className={styles.leadParagraph}>
            A service-led advisory model eliminating speculative public catalogues. We execute direct acquisition mandates, prime corporate leasing, and confidential owner representation.
          </p>
        </div>

        {/* Integrated Interactive Console Card */}
        <div className={styles.consoleCard}>
          <div className={styles.consoleHeader}>
            <span className={styles.consoleLabel}>SELECT OPERATING TRACK</span>
            <div className={styles.consoleTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeIntent === 'acquire'}
                className={`${styles.tabBtn} ${activeIntent === 'acquire' ? styles.tabActive : ''}`}
                onClick={() => setActiveIntent('acquire')}
              >
                01 // ACQUIRE &amp; LEASE
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeIntent === 'represent'}
                className={`${styles.tabBtn} ${activeIntent === 'represent' ? styles.tabActive : ''}`}
                onClick={() => setActiveIntent('represent')}
              >
                02 // OWNER MANDATE
              </button>
            </div>
          </div>

          <div className={styles.consoleBody}>
            {activeIntent === 'acquire' ? (
              <div className={styles.intentPanel}>
                <div className={styles.panelText}>
                  <strong className={styles.panelTitle}>Private Acquisition &amp; Executive Tenancies</strong>
                  <p className={styles.panelDesc}>
                    Define parameters across Bengaluru’s prime residential enclaves (Indiranagar, Koramangala, Sadashivanagar, Outer Ring Road). We research title records and arrange accompanied walkthroughs.
                  </p>
                </div>
                <div className={styles.panelActions}>
                  <Link href="/concept-2/intake" className={styles.launchBtn}>
                    <span>LAUNCH ACQUISITION CONSOLE</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className={styles.intentPanel}>
                <div className={styles.panelText}>
                  <strong className={styles.panelTitle}>Confidential Asset &amp; Portfolio Representation</strong>
                  <p className={styles.panelDesc}>
                    Direct brokerage representation for sellers and landlords. Connect with pre-qualified buyers and corporate tenants without public listing exposure.
                  </p>
                </div>
                <div className={styles.panelActions}>
                  <Link href="#representation" className={styles.launchBtn}>
                    <span>ENGAGE OWNER DESK</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Direct Phone Access Footer */}
            <div className={styles.consoleFooter}>
              <div className={styles.phoneGroup}>
                <span className={styles.phoneLabel}>IMMEDIATE ADVISORY ACCESS:</span>
                <a href={PRIMARY_PHONE_TEL} className={styles.phoneVal}>
                  ☎ {PRIMARY_PHONE}
                </a>
              </div>
              <span className={styles.hoursNotice}>Direct human connection · Mon–Sat 9:30–18:30 IST</span>
            </div>
          </div>
        </div>

        {/* Media rights note */}
        <p className={styles.assetCaption}>
          * Architectural reference: Conceptual study of contemporary Bengaluru residential monolithic granite and glass construction. Non-inventory visual asset.
        </p>
      </div>
    </section>
  );
}
