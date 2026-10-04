'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isPrototypeRoute } from '@/config/constants';
import { ConceptSwitcher } from '@/components/ConceptSwitcher/ConceptSwitcher';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MobileActionBar } from '@/components/MobileActionBar/MobileActionBar';

/**
 * The homepage's opening film, in its own chunk. It is still server-rendered
 * with the homepage, so it paints on the first frame; every other route skips
 * its script entirely.
 */
const BrandIntro = dynamic(() => import('@/components/BrandIntro/BrandIntro').then((module) => module.BrandIntro));

/**
 * Public site shell.
 *
 * The mobile navigation open state lives here rather than inside the header so
 * that `main` and `footer` can be marked `inert` while the drawer is open. That
 * is what actually prevents interaction with the obscured background — a backdrop
 * alone stops mouse clicks but leaves the content reachable by keyboard and
 * assistive technology.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  /**
   * The drawer's open state is stored alongside the route it was opened on, and
   * reset during render when the route changes. That covers browser back and
   * forward navigation, where no click handler runs, without a state update
   * inside an effect.
   */
  const [menu, setMenu] = useState({ open: false, pathname });
  if (menu.pathname !== pathname) {
    setMenu({ open: false, pathname });
  }
  const isMenuOpen = menu.open;

  const setIsMenuOpen = useCallback(
    (open: boolean) => setMenu((previous) => ({ ...previous, open })),
    []
  );

  useEffect(() => {
    if (!isMenuOpen) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [isMenuOpen]);

  if (isPrototypeRoute(pathname)) {
    // Private design material renders its own chrome.
    return (
      <>
        <ConceptSwitcher />
        {children}
      </>
    );
  }

  return (
    <>
      {/* The homepage's opening film: an aria-hidden layer over the page, with
          nothing focusable in it, so the skip link stays the first stop. */}
      {pathname === '/' ? <BrandIntro /> : null}
      <Header isMenuOpen={isMenuOpen} onMenuOpenChange={setIsMenuOpen} />
      <main id="main-content" tabIndex={-1} inert={isMenuOpen}>
        {children}
      </main>
      <Footer inert={isMenuOpen} />
      <MobileActionBar inert={isMenuOpen} />
    </>
  );
}
