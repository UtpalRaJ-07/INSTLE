'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ConceptSwitcher } from '@/components/ConceptSwitcher/ConceptSwitcher';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isConceptRoute =
    pathname.startsWith('/concept-1') ||
    pathname.startsWith('/concept-2') ||
    pathname.startsWith('/concept-review');

  return (
    <>
      {isConceptRoute ? (
        <>
          <ConceptSwitcher />
          {children}
        </>
      ) : (
        <>
          <Header />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </>
      )}
    </>
  );
}
