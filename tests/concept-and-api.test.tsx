import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  PROHIBITED_BRAND_TERMS,
} from '@/config/constants';
import { VERIFIED_LOCALITIES } from '@/config/localities';
import { processSyntheticEnquiry } from '@/lib/lead-operations';
import { Concept1Hero } from '@/components/Concept1/Concept1Hero';
import { Concept1Pillars } from '@/components/Concept1/Concept1Pillars';
import { Concept1Gazetteer } from '@/components/Concept1/Concept1Gazetteer';
import { Concept1Methodology } from '@/components/Concept1/Concept1Methodology';
import { Concept1Footer } from '@/components/Concept1/Concept1Footer';
import { Concept1Intake } from '@/components/Concept1/Concept1Intake';
import { OwnerIntake } from '@/components/OwnerIntake/OwnerIntake';
import AboutPage from '@/app/about/page';

describe('Concept 1 & Lead Operations Verification', () => {
  it('enforces that all verified localities have two-source citations', () => {
    expect(VERIFIED_LOCALITIES.length).toBeGreaterThanOrEqual(4);
    for (const loc of VERIFIED_LOCALITIES) {
      expect(loc.sources.length).toBeGreaterThanOrEqual(2);
      expect(loc.reviewDate).toBe('September 2026');
      expect(loc.bbmpZone).toBeTruthy();
    }
  });

  it('enforces synthetic lead queue validation and duplicate prevention', () => {
    // 1. Mandatory consent failure
    const failConsent = processSyntheticEnquiry({
      intent: 'buy',
      assetType: 'Villa',
      name: 'Test Client',
      phone: '9845012345',
      consent: false,
    });
    expect(failConsent.success).toBe(false);
    expect(failConsent.error).toContain('DPDP consent');

    // 2. Successful enquiry
    const pass = processSyntheticEnquiry({
      intent: 'buy',
      assetType: 'Villa',
      name: 'Test Client',
      phone: '9845012345',
      consent: true,
      idempotencyKey: 'test-key-1',
    });
    expect(pass.success).toBe(true);
    expect(pass.leadId).toContain('IRE-SYN-');
    expect(pass.isDuplicate).toBe(false);

    // 3. Duplicate detection within sliding window
    const dup = processSyntheticEnquiry({
      intent: 'buy',
      assetType: 'Villa',
      name: 'Test Client',
      phone: '9845012345',
      consent: true,
      idempotencyKey: 'test-key-1',
    });
    expect(dup.success).toBe(true);
    expect(dup.leadId).toBe(pass.leadId);
    expect(dup.isDuplicate).toBe(true);
  });

  it('renders Concept 1 components with strict canonical brand and phone', () => {
    const hero = render(<Concept1Hero />).container;
    const pillars = render(<Concept1Pillars />).container;
    const gazetteer = render(<Concept1Gazetteer />).container;
    const methodology = render(<Concept1Methodology />).container;
    const footer = render(<Concept1Footer />).container;
    const intake = render(<Concept1Intake />).container;
    const ownerIntake = render(<OwnerIntake />).container;
    const about = render(<AboutPage />).container;

    const allHtml = [
      hero.innerHTML,
      pillars.innerHTML,
      gazetteer.innerHTML,
      methodology.innerHTML,
      footer.innerHTML,
      intake.innerHTML,
      ownerIntake.innerHTML,
      about.innerHTML,
    ].join(' ');

    // Assert canonical brand
    expect(footer.textContent).toContain(CANONICAL_BRAND);
    expect(hero.textContent).toContain(PRIMARY_PHONE);

    // Assert phone links
    expect(footer.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).toBeInTheDocument();
    expect(hero.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).toBeInTheDocument();

    // Assert zero prohibited terms
    for (const term of PROHIBITED_BRAND_TERMS) {
      expect(allHtml).not.toContain(term);
    }

    // Assert zero WhatsApp
    expect(allHtml.toLowerCase()).not.toContain('whatsapp');
    expect(allHtml.toLowerCase()).not.toContain('wa.me');
  });
});
