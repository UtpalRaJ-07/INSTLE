import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_COMPONENTS,
  TELEMETRY_INTENTS,
  TELEMETRY_ROUTE_CATEGORIES,
  trackSafeEvent,
} from '@/lib/telemetry';
import { getPublishedGuideSlugs } from '@/config/guides';

/**
 * The previous version checked key names and value *types*. So `sourceComponent`
 * accepted any string, which is a free-text channel straight into analytics. These
 * tests hold the line at value level.
 */

describe('trackSafeEvent — events', () => {
  it('accepts every event in the approved dictionary', () => {
    const events = [
      'phone_click',
      'intent_selected',
      'form_start',
      'form_step_complete',
      'form_submit_attempt',
      'form_submit_success',
      'form_submit_error',
      'locality_view',
    ];
    for (const event of events) {
      expect(trackSafeEvent(event).accepted, event).toBe(true);
    }
  });

  it('rejects an unknown event name', () => {
    const result = trackSafeEvent('lead_created');
    expect(result.accepted).toBe(false);
    expect(result.payload).toBeNull();
  });
});

describe('trackSafeEvent — unknown fields', () => {
  it('drops the event when an unknown field is present', () => {
    const result = trackSafeEvent('phone_click', { customerPhone: '9845012345' });
    expect(result.accepted).toBe(false);
    expect(result.payload).toBeNull();
  });

  it('never includes the offending value in the rejection reason', () => {
    const result = trackSafeEvent('phone_click', { customerPhone: '9845012345' });
    expect(result.rejectionReasons.join(' ')).not.toContain('9845012345');
  });

  it('rejects the classic leak fields outright', () => {
    for (const field of [
      'name',
      'phone',
      'email',
      'notes',
      'budget',
      'leadId',
      'reference',
      'address',
      'referrer',
      'query',
      'url',
    ]) {
      expect(trackSafeEvent('form_submit_success', { [field]: 'value' }).accepted, field).toBe(false);
    }
  });
});

describe('trackSafeEvent — value validation inside allowed fields', () => {
  it('accepts an intent from the enum', () => {
    for (const intent of TELEMETRY_INTENTS) {
      expect(trackSafeEvent('intent_selected', { intent }).accepted, intent).toBe(true);
    }
  });

  it('rejects an intent outside the enum', () => {
    expect(trackSafeEvent('intent_selected', { intent: 'invest' }).accepted).toBe(false);
  });

  // This is the specific P1 finding: an allowed key carrying free text.
  it('rejects a free-text sourceComponent', () => {
    expect(
      trackSafeEvent('phone_click', { sourceComponent: 'called about 12 Main Road' }).accepted
    ).toBe(false);
  });

  it('accepts a sourceComponent from the registry', () => {
    for (const component of TELEMETRY_COMPONENTS) {
      expect(trackSafeEvent('phone_click', { sourceComponent: component }).accepted, component).toBe(
        true
      );
    }
  });

  it('accepts a route category from the enum and rejects a raw path', () => {
    for (const category of TELEMETRY_ROUTE_CATEGORIES) {
      expect(trackSafeEvent('phone_click', { routeCategory: category }).accepted).toBe(true);
    }
    expect(
      trackSafeEvent('phone_click', { routeCategory: '/buy?name=someone' }).accepted
    ).toBe(false);
  });

  it('accepts only a status code the API actually returns', () => {
    expect(trackSafeEvent('form_submit_error', { statusCode: 429 }).accepted).toBe(true);
    expect(trackSafeEvent('form_submit_error', { statusCode: 418 }).accepted).toBe(false);
    expect(trackSafeEvent('form_submit_error', { statusCode: '429' }).accepted).toBe(false);
  });

  it('bounds the step index and requires an integer', () => {
    expect(trackSafeEvent('form_step_complete', { step: 0 }).accepted).toBe(true);
    expect(trackSafeEvent('form_step_complete', { step: 10 }).accepted).toBe(true);
    expect(trackSafeEvent('form_step_complete', { step: 11 }).accepted).toBe(false);
    expect(trackSafeEvent('form_step_complete', { step: -1 }).accepted).toBe(false);
    expect(trackSafeEvent('form_step_complete', { step: 1.5 }).accepted).toBe(false);
  });

  /**
   * A slug is validated against the published registry, so a draft slug cannot be
   * measured — which also means telemetry cannot reveal that a draft page exists.
   */
  it('rejects a locality slug that is not a published page', () => {
    expect(trackSafeEvent('locality_view', { localitySlug: 'indiranagar' }).accepted).toBe(false);
    expect(trackSafeEvent('locality_view', { localitySlug: 'not-a-place' }).accepted).toBe(false);
  });

  it('accepts a guide slug that is published', () => {
    const [slug] = getPublishedGuideSlugs();
    expect(slug).toBeTruthy();
    expect(trackSafeEvent('phone_click', { guideSlug: slug }).accepted).toBe(true);
    expect(trackSafeEvent('phone_click', { guideSlug: 'made-up-guide' }).accepted).toBe(false);
  });

  it('ignores undefined and null without dropping the event', () => {
    const result = trackSafeEvent('phone_click', {
      intent: undefined,
      sourceComponent: null,
    });
    expect(result.accepted).toBe(true);
    expect(result.payload?.intent).toBeUndefined();
  });
});

describe('trackSafeEvent — payload shape', () => {
  it('emits only the event name, timestamp and validated fields', () => {
    const result = trackSafeEvent('form_submit_success', {
      intent: 'buy',
      sourceComponent: 'enquiry-form',
      statusCode: 200,
    });
    expect(result.accepted).toBe(true);
    expect(Object.keys(result.payload ?? {}).sort()).toEqual(
      ['event', 'intent', 'sourceComponent', 'statusCode', 'timestamp'].sort()
    );
  });
});
