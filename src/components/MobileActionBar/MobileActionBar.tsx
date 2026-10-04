'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './MobileActionBar.module.css';

/**
 * Sticky mobile actions: call, and send an enquiry.
 *
 * Two details that matter more than they look:
 *  - `body` reserves `--mobile-action-bar-space` in globals.css, so the bar never
 *    covers the last element of a page or a focused control at the bottom of a form.
 *  - The bar sits above the device safe area via `env(safe-area-inset-bottom)`.
 *
 * The enquiry destination follows the page the customer is on, so a landlord on
 * /rent-out is not sent to the buyer form.
 */

const ENQUIRY_PREFIXES = ['/sell', '/rent-out', '/rent', '/commercial', '/buy'] as const;

/**
 * The label stays the same on every page and on one line. A per-page label such
 * as "Commercial enquiry" wrapped to two lines at 390px, which made the fixed bar
 * taller than the space reserved for it in globals.css and pushed it over the
 * footer. The destination is page-aware; the wording does not need to be.
 */
function resolveEnquiryHref(pathname: string): string {
  const match = ENQUIRY_PREFIXES.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return match ? `${match}#enquiry` : '/contact';
}

export function MobileActionBar({ inert = false }: { inert?: boolean }) {
  const pathname = usePathname();

  return (
    <div className={`${styles.bar} surface-night`} inert={inert}>
      <a href={PRIMARY_PHONE_TEL} className={styles.callAction}>
        Call {PRIMARY_PHONE}
      </a>
      <Link href={resolveEnquiryHref(pathname)} className={styles.enquiryAction}>
        Send enquiry
      </Link>
    </div>
  );
}
