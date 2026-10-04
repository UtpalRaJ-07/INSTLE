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
              Real estate brokerage in Bengaluru for buyers, tenants, sellers and landlords.
            </p>
            <div className={styles.phoneGroup}>
              <span className={styles.phoneLabel}>Call Our Team:</span>
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
                    Buy Property
                  </Link>
                </li>
                <li>
                  <Link href="/rent" className={styles.link}>
                    Rent a Home
                  </Link>
                </li>
                <li>
                  <Link href="/sell" className={styles.link}>
                    Sell or Rent Out Property
                  </Link>
                </li>
              </ul>
            </div>

            <div className={styles.linkCol}>
              <span className={styles.colTitle}>AREAS</span>
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
              <span className={styles.colTitle}>COMPANY</span>
              <ul className={styles.linkList}>
                <li>
                  <Link href="/how-it-works" className={styles.link}>
                    How We Help
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
            <span>Bengaluru Real Estate Brokerage</span>
            <span>·</span>
            <span>Direct Client Representation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
