/**
 * Privacy-First Telemetry Contract for INSTLE REAL ESTATE
 * Sourced from Blueprint Section 16 & Recovery Brief Section 3
 * STRICT INVARIANT: ZERO PERSONAL DATA IN TELEMETRY
 *
 * Runtime enforcement: Any key not explicitly in SAFE_METADATA_KEYS is stripped
 * before event logging or dispatch.
 */

export type AllowedTelemetryEvent =
  | 'phone_click'
  | 'intent_selected'
  | 'form_start'
  | 'form_step_complete'
  | 'form_submit_attempt'
  | 'form_submit_success'
  | 'form_submit_error'
  | 'locality_view';

export interface SafeTelemetryMetadata {
  intent?: 'buy' | 'rent' | 'sell' | 'rent-out' | 'general';
  step?: number;
  localitySlug?: string;
  sourceComponent?: string;
  timeSpentSec?: number;
  statusCode?: number;
}

const SAFE_METADATA_KEYS = new Set<keyof SafeTelemetryMetadata>([
  'intent',
  'step',
  'localitySlug',
  'sourceComponent',
  'timeSpentSec',
  'statusCode',
]);

export function trackSafeEvent(
  eventName: AllowedTelemetryEvent,
  metadata?: Record<string, unknown>
): { event: AllowedTelemetryEvent; timestamp: string; [key: string]: unknown } {
  // Runtime sanitization: explicitly pick ONLY allowed safe keys
  const sanitizedMetadata: Record<string, unknown> = {};

  if (metadata && typeof metadata === 'object') {
    for (const [key, value] of Object.entries(metadata)) {
      if (SAFE_METADATA_KEYS.has(key as keyof SafeTelemetryMetadata)) {
        // Enforce primitive safe types
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          sanitizedMetadata[key] = value;
        }
      }
    }
  }

  const safePayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...sanitizedMetadata,
  };

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[SAFE_TELEMETRY]', safePayload);
  }

  return safePayload;
}

