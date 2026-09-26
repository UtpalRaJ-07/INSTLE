import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  PROHIBITED_BRAND_TERMS,
} from '@/config/constants';
import {
  getPublishedLocalities,
  getPublishedLocalityBySlug,
  LOCALITY_REGISTRY,
} from '@/config/localities';
import {
  validateLeadPayload,
  processLeadEnquiry,
  checkRateLimit,
  stagingLeadStore,
  resetLeadOperationsForTesting,
} from '@/lib/lead-operations';
import { trackSafeEvent } from '@/lib/telemetry';
import { Concept1Hero } from '@/components/Concept1/Concept1Hero';
import { Concept1Pillars } from '@/components/Concept1/Concept1Pillars';
import { Concept1Gazetteer } from '@/components/Concept1/Concept1Gazetteer';
import { Concept1Methodology } from '@/components/Concept1/Concept1Methodology';
import { Concept1Footer } from '@/components/Concept1/Concept1Footer';
import { Concept1Intake } from '@/components/Concept1/Concept1Intake';
import { RentalIntake } from '@/components/RentalIntake/RentalIntake';
import { OwnerIntake } from '@/components/OwnerIntake/OwnerIntake';
import AboutPage from '@/app/about/page';

describe('Locality Publication Approval Gate & Claim Citations', () => {
  it('enforces that only approved published localities are exposed publicly', () => {
    const published = getPublishedLocalities();
    expect(published.length).toBeGreaterThanOrEqual(4);

    // Verify all published records meet the publication gate criteria
    for (const loc of published) {
      expect(loc.publicationStatus).toBe('published');
      expect(loc.reviewStatus).toBe('approved');
      expect(loc.editorialSignOffBy).toBeTruthy();
      expect(loc.lastReviewedAt).toBeTruthy();
    }

    // Verify that draft localities exist in the registry but are blocked from published output
    const drafts = LOCALITY_REGISTRY.filter((l) => l.publicationStatus === 'draft');
    expect(drafts.length).toBeGreaterThanOrEqual(1);
    for (const draft of drafts) {
      expect(published.find((p) => p.slug === draft.slug)).toBeUndefined();
      expect(getPublishedLocalityBySlug(draft.slug)).toBeUndefined();
    }
  });

  it('validates claim-level citations with specific factual claims and official references', () => {
    const published = getPublishedLocalities();
    for (const loc of published) {
      expect(loc.citations.length).toBeGreaterThanOrEqual(2);
      for (const citation of loc.citations) {
        expect(citation.claim.length).toBeGreaterThan(10);
        expect(citation.sourceName.length).toBeGreaterThan(5);
        expect(citation.referenceUrlOrDoc).toMatch(/^https?:\/\/|\.org|\.gov|\.co/);
        expect(citation.verificationDate).toBe('September 2026');
      }
    }
  });
});

