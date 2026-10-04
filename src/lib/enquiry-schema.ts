/**
 * Server-side enquiry validation.
 *
 * Every optional field is an enum rather than free text, strings are bounded,
 * arrays are bounded, and the intent/asset combination is checked against the
 * service matrix so a client cannot submit a requirement the brokerage has said
 * it does not handle.
 */

import type { CustomerIntent } from '@/config/constants';
import { getAssetType, getCoverage, type AssetTypeId } from '@/config/service-matrix';
import type {
  BudgetBandId,
  ContactPreferenceId,
  FurnishingId,
  LeadPayload,
  OwnershipRoleId,
  RentBandId,
  TimelineId,
} from './lead-types';

export const INTENTS: readonly CustomerIntent[] = [
  'buy',
  'rent',
  'sell',
  'rent-out',
  'commercial',
  'general',
] as const;

export const BUDGET_BANDS: readonly BudgetBandId[] = [
  'under-50-lakh',
  '50-lakh-to-1-crore',
  '1-to-2-5-crore',
  '2-5-to-5-crore',
  'above-5-crore',
  'prefer-to-discuss',
] as const;

export const RENT_BANDS: readonly RentBandId[] = [
  'under-15000',
  '15000-to-30000',
  '30000-to-60000',
  '60000-to-1-lakh',
  'above-1-lakh',
  'prefer-to-discuss',
] as const;

export const TIMELINES: readonly TimelineId[] = [
  'within-30-days',
  '1-to-3-months',
  '3-to-6-months',
  'later',
  'not-decided',
] as const;

export const FURNISHING_OPTIONS: readonly FurnishingId[] = [
  'unfurnished',
  'semi-furnished',
  'fully-furnished',
  'no-preference',
] as const;

export const OWNERSHIP_ROLES: readonly OwnershipRoleId[] = [
  'owner',
  'co-owner',
  'authorised-representative',
  'other',
] as const;

export const CONTACT_PREFERENCES: readonly ContactPreferenceId[] = [
  'phone-call',
  'phone-call-morning',
  'phone-call-evening',
] as const;

export const CONFIGURATIONS = [
  '1 BHK',
  '2 BHK',
  '3 BHK',
  '4 BHK',
  '5 BHK or larger',
  'Not decided',
] as const;

export const FIELD_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  areaItemMax: 60,
  areaCountMax: 5,
  notesMax: 400,
  idempotencyKeyMax: 100,
} as const;

/**
 * Country codes accepted for non-Indian numbers.
 *
 * The master prompt asks for validation that does not "exclude legitimate
 * non-Indian customers by accident", so an explicit international form is
 * supported — but only with a real country code, not any 10-to-15 digit string.
 */
export const SUPPORTED_COUNTRY_CALLING_CODES = [
  '91', // India
  '1', // US / Canada
  '44', // United Kingdom
  '61', // Australia
  '65', // Singapore
  '971', // United Arab Emirates
  '966', // Saudi Arabia
  '968', // Oman
  '974', // Qatar
  '973', // Bahrain
  '965', // Kuwait
  '60', // Malaysia
  '49', // Germany
  '33', // France
  '41', // Switzerland
  '31', // Netherlands
  '353', // Ireland
  '64', // New Zealand
  '81', // Japan
  '852', // Hong Kong
] as const;

export interface PhoneValidation {
  valid: boolean;
  /** Digits only, without country code for Indian numbers. */
  normalised: string | null;
  /** Country calling code when the number was supplied in international form. */
  countryCode: string | null;
  reason?: string;
}

/**
 * Validate a phone number.
 *
 * Indian mobile numbers: exactly ten digits starting 6, 7, 8 or 9, optionally
 * with a 91 or +91 prefix or a leading 0.
 * Other countries: must be written with a leading '+' and a supported country
 * calling code, followed by 6 to 14 further digits.
 */
export function validatePhone(raw: unknown): PhoneValidation {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { valid: false, normalised: null, countryCode: null, reason: 'required' };
  }

  const trimmed = raw.trim();
  const isInternationalForm = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');

  if (digits.length === 0) {
    return { valid: false, normalised: null, countryCode: null, reason: 'no-digits' };
  }

  const indianCore = /^[6-9]\d{9}$/;

  /**
   * The international branch is checked FIRST when the customer wrote a '+'.
   * Otherwise a genuine foreign number could be misread as Indian: +65 9123 4567
   * is ten digits beginning with 6, which matches the Indian mobile pattern
   * exactly. Honouring the '+' the customer typed resolves the ambiguity.
   */
  if (isInternationalForm) {
    const matched = [...SUPPORTED_COUNTRY_CALLING_CODES]
      .sort((a, b) => b.length - a.length)
      .find((code) => digits.startsWith(code));

    if (!matched) {
      return {
        valid: false,
        normalised: null,
        countryCode: null,
        reason: 'unsupported-country-code',
      };
    }

    if (matched === '91') {
      const national = digits.slice(2);
      return indianCore.test(national)
        ? { valid: true, normalised: national, countryCode: '91' }
        : { valid: false, normalised: null, countryCode: null, reason: 'invalid-indian-number' };
    }

    const national = digits.slice(matched.length);
    if (national.length < 6 || national.length > 14) {
      return { valid: false, normalised: null, countryCode: null, reason: 'invalid-length' };
    }
    if (/^0+$/.test(national)) {
      return { valid: false, normalised: null, countryCode: null, reason: 'invalid-number' };
    }
    return { valid: true, normalised: digits, countryCode: matched };
  }

  // Domestic forms, written without a country code.
  if (indianCore.test(digits)) {
    return { valid: true, normalised: digits, countryCode: '91' };
  }
  if (digits.length === 11 && digits.startsWith('0') && indianCore.test(digits.slice(1))) {
    return { valid: true, normalised: digits.slice(1), countryCode: '91' };
  }
  if (digits.length === 12 && digits.startsWith('91') && indianCore.test(digits.slice(2))) {
    return { valid: true, normalised: digits.slice(2), countryCode: '91' };
  }

  return { valid: false, normalised: null, countryCode: null, reason: 'invalid-format' };
}

