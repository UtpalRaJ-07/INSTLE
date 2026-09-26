import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { Concept1Header } from '@/components/Concept1/Concept1Header';
import { Concept1Hero } from '@/components/Concept1/Concept1Hero';
import { Concept1Pillars } from '@/components/Concept1/Concept1Pillars';
import { Concept1Gazetteer } from '@/components/Concept1/Concept1Gazetteer';
import { Concept1Methodology } from '@/components/Concept1/Concept1Methodology';
import { Concept1Footer } from '@/components/Concept1/Concept1Footer';

export const metadata: Metadata = {
  title: `Concept 1: Garden City Modernism — ${CANONICAL_BRAND}`,
  description:
    'Visual Concept 1 for INSTLE REAL ESTATE: Architectural Dossier & Garden City Modernism. Human-led property advisory in Bengaluru.',
};

export default function Concept1Page() {
  return (
    <>
      <Concept1Header />
      <main id="main-content" tabIndex={-1}>
        <Concept1Hero />
        <Concept1Pillars />
        <Concept1Gazetteer />
        <Concept1Methodology />
      </main>
      <Concept1Footer />
    </>
  );
}
