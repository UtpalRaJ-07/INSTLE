import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS, validateLeadPayload, validatePhone } from '@/lib/enquiry-schema';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    intent: 'buy',
    assetType: 'flat',
    preferredAreas: ['Jayanagar'],
    budgetBand: '50-lakh-to-1-crore',
    timeline: '1-to-3-months',
    contactPreference: 'phone-call',
    name: 'Test Person',
    phone: '9845012345',
    consent: true,
    ...overrides,
  };
}

describe('validatePhone', () => {
  it('accepts a ten-digit Indian mobile number', () => {
    expect(validatePhone('9845012345')).toMatchObject({ valid: true, normalised: '9845012345' });
  });

  it('accepts spacing and punctuation', () => {
    expect(validatePhone(' 98450 12345 ')).toMatchObject({ valid: true, normalised: '9845012345' });
  });

  it('normalises the 91 and +91 prefixes and a leading zero', () => {
    expect(validatePhone('+919845012345').normalised).toBe('9845012345');
    expect(validatePhone('919845012345').normalised).toBe('9845012345');
    expect(validatePhone('09845012345').normalised).toBe('9845012345');
  });

  // The previous implementation accepted any 10-to-15 digit string.
  it('rejects a ten-digit string that is not a valid Indian mobile number', () => {
    expect(validatePhone('0000000000').valid).toBe(false);
    expect(validatePhone('1234567890').valid).toBe(false);
    expect(validatePhone('5555555555').valid).toBe(false);
  });

  it('rejects an eleven-digit domestic typo rather than reading it as a foreign number', () => {
    expect(validatePhone('98450123456').valid).toBe(false);
  });

  it('accepts an explicit international number from a supported country', () => {
    expect(validatePhone('+971501234567')).toMatchObject({ valid: true, countryCode: '971' });
    expect(validatePhone('+6591234567')).toMatchObject({ valid: true, countryCode: '65' });
    expect(validatePhone('+442079460958')).toMatchObject({ valid: true, countryCode: '44' });
  });

  it('rejects an international number from an unsupported country code', () => {
    expect(validatePhone('+2991234567')).toMatchObject({
      valid: false,
      reason: 'unsupported-country-code',
    });
  });

  it('requires an explicit plus for a non-Indian number', () => {
    expect(validatePhone('971501234567').valid).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(validatePhone('')).toMatchObject({ valid: false, reason: 'required' });
    expect(validatePhone(undefined)).toMatchObject({ valid: false, reason: 'required' });
  });
});

describe('validateLeadPayload', () => {
  it('accepts a well-formed payload', () => {
    const result = validateLeadPayload(validPayload());
    expect(result.errors).toEqual({});
    expect(result.valid).toBe(true);
    expect(result.sanitizedPayload?.phone).toBe('9845012345');
  });

  it('rejects a non-object body', () => {
    expect(validateLeadPayload(null).valid).toBe(false);
    expect(validateLeadPayload('string').valid).toBe(false);
    expect(validateLeadPayload([]).valid).toBe(false);
  });

  // Consent must be a literal boolean true. A truthy string is not consent.
  it('requires consent to be exactly true', () => {
    for (const value of [false, 'true', 1, 'yes', undefined, null]) {
      const result = validateLeadPayload(validPayload({ consent: value }));
      expect(result.valid, `consent ${String(value)} must be rejected`).toBe(false);
      expect(result.errors.consent).toBeTruthy();
    }
  });

  it('never preselects marketing permission', () => {
    const result = validateLeadPayload(validPayload());
    expect(result.sanitizedPayload?.marketingConsent).toBe(false);
  });

  it('keeps marketing permission separate and optional', () => {
    const result = validateLeadPayload(validPayload({ marketingConsent: true }));
    expect(result.sanitizedPayload?.marketingConsent).toBe(true);
  });

  it('rejects a non-boolean marketing permission', () => {
    expect(validateLeadPayload(validPayload({ marketingConsent: 'yes' })).valid).toBe(false);
  });

  it('rejects an unknown intent', () => {
    expect(validateLeadPayload(validPayload({ intent: 'invest' })).errors.intent).toBeTruthy();
  });

  it('rejects an unknown asset type', () => {
    expect(validateLeadPayload(validPayload({ assetType: 'houseboat' })).errors.assetType).toBeTruthy();
  });

  // The service matrix says a residential site cannot be rented, so the API must
  // refuse the combination even if a client sends it.
  it('rejects an intent and asset combination the brokerage does not handle', () => {
    const result = validateLeadPayload(
      validPayload({ intent: 'rent', assetType: 'plot', budgetBand: undefined })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.assetType).toBeTruthy();
  });

  it('rejects a free-text budget value', () => {
    expect(validateLeadPayload(validPayload({ budgetBand: '₹80 lakh-ish' })).valid).toBe(false);
  });

  it('rejects a free-text timeline value', () => {
    expect(validateLeadPayload(validPayload({ timeline: 'soon' })).valid).toBe(false);
  });

  it('requires an ownership role for owner-side intents', () => {
    const sell = validateLeadPayload(
      validPayload({ intent: 'sell', ownershipRole: undefined })
    );
    expect(sell.errors.ownershipRole).toBeTruthy();

    const rentOut = validateLeadPayload(
      validPayload({ intent: 'rent-out', assetType: 'flat', budgetBand: undefined, ownershipRole: undefined })
    );
    expect(rentOut.errors.ownershipRole).toBeTruthy();
  });

  it('bounds the number of preferred areas and the length of each', () => {
    const result = validateLeadPayload(
      validPayload({
        preferredAreas: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'x'.repeat(200)],
      })
    );
    expect(result.sanitizedPayload?.preferredAreas).toHaveLength(FIELD_LIMITS.areaCountMax);
    for (const area of result.sanitizedPayload?.preferredAreas ?? []) {
      expect(area.length).toBeLessThanOrEqual(FIELD_LIMITS.areaItemMax);
    }
  });

  it('rejects a non-array preferredAreas', () => {
    expect(validateLeadPayload(validPayload({ preferredAreas: 'Jayanagar' })).valid).toBe(false);
  });

  it('truncates notes rather than storing unbounded free text', () => {
    const result = validateLeadPayload(validPayload({ notes: 'x'.repeat(2000) }));
    expect(result.sanitizedPayload?.notes).toHaveLength(FIELD_LIMITS.notesMax);
  });

  it('bounds the name and rejects markup characters', () => {
    expect(validateLeadPayload(validPayload({ name: 'A' })).errors.name).toBeTruthy();
    expect(
      validateLeadPayload(validPayload({ name: '<script>alert(1)</script>' })).errors.name
    ).toBeTruthy();
    const long = validateLeadPayload(validPayload({ name: 'N'.repeat(500) }));
    expect(long.sanitizedPayload?.name).toHaveLength(FIELD_LIMITS.nameMax);
  });

  it('rejects an idempotency key containing anything other than url-safe characters', () => {
    expect(validateLeadPayload(validPayload({ idempotencyKey: 'abc/../def' })).valid).toBe(false);
    expect(validateLeadPayload(validPayload({ idempotencyKey: 'abc-123_XYZ' })).valid).toBe(true);
  });

  it('never echoes a submitted value back in an error message', () => {
    const result = validateLeadPayload(
      validPayload({ phone: '0000000000', budgetBand: 'SECRET-VALUE-9999' })
    );
    const messages = Object.values(result.errors).join(' ');
    expect(messages).not.toContain('SECRET-VALUE-9999');
    expect(messages).not.toContain('0000000000');
  });
});
