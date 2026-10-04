import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { Concept1Header } from '@/components/Concept1/Concept1Header';
import { Concept1Intake } from '@/components/Concept1/Concept1Intake';
import { Concept1Footer } from '@/components/Concept1/Concept1Footer';
import { assertPrototypeAccessAllowed } from '@/lib/prototype-guard';

export const metadata: Metadata = {
  title: `[INTERNAL PREVIEW] Acquisition Brief Preview — ${CANONICAL_BRAND} (Concept 1)`,
  description:
    'Internal prototype: Stepped Acquisition Brief preview for INSTLE REAL ESTATE Concept 1.',
  robots: {
    index: false,
    follow: false,
  },
};

// Rendered per request so the production 404 guard cannot be frozen into a
// prerendered page by a build that ran with a different environment.
export const dynamic = 'force-dynamic';

export default function Concept1IntakePage() {
  // Private design material: 404 in a production deployment.
  assertPrototypeAccessAllowed();

  return (
    <>
      <Concept1Header />
      <main id="main-content" tabIndex={-1}>
        <Concept1Intake />
      </main>
      <Concept1Footer />
    </>
  );
}