describe('Lead Operations Pipeline, Runtime Validation & Staging Persistence', () => {
  beforeEach(() => {
    resetLeadOperationsForTesting();
  });

  it('rejects payloads with missing, false, or non-boolean DPDP consent', () => {
    const res1 = validateLeadPayload({
      intent: 'buy',
      name: 'Priya Sharma',
      phone: '9845012345',
      consent: false,
    });
    expect(res1.valid).toBe(false);
    expect(res1.errors.consent).toContain('DPDP consent');

    // String "false" must NOT be coerced to true!
    const res2 = validateLeadPayload({
      intent: 'buy',
      name: 'Priya Sharma',
      phone: '9845012345',
      consent: 'false',
    });
    expect(res2.valid).toBe(false);
    expect(res2.errors.consent).toContain('DPDP consent');
  });

  it('validates Indian 10-digit mobile numbers and rejects invalid phones', () => {
    const invalidPhoneRes = validateLeadPayload({
      intent: 'buy',
      name: 'Rohan Basavaraj',
      phone: '12345',
      consent: true,
    });
    expect(invalidPhoneRes.valid).toBe(false);
    expect(invalidPhoneRes.errors.phone).toContain('valid telephone number');

    const validPhoneRes = validateLeadPayload({
      intent: 'buy',
      name: 'Rohan Basavaraj',
      phone: '+91 98450 12345',
      consent: true,
    });
    expect(validPhoneRes.valid).toBe(true);
    expect(validPhoneRes.sanitizedPayload?.phone).toBe('9845012345');
  });

  it('persists complete customer details into staging memory store for brokerage follow-up', async () => {
    const valid = validateLeadPayload({
      intent: 'buy',
      assetType: 'Bespoke Townhome',
      localities: ['Indiranagar / Old Airport Road'],
      budgetBand: '₹5 Crore – ₹10 Crore',
      timeline: '1–3 Months',
      name: 'Kavitha Basavaraj',
      phone: '9845098765',
      consent: true,
    });

    expect(valid.valid).toBe(true);
    const result = await processLeadEnquiry(valid.sanitizedPayload!);

    expect(result.success).toBe(true);
    expect(result.leadId).toContain('IRE-BUY-');

    // Verify stored lead in staging store retains full customer contact & requirement
    const stored = stagingLeadStore.getRecord(result.leadId!);
    expect(stored).toBeDefined();
    expect(stored?.customer.name).toBe('Kavitha Basavaraj');
    expect(stored?.customer.phone).toBe('9845098765');
    expect(stored?.requirement.assetType).toBe('Bespoke Townhome');
    expect(stored?.requirement.localities).toContain('Indiranagar / Old Airport Road');
    expect(stored?.requirement.budgetBand).toBe('₹5 Crore – ₹10 Crore');
  });

  it('prevents duplicate submissions within 15-minute sliding window', async () => {
    const valid = validateLeadPayload({
      intent: 'rent',
      assetType: 'Gated Villa',
      localities: ['Koramangala'],
      budgetBand: '₹1,50,000 – ₹3,00,000 / month',
      timeline: 'Immediate (0–30 days)',
      name: 'Arjun Das',
      phone: '9353096264',
      consent: true,
    });

    const first = await processLeadEnquiry(valid.sanitizedPayload!);
    expect(first.success).toBe(true);
    expect(first.isDuplicate).toBe(false);

    // Immediate duplicate
    const second = await processLeadEnquiry(valid.sanitizedPayload!);
    expect(second.success).toBe(true);
    expect(second.isDuplicate).toBe(true);
    expect(second.leadId).toBe(first.leadId);
  });

  it('enforces rate limiting of 5 requests per 10 minutes per client', () => {
    const clientId = 'test-client-ip-1';
    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(clientId);
      expect(res.allowed).toBe(true);
    }
    const blockedRes = checkRateLimit(clientId);
    expect(blockedRes.allowed).toBe(false);
  });

  it('enforces strict runtime allowlist in telemetry discarding any PII fields', () => {
    const rawTelemetryInput = {
      intent: 'buy',
      step: 3,
      name: 'Sensitive Customer Name',
      phone: '9845012345',
      budgetBand: '₹10 Cr',
      extraMaliciousKey: '<script>alert(1)</script>',
    };

    const tracked = trackSafeEvent('form_step_complete', rawTelemetryInput);

    expect(tracked.event).toBe('form_step_complete');
    expect(tracked.intent).toBe('buy');
    expect(tracked.step).toBe(3);

    // Disallowed keys must be stripped at runtime!
    expect((tracked as Record<string, unknown>).name).toBeUndefined();
    expect((tracked as Record<string, unknown>).phone).toBeUndefined();
    expect((tracked as Record<string, unknown>).budgetBand).toBeUndefined();
    expect((tracked as Record<string, unknown>).extraMaliciousKey).toBeUndefined();
  });
});

describe('Component Rendering, Clean Invariants & Distinct Customer Journeys', () => {
  it('renders distinct Buyer, Rental, and Owner intake journeys with clean initial states', () => {
    // Buyer Intake: starts with empty selections, not prefilled luxury budget
    const buyerIntake = render(<Concept1Intake />).container;
    expect(buyerIntake.textContent).toContain('Share Your Purchase Requirement');
    expect(buyerIntake.textContent).not.toContain('LOCAL PREVIEW RECEIPT');

    // Rental Intake: distinct tenancy journey
    const rentalIntake = render(<RentalIntake />).container;
    expect(rentalIntake.textContent).toContain('Share Your Rental Requirement');
    expect(rentalIntake.textContent).toContain('Preferred Residence Typology');
    expect(rentalIntake.textContent).toContain('Gated Community Apartment');

    // Owner Intake: distinct toggle for sell vs lease
    const ownerIntake = render(<OwnerIntake />).container;
    expect(ownerIntake.textContent).toContain('Sell Property');
    expect(ownerIntake.textContent).toContain('Lease to Tenant');
  });

  it('renders Concept 1 components with strict canonical brand and telephone invariants', () => {
    const hero = render(<Concept1Hero />).container;
    const pillars = render(<Concept1Pillars />).container;
    const gazetteer = render(<Concept1Gazetteer />).container;
    const methodology = render(<Concept1Methodology />).container;
    const footer = render(<Concept1Footer />).container;
    const about = render(<AboutPage />).container;

    const allHtml = [
      hero.innerHTML,
      pillars.innerHTML,
      gazetteer.innerHTML,
      methodology.innerHTML,
      footer.innerHTML,
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

    // Assert zero internal blueprint codes in visitor-facing about page
    expect(about.textContent).not.toContain('BLUEPRINT D-01');
    expect(about.textContent).not.toContain('BLUEPRINT D-02');
  });
});
