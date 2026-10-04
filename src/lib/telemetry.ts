/**
 * Privacy-first telemetry contract.
 *
 * Invariant: zero personal data, ever.
 *
 * The previous version allowlisted key *names* and then accepted any string,
 * number or boolean in them. So `sourceComponent` could carry free text, and
 * `localitySlug` could carry anything at all. This version validates every value
 * against an enum, a numeric range, or an approved public registry, and drops the
 * whole event if any field fails.
 *
 * This is a contract, not a live analytics integration. No measurement vendor is
 * approved (OWN-15), so nothing is transmitted anywhere. See
 * docs/implementation/EVENT-DICTIONARY.md.
 */

import { getPublishedLocalitySlugs } from '@/config/localities';
import { getPublishedGuideSlugs } from '@/config/guides';

export type AllowedTelemetryEvent =
  | 'phone_click'
  | 'intent_selected'
  | 'form_start'
  | 'form_step_complete'
  | 'form_submit_attempt'
  | 'form_submit_success'
  | 'form_submit_error'
  | 'locality_view';

const ALLOWED_EVENTS = new Set<AllowedTelemetryEvent>([
  'phone_click',
  'intent_selected',
  'form_start',
  'form_step_complete',
  'form_submit_attempt',
  'form_submit_success',
  'form_submit_error',
  'locality_view',
]);

/** Intent enum. Matches CustomerIntent, duplicated as literals so it is a closed set. */
export const TELEMETRY_INTENTS = ['buy', 'rent', 'sell', 'rent-out', 'commercial', 'general'] as const;
export type TelemetryIntent = (typeof TELEMETRY_INTENTS)[number];

/** Route families, not raw paths. A raw path could carry query strings. */
export const TELEMETRY_ROUTE_CATEGORIES = [
  'home',
  'service',
  'area-hub',
  'area-detail',
  'guide-hub',
  'guide-detail',
  'about',
  'owner-profile',
  'process',
  'contact',
  'not-found',
] as const;
export type TelemetryRouteCategory = (typeof TELEMETRY_ROUTE_CATEGORIES)[number];

/**
 * Components permitted to emit events. A closed set, so a component name can
 * never become a channel for free text.
 */
export const TELEMETRY_COMPONENTS = [
  'header-phone',
  'footer-phone',
  'hero-phone',
  'mobile-action-bar-phone',
  'contact-page-phone',
  'service-page-phone',
  'guide-page-phone',
  'intent-card',
  'enquiry-form',
  'enquiry-api',
] as const;
export type TelemetryComponent = (typeof TELEMETRY_COMPONENTS)[number];

/** Status codes the API actually returns. Anything else is dropped. */
export const TELEMETRY_STATUS_CODES = [200, 202, 400, 409, 413, 415, 422, 429, 500, 503] as const;

const MAX_STEP_INDEX = 10;

export interface SafeTelemetryMetadata {
  intent?: TelemetryIntent;
  routeCategory?: TelemetryRouteCategory;
  /** Slug of an approved public locality page. */
  localitySlug?: string;
  /** Slug of an approved public guide page. */
  guideSlug?: string;
  sourceComponent?: TelemetryComponent;
  /** Zero-based form step index. */
  step?: number;
  statusCode?: number;
}

export interface SafeTelemetryPayload extends SafeTelemetryMetadata {
  event: AllowedTelemetryEvent;
  timestamp: string;
}

export interface TelemetryResult {
  accepted: boolean;
  payload: SafeTelemetryPayload | null;
  /** Why the event was dropped. Never contains the offending value. */
  rejectionReasons: readonly string[];
}

type Validator = (value: unknown) => boolean;

function oneOf(values: readonly (string | number)[]): Validator {
  const set = new Set<string | number>(values);
  return (value) => (typeof value === 'string' || typeof value === 'number') && set.has(value);
}

const FIELD_VALIDATORS: Record<keyof SafeTelemetryMetadata, Validator> = {
  intent: oneOf(TELEMETRY_INTENTS),
  routeCategory: oneOf(TELEMETRY_ROUTE_CATEGORIES),
  sourceComponent: oneOf(TELEMETRY_COMPONENTS),
  statusCode: oneOf(TELEMETRY_STATUS_CODES),
  // Slugs are validated against the live approved registries, so a draft or
  // unknown slug cannot be measured (and therefore cannot leak that it exists).
  localitySlug: (value) =>
    typeof value === 'string' && getPublishedLocalitySlugs().includes(value),
  guideSlug: (value) => typeof value === 'string' && getPublishedGuideSlugs().includes(value),
  step: (value) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_STEP_INDEX,
};

const ALLOWED_FIELDS = Object.keys(FIELD_VALIDATORS) as (keyof SafeTelemetryMetadata)[];
const ALLOWED_FIELD_SET = new Set<string>(ALLOWED_FIELDS);

/**
 * Validate and record an event.
 *
 * Returns a result rather than throwing, because a measurement failure must never
 * break a customer journey. An unknown key or an invalid value drops the whole
 * event; a partially-sanitised event would hide a bug.
 */
export function trackSafeEvent(
  eventName: string,
  metadata?: Record<string, unknown>
): TelemetryResult {
  const rejectionReasons: string[] = [];

  if (!ALLOWED_EVENTS.has(eventName as AllowedTelemetryEvent)) {
    return {
      accepted: false,
      payload: null,
      rejectionReasons: [`Unknown event name "${String(eventName)}".`],
    };
  }

  const validated: SafeTelemetryMetadata = {};

  if (metadata && typeof metadata === 'object') {
    for (const key of Object.keys(metadata)) {
      if (!ALLOWED_FIELD_SET.has(key)) {
        rejectionReasons.push(`Field "${key}" is not in the approved event dictionary.`);
        continue;
      }
      const value = metadata[key];
      if (value === undefined || value === null) continue;

      const field = key as keyof SafeTelemetryMetadata;
      if (!FIELD_VALIDATORS[field](value)) {
        // Deliberately does not echo the value: an invalid value is exactly the
        // case where the value might be personal data.
        rejectionReasons.push(`Field "${key}" carried a value outside its approved set.`);
        continue;
      }
      // Narrowing is enforced by the validators above.
      (validated as Record<string, unknown>)[key] = value;
    }
  }

  if (rejectionReasons.length > 0) {
    return { accepted: false, payload: null, rejectionReasons };
  }

  const payload: SafeTelemetryPayload = {
    event: eventName as AllowedTelemetryEvent,
    timestamp: new Date().toISOString(),
    ...validated,
  };

  // No vendor is approved, so nothing is transmitted. Local visibility only.
  if (process.env.NODE_ENV === 'development') {
    console.debug('[SAFE_TELEMETRY]', payload);
  }

  return { accepted: true, payload, rejectionReasons: [] };
}
