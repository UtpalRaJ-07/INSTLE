'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Concept2Pillars.module.css';

const PILLARS = [
  {
    code: 'MOD-01',
    metric: 'OFF-MARKET & CURATED',
    title: 'Acquisition & Sourcing Engine',
    desc: 'Structured discovery across Bengaluru’s premier residential sectors. We bypass cluttered public aggregators, operating directly with owners and their representatives.',
    specs: [
      'Independent villas & prime apartments',
      'Cadastral & municipal zoning checks',
      'Accompanied senior broker walkthroughs',
    ],
    action: { label: 'OPEN ACQUISITIONS CONSOLE', href: '/concept-2/intake' },
  },
  {
    code: 'MOD-02',
    metric: 'RESIDENTIAL TENANCY',
    title: 'Executive Tenancy Advisory',
    desc: 'Dedicated relocation and leasing representation for corporate leaders, founders, and expatriates. Sourced exclusively within established gated enclaves and premium low-density projects.',
    specs: [
      'Indiranagar, Koramangala, Central & ORR',
      'Lease agreement structuring & scrutiny',
      'Direct landlord negotiations',
    ],
    action: { label: 'STATE TENANCY CRITERIA', href: '/concept-2/intake?intent=rent' },
  },
  {
    code: 'MOD-03',
    metric: 'DISCREET EXECUTION',
    title: 'Asset & Owner Representation',
    desc: 'Fiduciary representation for property owners and institutional landlords. Controlled private exposure, with buyer and tenant requirements discussed before any visit.',
    specs: [
      'No broadcast listings or signboards',
      'Pre-vetted counter-party credentials',
      'Legal & transaction coordination',
    ],
    action: { label: 'ENGAGE OWNER DESK', href: '/concept-2#representation' },
  },
];

export function Concept2Pillars() {
  return (
    <section className={styles.section} aria-labelledby="c2-pillars-title">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.metaRow}>
            <span className={styles.metaCode}>ARCHITECTURE // 02</span>
            <span className={styles.metaLabel}>THREE CORE OPERATIONAL CAPABILITIES</span>
          </div>
          <h2 id="c2-pillars-title" className={styles.title}>
            ENGINEERED FOR DISCRETION AND ACCURACY.
          </h2>
          <p className={styles.subtext}>
            Standard property portals profit from lead resale and inflated catalogues. INSTLE operates strictly on client representation, aligning brokerage incentives with the client&rsquo;s own objective.
          </p>
        </div>

        <div className={styles.grid}>
          {PILLARS.map((p) => (
            <article key={p.code} className={styles.card} aria-labelledby={`p-${p.code}`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardCode}>{p.code}</span>
                <span className={styles.cardMetric}>{p.metric}</span>
              </div>

              <h3 id={`p-${p.code}`} className={styles.cardTitle}>
                {p.title}
              </h3>

              <p className={styles.cardDesc}>{p.desc}</p>

              <div className={styles.specBox}>
                <span className={styles.specLabel}>OPERATIONAL PARAMETERS:</span>
                <ul className={styles.specList}>
                  {p.specs.map((item) => (
                    <li key={item} className={styles.specItem}>
                      <span className={styles.specBullet}>/</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.cardFooter}>
                <Link href={p.action.href} className={styles.actionBtn}>
                  <span>{p.action.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
