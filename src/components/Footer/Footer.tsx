import React from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLockup/BrandLockup';
import {
  CANONICAL_BRAND,
  NAV_GROUPS,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import { DOMAIN_STATUS } from '@/config/constants';
import { isDomainConfirmed } from '@/config/site';
import styles from './Footer.module.css';

/**
 * Site footer.
 *
 * Deliberately short. There is no keyword wall of locality links, no invented
 * office address, no business hours, and no social icons for accounts that have
 * not been confirmed.
 *
 * Requirement 8.6: at most 12 links, drawn only from the sections the header
 * renders plus one call action, and never an individual locality or guide. That
 * is the eleven `NAV_GROUPS` links the header's drawer renders, and the phone.
 * The brand lockup is plain text here rather than a thirteenth link home, and the
 * footer reads no registry, so its link count does not move as pages publish.
 * `auditFooterLinks` in `src/lib/internal-links.ts` states the rule and
 * `tests/internal-links.test.tsx` holds the rendered footer to it.
 */
export const Footer: React.FC<{ inert?: boolean }> = ({ inert = false }) => {
  const year = new Date().getFullYear();

  return (
    <footer className={`${styles.footer} surface-night`} inert={inert}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerTop}>
          <div className={styles.brandColumn}>
            <BrandLockup linked={false} />
            <p className={styles.descriptor}>
              Real estate brokerage in Bengaluru for buyers, sellers, tenants and landlords.
            </p>
            <p className={styles.contactLine}>
              Call{' '}
              <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
                {PRIMARY_PHONE}
              </a>{' '}
              to speak to the team.
            </p>
          </div>

          {NAV_GROUPS.map((group) => (
            <nav
              key={group.title ?? 'links'}
              className={styles.navColumn}
              aria-label={group.title ?? 'Footer links'}
            >
              <h2 className={styles.columnTitle}>{group.title}</h2>
              <ul className={styles.linkList}>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={styles.footerLink}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copyright}>
            © {year} {CANONICAL_BRAND}
          </p>
          {/*
            Development and preview builds show the domain status so a reviewer can
            see at a glance which SEO mode the build is in. It never renders once a
            domain is confirmed.
          */}
          {!isDomainConfirmed() && process.env.NODE_ENV !== 'production' ? (
            <p className={styles.buildNote}>Domain: {DOMAIN_STATUS} — preview build, not indexed.</p>
          ) : null}
        </div>
      </div>
    </footer>
  );
};
