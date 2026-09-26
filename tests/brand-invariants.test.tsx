import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  DOMAIN_STATUS,
  PROHIBITED_BRAND_TERMS,
} from '@/config/constants';
import { BrandLockup } from '@/components/BrandLockup/BrandLockup';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import HomePage from '@/app/page';
import BuyPage from '@/app/buy/page';
import RentPage from '@/app/rent/page';
import SellPage from '@/app/sell/page';
import AreasPage from '@/app/areas/page';
import HowItWorksPage from '@/app/how-it-works/page';
import ContactPage from '@/app/contact/page';
import { IntentRail } from '@/components/IntentRail/IntentRail';
import { ProcessSteps } from '@/components/ProcessSteps/ProcessSteps';
import { OwnerSection } from '@/components/OwnerSection/OwnerSection';
import { ContactBand } from '@/components/ContactBand/ContactBand';

describe('Brand & Contact Invariants (Strict Enforcement)', () => {
  it('enforces exact canonical brand spelling and all-caps casing', () => {
    expect(CANONICAL_BRAND).toBe('INSTLE REAL ESTATE');
    expect(CANONICAL_BRAND).not.toBe('Instle Real Estate');
    expect(CANONICAL_BRAND).not.toBe('Instle');
    expect(CANONICAL_BRAND).not.toBe('LUXERE');
  });

  it('enforces primary phone digits and tel link format without WhatsApp assumption', () => {
    expect(PRIMARY_PHONE).toBe('9353096264');
    expect(PRIMARY_PHONE_TEL).toBe('tel:9353096264');
  });

  it('enforces that domain remains TO BE CONFIRMED', () => {
    expect(DOMAIN_STATUS).toBe('TO BE CONFIRMED');
  });

  it('renders exact canonical brand in BrandLockup', () => {
    const { container } = render(<BrandLockup />);
    expect(container.textContent).toContain('INSTLE REAL ESTATE');
  });

  it('renders exact canonical brand and phone in Header', () => {
    const { container } = render(<Header />);
    expect(container.textContent).toContain('INSTLE REAL ESTATE');
    expect(container.textContent).toContain('9353096264');

    const phoneLink = container.querySelector('a[href="tel:9353096264"]');
    expect(phoneLink).toBeInTheDocument();
  });

  it('renders exact canonical brand, phone, and zero unapproved disclaimers in Footer', () => {
    const { container } = render(<Footer />);
    expect(container.textContent).toContain('INSTLE REAL ESTATE');
    expect(container.textContent).toContain('9353096264');

    const phoneLink = container.querySelector('a[href="tel:9353096264"]');
    expect(phoneLink).toBeInTheDocument();

    // Verify no unapproved legal disclaimer exists
    expect(container.textContent).not.toContain('Disclaimer:');
    expect(container.textContent).not.toContain('Legal Disclaimer');
  });

  it('ensures no prohibited brand names appear in rendered components', () => {
    const brandLockup = render(<BrandLockup />).container.innerHTML;
    const header = render(<Header />).container.innerHTML;
    const footer = render(<Footer />).container.innerHTML;
    const home = render(<HomePage />).container.innerHTML;

    const allRenderedHtml = `${brandLockup} ${header} ${footer} ${home}`;

    for (const term of PROHIBITED_BRAND_TERMS) {
      expect(allRenderedHtml).not.toContain(term);
    }

    // Ensure zero references to WhatsApp
    expect(allRenderedHtml.toLowerCase()).not.toContain('whatsapp');
    expect(allRenderedHtml.toLowerCase()).not.toContain('wa.me');
  });

  it('ensures no internal status phrases or unapproved claims appear across any route or component', () => {
    const renderedRoutes = [
      render(<HomePage />).container.innerHTML,
      render(<BuyPage />).container.innerHTML,
      render(<RentPage />).container.innerHTML,
      render(<SellPage />).container.innerHTML,
      render(<AreasPage />).container.innerHTML,
      render(<HowItWorksPage />).container.innerHTML,
      render(<ContactPage />).container.innerHTML,
      render(<IntentRail />).container.innerHTML,
      render(<ProcessSteps />).container.innerHTML,
      render(<OwnerSection />).container.innerHTML,
      render(<ContactBand />).container.innerHTML,
    ].join(' ');

    const forbiddenPhrases = [
      'under preparation',
      'milestone',
      'verified access',
      'verified options',
      'verified residential leasing',
      'confidential brokerage',
      'qualified market matching',
      'process boundary',
      'boundarynote',
      'across the city',
      'viewing coordination',
      'accountable brokers',
      'rental options',
      'realistic options',
      'commute patterns',
      'local infrastructure',
    ];

    for (const phrase of forbiddenPhrases) {
      expect(renderedRoutes.toLowerCase()).not.toContain(phrase);
    }
  });
});
