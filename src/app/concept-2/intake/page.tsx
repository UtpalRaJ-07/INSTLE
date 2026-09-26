import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { Concept2Header } from '@/components/Concept2/Concept2Header';
import { Concept2Intake } from '@/components/Concept2/Concept2Intake';
import { Concept2Footer } from '@/components/Concept2/Concept2Footer';

export const metadata: Metadata = {
  title: `[INTERNAL PREVIEW] Advisory Desk Console Preview — ${CANONICAL_BRAND} (Concept 2)`,
  description:
    'Internal prototype: Institutional matrix intake preview for INSTLE REAL ESTATE Concept 2.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Concept2IntakePage() {
  return (
    <>
      <Concept2Header />
      <main id="main-content" tabIndex={-1}>
        <Concept2Intake />
      </main>
      <Concept2Footer />
    </>
  );
}
