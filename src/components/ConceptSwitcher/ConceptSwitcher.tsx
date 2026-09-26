'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ConceptSwitcher.module.css';

interface ConceptSwitcherProps {
  currentConcept?: 'concept-1' | 'concept-2' | 'review';
}

export function ConceptSwitcher({ currentConcept }: ConceptSwitcherProps) {
  const pathname = usePathname();

  const isC1 = currentConcept === 'concept-1' || pathname.startsWith('/concept-1');
  const isC2 = currentConcept === 'concept-2' || pathname.startsWith('/concept-2');
  const isReview = currentConcept === 'review' || pathname.startsWith('/concept-review');

  return (
    <aside aria-label="Visual Concept Selector" className={styles.switcherBar}>
      <div className={styles.inner}>
        <div className={styles.metaBadge}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span className={styles.metaLabel}>DESIGN RESET PREVIEW</span>
        </div>

        <nav aria-label="Design Concept Options" className={styles.navGroup}>
          <Link
            href="/concept-1"
            className={`${styles.tabLink} ${isC1 && !pathname.includes('intake') ? styles.active : ''}`}
            aria-current={isC1 && !pathname.includes('intake') ? 'page' : undefined}
          >
            <span className={styles.conceptNum}>01</span>
            <span className={styles.conceptTitle}>Garden City Modernism</span>
          </Link>

          <Link
            href="/concept-1/intake"
            className={`${styles.tabLink} ${pathname === '/concept-1/intake' ? styles.active : ''}`}
            aria-current={pathname === '/concept-1/intake' ? 'page' : undefined}
          >
            <span className={styles.subBadge}>C1 Intake</span>
          </Link>

          <span className={styles.divider} aria-hidden="true" />

          <Link
            href="/concept-2"
            className={`${styles.tabLink} ${isC2 && !pathname.includes('intake') ? styles.active : ''}`}
            aria-current={isC2 && !pathname.includes('intake') ? 'page' : undefined}
          >
            <span className={styles.conceptNum}>02</span>
            <span className={styles.conceptTitle}>Metropolitan Monolith</span>
          </Link>

          <Link
            href="/concept-2/intake"
            className={`${styles.tabLink} ${pathname === '/concept-2/intake' ? styles.active : ''}`}
            aria-current={pathname === '/concept-2/intake' ? 'page' : undefined}
          >
            <span className={styles.subBadge}>C2 Intake</span>
          </Link>

          <span className={styles.divider} aria-hidden="true" />

          <Link
            href="/concept-review"
            className={`${styles.reviewLink} ${isReview ? styles.activeReview : ''}`}
            aria-current={isReview ? 'page' : undefined}
          >
            <span>Compare &amp; Recommend</span>
          </Link>
        </nav>
      </div>
    </aside>
  );
}
