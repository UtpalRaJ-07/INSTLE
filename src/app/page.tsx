import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { Concept1Hero } from '@/components/Concept1/Concept1Hero';
import { Concept1Pillars } from '@/components/Concept1/Concept1Pillars';
import { Concept1Gazetteer } from '@/components/Concept1/Concept1Gazetteer';
import { Concept1Methodology } from '@/components/Concept1/Concept1Methodology';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: `${CANONICAL_BRAND} — Bengaluru Real Estate Brokerage & Property Advisory Platform`,
  description:
    'Human-led real estate brokerage and property advisory service for buyers, tenants, sellers, and landlords in Bengaluru. Grounded in local micro-market intelligence.',
};

export default function HomePage() {
  return (
    <div className={styles.homeWrapper}>
      <Concept1Hero />
      <Concept1Pillars />
      <Concept1Gazetteer />
      <Concept1Methodology />
    </div>
  );
}
