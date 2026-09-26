'use client';

import React from 'react';
import Link from 'next/link';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  DOMAIN_STATUS,
} from '@/config/constants';
import styles from './Concept2Footer.module.css';

export function Concept2Footer() {
  return (
    <footer className={styles.footer} id="contact" aria-label="Site Footer">
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <span className={styles.brandTitle}>{CANONICAL_BRAND}</span>
            <p className={styles.brandDesc}>
              High-precision real estate advisory &amp; brokerage platform. Direct client representation across Bengaluru’s premier urban corridors.
            </p>
            <div className={styles.phoneBlock}>
              <span className={styles.phoneLabel}>DIRECT TELEPHONE DESK //</span>
              <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
                {PRIMARY_PHONE}
              </a>
            </div>
          </div>

          <div className={styles.linkCol}>
            <span className={styles.colTitle}>TRACKS //</span>
            <ul className={styles.list}>
              <li><Link href="/concept-2/intake" className={styles.link}>Acquisitions Console</Link></li>
              <li><Link href="/concept-2#tenancies" className={styles.link}>Executive Tenancies</Link></li>
              <li><Link href="/concept-2#representation" className={styles.link}>Owner Mandates</Link></li>
            </ul>
          </div>

          <div className={styles.linkCol}>
            <span className={styles.colTitle}>CORRIDORS //</span>
            <ul className={styles.list}>
              <li><Link href="/concept-2#corridors" className={styles.link}>Indiranagar (SEC-E01)</Link></li>
              <li><Link href="/concept-2#corridors" className={styles.link}>Koramangala (SEC-SE02)</Link></li>
              <li><Link href="/concept-2#corridors" className={styles.link}>Hebbal Axis (SEC-N03)</Link></li>
              <li><Link href="/concept-2#corridors" className={styles.link}>Sadashivanagar (SEC-C04)</Link></li>
            </ul>
          </div>

          <div className={styles.linkCol}>
            <span className={styles.colTitle}>SYSTEM //</span>
            <ul className={styles.list}>
              <li><Link href="/concept-2#methodology" className={styles.link}>Execution Pipeline</Link></li>
              <li><span className={styles.monoStatus}>DOMAIN: {DOMAIN_STATUS}</span></li>
              <li><span className={styles.monoStatus}>SECURITY: ZERO-PII TELEMETRY</span></li>
              <li><span className={styles.monoStatus}>COMPLIANCE: DPDP ACT 2023</span></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <span className={styles.copyright}>
            © {new Date().getFullYear()} {CANONICAL_BRAND}. ALL RIGHTS RESERVED.
          </span>
          <span className={styles.specNotice}>
            NON-PORTAL BROKERAGE ARCHITECTURE · BENGALURU
          </span>
        </div>
      </div>
    </footer>
  );
}