export interface ValidationResult {
  valid: boolean;
  /** Field name -> customer-facing message. Never echoes the submitted value. */
  errors: Record<string, string>;
  sanitizedPayload?: LeadPayload;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function boundedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, max);
}

export function validateLeadPayload(raw: unknown): ValidationResult {
  const errors: Record<string, string> = {};

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: { request: 'The request body must be a JSON object.' } };
  }

  const data = raw as Record<string, unknown>;

  // Consent must be literal boolean true. A truthy string is not consent.
  if (data.consent !== true) {
    errors.consent = 'Please tick the box so we know it is alright to contact you.';
  }

  // Marketing permission is separate, optional, and must never default to true.
  let marketingConsent = false;
  if (data.marketingConsent !== undefined) {
    if (typeof data.marketingConsent !== 'boolean') {
      errors.marketingConsent = 'Invalid value.';
    } else {
      marketingConsent = data.marketingConsent;
    }
  }

  const intent = asEnum<CustomerIntent>(data.intent, INTENTS);
  if (!intent) {
    errors.intent = 'Please choose what you would like help with.';
  }

  const assetTypeRaw = typeof data.assetType === 'string' ? data.assetType : '';
  const assetType = getAssetType(assetTypeRaw)?.id;
  if (!assetType) {
    errors.assetType = 'Please choose a property type.';
  }

  if (intent && assetType && getCoverage(intent, assetType) === 'not-offered') {
    errors.assetType = 'We do not handle that combination. Please choose another option or call us.';
  }

  const name = boundedString(data.name, FIELD_LIMITS.nameMax);
  if (!name || name.length < FIELD_LIMITS.nameMin) {
    errors.name = 'Please tell us your name.';
  } else if (/[<>{}\\]/.test(name)) {
    errors.name = 'Please use letters, spaces, dots and hyphens only.';
  }

  const phone = validatePhone(data.phone);
  if (!phone.valid) {
    errors.phone =
      phone.reason === 'required'
        ? 'Please give a phone number we can reach you on.'
        : 'Please check the phone number. For an Indian mobile, ten digits is enough. For another country, start with + and the country code.';
  }

  let preferredAreas: string[] = [];
  if (data.preferredAreas !== undefined) {
    if (!Array.isArray(data.preferredAreas)) {
      errors.preferredAreas = 'Invalid value.';
    } else {
      preferredAreas = data.preferredAreas
        .map((item) => boundedString(item, FIELD_LIMITS.areaItemMax))
        .filter((item): item is string => Boolean(item))
        .slice(0, FIELD_LIMITS.areaCountMax);
    }
  }

  const budgetBand = asEnum<BudgetBandId>(data.budgetBand, BUDGET_BANDS);
  if (data.budgetBand !== undefined && !budgetBand) {
    errors.budgetBand = 'Please choose one of the listed budget options.';
  }

  const rentBand = asEnum<RentBandId>(data.rentBand, RENT_BANDS);
  if (data.rentBand !== undefined && !rentBand) {
    errors.rentBand = 'Please choose one of the listed rent options.';
  }

  const timeline = asEnum<TimelineId>(data.timeline, TIMELINES);
  if (data.timeline !== undefined && !timeline) {
    errors.timeline = 'Please choose one of the listed timeline options.';
  }

  const furnishing = asEnum<FurnishingId>(data.furnishing, FURNISHING_OPTIONS);
  if (data.furnishing !== undefined && !furnishing) {
    errors.furnishing = 'Please choose one of the listed furnishing options.';
  }

  const ownershipRole = asEnum<OwnershipRoleId>(data.ownershipRole, OWNERSHIP_ROLES);
  if (data.ownershipRole !== undefined && !ownershipRole) {
    errors.ownershipRole = 'Please choose one of the listed options.';
  }

  const configuration = asEnum(data.configuration, CONFIGURATIONS);
  if (data.configuration !== undefined && !configuration) {
    errors.configuration = 'Please choose one of the listed options.';
  }

  const contactPreference =
    asEnum<ContactPreferenceId>(data.contactPreference, CONTACT_PREFERENCES) ?? 'phone-call';

  const notes = boundedString(data.notes, FIELD_LIMITS.notesMax);

  let idempotencyKey: string | undefined;
  if (data.idempotencyKey !== undefined) {
    const key = boundedString(data.idempotencyKey, FIELD_LIMITS.idempotencyKeyMax);
    if (!key || !/^[A-Za-z0-9_-]+$/.test(key)) {
      errors.idempotencyKey = 'Invalid value.';
    } else {
      idempotencyKey = key;
    }
  }

  // Ownership role is genuinely required for owner-side intents: we should know
  // whether we are speaking to the owner before discussing their property.
  if ((intent === 'sell' || intent === 'rent-out') && !ownershipRole) {
    errors.ownershipRole = 'Please tell us whether you are the owner or representing the owner.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitizedPayload: {
      intent: intent as CustomerIntent,
      assetType: assetType as AssetTypeId,
      preferredAreas,
      budgetBand,
      rentBand,
      timeline,
      furnishing,
      ownershipRole,
      configuration,
      notes,
      contactPreference,
      name: name as string,
      phone: phone.normalised as string,
      consent: true,
      marketingConsent,
      idempotencyKey,
    },
  };
}
