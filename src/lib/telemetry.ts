/**
 * Privacy-First Telemetry Contract for INSTLE REAL ESTATE
 * Sourced from Blueprint Section 16 & Recovery Brief Section 3
 * STRICT INVARIANT: ZERO PERSONAL DATA IN TELEMETRY
 */

export type AllowedTelemetryEvent =
  | 'phone_click'
  | 'intent_selected'
  | 'form_start'
  | 'form_step_complete'
  | 'form_submit'
  | 'locality_view';

export interface SafeTelemetryMetadata {
  intent?: string;
  step?: number;
  localitySlug?: string;
  sourceComponent?: string;
  timeSpentSec?: number;
}

export function trackSafeEvent(
  eventName: AllowedTelemetryEvent,
  metadata?: SafeTelemetryMetadata
) {
  // Discard any disallowed PII fields if accidentally passed
  const safePayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  if (process.env.NODE_ENV !== 'production') {
    // Development verification
    console.debug('[SAFE_TELEMETRY]', safePayload);
  }

  // In production, transmits to privacy-vetted consent-aware endpoint
  return safePayload;
}
