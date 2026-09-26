import React from 'react';
import Link from 'next/link';
import { CANONICAL_BRAND } from '@/config/constants';
import styles from './BrandLockup.module.css';

export interface BrandLockupProps {
  className?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ className = '' }) => {
  return (
    <Link href="/" className={`${styles.lockup} ${className}`} aria-label={`${CANONICAL_BRAND} home`}>
      <span className={styles.brandName}>{CANONICAL_BRAND}</span>
      <span className={styles.tagline}>BENGALURU</span>
    </Link>
  );
};
