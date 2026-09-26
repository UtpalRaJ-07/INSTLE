'use client';

import React from 'react';
import Link from 'next/link';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  DOMAIN_STATUS,
} from '@/config/constants';
import styles from './Concept1Footer.module.css';

export function Concept1Footer() {
  return (
    <footer className={styles.footer} id="contact" aria-label="Site Footer">
      <div className={styles.container}>
        <div className={styles.topSection}>
          <div className={styles.brandBlock}>
            <span className={styles.brandTitle}>{CANONICAL_BRAND}</span>
            <p className={styles.brandMission}>
              Service-led real estate brokerage &amp; property advisory platform for buyers, tenants, and property owners in Bengaluru.
            </p>
            <div className={styles.phoneGroup}>
              <span className={styles.phoneLabel}>Direct Brokerage Telephone:</span>
              <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
                {PRIMARY_PHONE}
              </a>
            </div>
          </div>

          <div className={styles.linksGrid}>
            <div className={styles.linkCol}>
              <span className={styles.colTitle}>SERVICES</span>
              <ul className={styles.linkList}>
                <li>
                  <Link href="/buy" className={styles.link}>
                    Buy a Home
                  </Link>
                </li>
                <li>
                  <Link href="/rent" className={styles.link}>
                    Rent a Residence
                  </Link>
                </li>
                <li>
                  <Link href="/sell" className={styles.link}>
                    Sell / Lease Property
                  </Link>
                </li>
              </ul>
            </div>

            <div className={styles.linkCol}>
              <span className={styles.colTitle}>LOCALITIES</span>
              <ul className={styles.linkList}>
                <li>
                  <Link href="/areas/indiranagar" className={styles.link}>
                    Indiranagar
                  </Link>
                </li>
                <li>
                  <Link href="/areas/koramangala" className={styles.link}>
                    Koramangala
                  </Link>
                </li>
                <li>
                  <Link href="/areas/sadashivanagar" className={styles.link}>
                    Sadashivanagar
                  </Link>
                </li>
                <li>
                  <Link href="/areas/north-bengaluru" className={styles.link}>
                    North Bengaluru
                  </Link>
                </li>
              </ul>
            </div>

            <div className={styles.linkCol}>
              <span className={styles.colTitle}>PRACTICE</span>
              <ul className={styles.linkList}>
                <li>
                  <Link href="/how-it-works" className={styles.link}>
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/about" className={styles.link}>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className={styles.link}>
                    Contact
                  </Link>
                </li>
                <li>
                  <span className={styles.statusMuted}>Domain: {DOMAIN_STATUS}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} {CANONICAL_BRAND}. All rights reserved.
          </p>
          <div className={styles.legalLinks}>
            <span>Bengaluru Real Estate Advisory</span>
            <span>·</span>
            <span>Non-Portal Brokerage Model</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
