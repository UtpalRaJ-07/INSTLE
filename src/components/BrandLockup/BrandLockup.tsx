import React from 'react';
import Link from 'next/link';
import { CANONICAL_BRAND } from '@/config/constants';
import styles from './BrandLockup.module.css';

export interface BrandLockupProps {
  className?: string;
  /**
   * Whether the lockup links home. The header's does. The footer's does not: the
   * footer is held to 12 links drawn from the header's sections plus one call action
   * (Requirement 8.6), and a second home link would spend one of them on a
   * destination the header already offers at the top of every page.
   */
  linked?: boolean;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ className = '', linked = true }) => {
  const content = (
    <>
      {/* data-lockup-part is where the homepage intro lands each word. */}
      <span className={styles.brandName} data-lockup-part="name">
        {CANONICAL_BRAND}
      </span>
      <span className={styles.tagline} data-lockup-part="place">
        BENGALURU
      </span>
    </>
  );

  if (!linked) {
    return <span className={`${styles.lockup} ${className}`}>{content}</span>;
  }

  return (
    <Link href="/" className={`${styles.lockup} ${className}`} aria-label={`${CANONICAL_BRAND} home`}>
      {content}
    </Link>
  );
};
