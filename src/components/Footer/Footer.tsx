import React from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLockup/BrandLockup';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL, PRIMARY_NAV_ITEMS } from '@/config/constants';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerTop}>
          <div className={styles.brandColumn}>
            <BrandLockup />
            <p className={styles.descriptor}>
              Bengaluru Real Estate Brokerage & Property Advisory Platform
            </p>
          </div>

          <div className={styles.navColumn}>
            <h2 className={styles.columnTitle}>Navigation</h2>
            <ul className={styles.linkList}>
              {PRIMARY_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={styles.footerLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.contactColumn}>
            <h2 className={styles.columnTitle}>Direct Inquiries</h2>
            <div className={styles.contactItem}>
              <span className={styles.contactLabel}>Primary Phone:</span>
              <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
                {PRIMARY_PHONE}
              </a>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copyright}>
            © 2026 {CANONICAL_BRAND}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
