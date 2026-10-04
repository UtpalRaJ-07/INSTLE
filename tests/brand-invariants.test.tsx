/**
 * @vitest-environment jsdom
 */

/**
 * Rendered brand and contact invariants.
 *
 * This file previously rendered the page components directly and asserted against
 * an earlier component API. It has been rewritten for the current shell, and the
 * broad copy scanning it attempted now lives in tests/public-content.test.ts,
 * which reads every public source file rather than a hand-maintained list.
 *
 * What stays here is what can only be checked after rendering: that the header,
 * footer and lockup actually put the canonical brand and the canonical tel link
 * into the DOM.
 */

import React, { useState } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_BRAND,
  DOMAIN_STATUS,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  PROHIBITED_BRAND_TERMS,
} from '@/config/constants';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/buy',
}));

import { BrandLockup } from '@/components/BrandLockup/BrandLockup';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MobileActionBar } from '@/components/MobileActionBar/MobileActionBar';
import { SkipLink } from '@/components/SkipLink/SkipLink';

function HeaderHarness() {
  const [open, setOpen] = useState(false);
  return <Header isMenuOpen={open} onMenuOpenChange={setOpen} />;
}

afterEach(cleanup);

describe('constant invariants', () => {
  it('holds the exact canonical brand', () => {
    expect(CANONICAL_BRAND).toBe('INSTLE REAL ESTATE');
  });

  it('holds the exact phone digits and tel link', () => {
    expect(PRIMARY_PHONE).toBe('9353096264');
    expect(PRIMARY_PHONE_TEL).toBe('tel:9353096264');
  });

  it('keeps the domain unconfirmed', () => {
    expect(DOMAIN_STATUS).toBe('TO BE CONFIRMED');
  });
});

describe('rendered brand lockup', () => {
  it('renders the canonical brand exactly', () => {
    const { container } = render(<BrandLockup />);
    expect(container.textContent).toContain('INSTLE REAL ESTATE');
  });

  it('gives the lockup an accessible name pointing home', () => {
    const { container } = render(<BrandLockup />);
    const link = container.querySelector('a[href="/"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('aria-label')).toContain(CANONICAL_BRAND);
  });
});

describe('rendered header', () => {
  it('renders the brand and the phone digits', () => {
    const { container } = render(<HeaderHarness />);
    expect(container.textContent).toContain(CANONICAL_BRAND);
    expect(container.textContent).toContain(PRIMARY_PHONE);
  });

  it('links the phone with the exact unformatted tel value', () => {
    const { container } = render(<HeaderHarness />);
    const links = Array.from(container.querySelectorAll('a[href^="tel:"]'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(PRIMARY_PHONE_TEL);
    }
  });
});

describe('rendered footer', () => {
  it('renders the brand and a working phone link', () => {
    const { container } = render(<Footer />);
    expect(container.textContent).toContain(CANONICAL_BRAND);
    expect(container.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).not.toBeNull();
  });

  it('adds no unapproved legal disclaimer', () => {
    const { container } = render(<Footer />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('Disclaimer');
    expect(text).not.toContain('Terms and Conditions');
    expect(text).not.toMatch(/all information.*without warranty/i);
  });

  it('publishes no address or business hours', () => {
    const { container } = render(<Footer />);
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('bengaluru,');
    expect(text).not.toContain('am -');
    expect(text).not.toContain('monday');
  });
});

describe('mobile action bar', () => {
  it('offers exactly two actions: call and enquiry', () => {
    const { container } = render(<MobileActionBar />);
    const actions = container.querySelectorAll('a');
    expect(actions).toHaveLength(2);
    expect(container.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).not.toBeNull();
  });

  it('points the enquiry action at the page the customer is on', () => {
    // usePathname is mocked to '/buy'.
    const { container } = render(<MobileActionBar />);
    expect(container.querySelector('a[href="/buy#enquiry"]')).not.toBeNull();
  });
});

describe('skip link', () => {
  it('targets the main landmark', () => {
    const { container } = render(<SkipLink targetId="main-content" />);
    const link = container.querySelector('a');
    expect(link!.getAttribute('href')).toBe('#main-content');
    expect(link!.textContent).toMatch(/skip to main content/i);
  });
});

describe('no prohibited brand term or WhatsApp reference in rendered shell', () => {
  it('holds across the lockup, header, footer and action bar', () => {
    const html = [
      render(<BrandLockup />).container.innerHTML,
      render(<HeaderHarness />).container.innerHTML,
      render(<Footer />).container.innerHTML,
      render(<MobileActionBar />).container.innerHTML,
    ].join(' ');

    for (const term of PROHIBITED_BRAND_TERMS) {
      expect(html, `prohibited term ${term}`).not.toContain(term);
    }
    expect(html.toLowerCase()).not.toContain('whatsapp');
    expect(html.toLowerCase()).not.toContain('wa.me');
  });
});
