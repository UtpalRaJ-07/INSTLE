import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { Concept2Header } from '@/components/Concept2/Concept2Header';
import { Concept2Hero } from '@/components/Concept2/Concept2Hero';
import { Concept2Pillars } from '@/components/Concept2/Concept2Pillars';
import { Concept2Matrix } from '@/components/Concept2/Concept2Matrix';
import { Concept2Methodology } from '@/components/Concept2/Concept2Methodology';
import { Concept2Footer } from '@/components/Concept2/Concept2Footer';

export const metadata: Metadata = {
  title: `Concept 2: Metropolitan Monolith — ${CANONICAL_BRAND}`,
  description:
    'Visual Concept 2 for INSTLE REAL ESTATE: Bengaluru Metropolitan Monolith & Precision Console. High-precision brokerage advisory.',
};

export default function Concept2Page() {
  return (
    <>
      <Concept2Header />
      <main id="main-content" tabIndex={-1}>
        <Concept2Hero />
        <Concept2Pillars />
        <Concept2Matrix />
        <Concept2Methodology />
      </main>
      <Concept2Footer />
    </>
  );
}
