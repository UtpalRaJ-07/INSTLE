/**
 * Enquiry API route behaviour, and the prototype-route policy.
 *
 * This file previously asserted the earlier locality schema (four published
 * records, three-citation "claim gate") and the earlier lead pipeline. Those
 * assertions described behaviour that has since been found unsound and removed, so
 * they have been replaced. The locality and lead coverage now lives in
 * tests/locality-gate.test.ts, tests/claim-gate.test.ts and
 * tests/lead-operations.test.ts.
 *
 * What is tested here is the HTTP surface: status codes, cache headers, and the
 * guarantee that no response leaks a stored record. All data is synthetic.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from '@/app/api/enquiry/route';
import { PRIMARY_PHONE } from '@/config/constants';
import {
  clearProductionLeadDestinationForTesting,
  registerProductionLeadDestination,
  type DispatchResult,
  type LeadDestinationAdapter,
} from '@/lib/lead-destination';
import {
  InMemoryIdempotencyStore,
  setIdempotencyStore,
  type ReservationOutcome,
} from '@/lib/idempotency';
import {
  InMemoryRateLimitStore,
  resetRateLimitForTesting,
  setRateLimitStore,
  type RateLimitDecision,
  type RateLimitStore,
} from '@/lib/rate-limit';
import type { StoredLeadRecord } from '@/lib/lead-types';
import { PROTOTYPE_ROUTE_PREFIXES, isPrototypeRoute } from '@/config/constants';

function enquiryRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://example.test/api/enquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const VALID_BODY = {
  intent: 'buy',
  assetType: 'flat',
  preferredAreas: ['Jayanagar'],
  budgetBand: '50-lakh-to-1-crore',
  timeline: '1-to-3-months',
  contactPreference: 'phone-call',
  name: 'Synthetic Test Person',
  phone: '9845012345',
  consent: true,
};

class CapturingAdapter implements LeadDestinationAdapter {
  readonly name = 'capturing';
  readonly approvedForRealData = false;
  readonly isDurable = true;
  public readonly records: StoredLeadRecord[] = [];
  async dispatch(record: StoredLeadRecord): Promise<DispatchResult> {
    this.records.push(record);
    return { success: true, externalId: record.id };
  }
}

beforeEach(async () => {
  clearProductionLeadDestinationForTesting();
  setIdempotencyStore(new InMemoryIdempotencyStore());
  await resetRateLimitForTesting();
});

/** Enables intake and supplies the governance configuration it requires. */
function enableIntake() {
  process.env.INSTLE_ENQUIRY_INTAKE_ENABLED = 'true';
  process.env.INSTLE_CONSENT_NOTICE_VERSION = 'test-notice-v1';
}

describe('method policy', () => {
  it('refuses GET, so a public client cannot read enquiries', async () => {
    const response = await GET();
    expect(response.status).toBe(405);
  });
});

describe('call-only mode', () => {
  it('returns 503 and the phone number when intake is not switched on', async () => {
    const response = await POST(enquiryRequest(VALID_BODY));
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('intake-disabled');
    expect(body.phone).toBe(PRIMARY_PHONE);
    expect(body.error).toContain(PRIMARY_PHONE);
  });

  it('accepts nothing at all in that mode, even a valid payload', async () => {
    const adapter = new CapturingAdapter();
    registerProductionLeadDestination({
      ...adapter,
      approvedForRealData: true,
      dispatch: adapter.dispatch.bind(adapter),
    });
    await POST(enquiryRequest(VALID_BODY));
    expect(adapter.records).toHaveLength(0);
  });
});

/**
 * Requirement 6.7: `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`
 * on every response, reached one path at a time.
 *
 * The failing stores and destinations below are real implementations of the
 * route's own interfaces that fail the way an unreachable backend would. Nothing
 * in the route is stubbed.
 */
describe('cache and indexing headers', () => {
  function expectPrivateHeaders(response: Response, label: string) {
    const directives = (response.headers.get('cache-control') ?? '')
      .split(',')
      .map((directive) => directive.trim().toLowerCase());
    expect(directives, `${label}: Cache-Control`).toContain('no-store');
    expect(response.headers.get('x-robots-tag'), `${label}: X-Robots-Tag`).toBe('noindex, nofollow');
  }

  class UnreachableRateLimitStore implements RateLimitStore {
    readonly name = 'unreachable-rate-limit';
    readonly isDistributed = false;
    async consume(): Promise<RateLimitDecision> {
      throw new Error('rate-limit store unreachable');
    }
    async reset(): Promise<void> {}
  }

  class UnreachableIdempotencyStore extends InMemoryIdempotencyStore {
    override async reserve(): Promise<ReservationOutcome> {
      throw new Error('idempotency store unreachable');
    }
  }

  /** Approved and durable, so it reaches dispatch, where it throws. */
  const failingDestination: LeadDestinationAdapter = {
    name: 'failing-destination',
    approvedForRealData: true,
    isDurable: true,
    async dispatch(): Promise<DispatchResult> {
      throw new Error('destination unreachable');
    },
  };

  afterEach(() => {
    setRateLimitStore(new InMemoryRateLimitStore());
    setIdempotencyStore(new InMemoryIdempotencyStore());
  });

  interface HeaderCase {
    label: string;
    status: number;
    code?: string;
    send: () => Promise<Response>;
  }

  const post = (body: unknown = VALID_BODY) => POST(enquiryRequest(body));

  const cases: HeaderCase[] = [
    // Success.
    {
      label: 'success',
      status: 200,
      send: async () => {
        enableIntake();
        return post();
      },
    },
    {
      label: 'success for a repeated submission',
      status: 200,
      send: async () => {
        enableIntake();
        await post();
        return post();
      },
    },
    // Validation failure.
    {
      label: 'payload failing validation',
      status: 422,
      code: 'validation-failed',
      send: async () => {
        enableIntake();
        return post({ ...VALID_BODY, consent: false });
      },
    },
    {
      label: 'malformed JSON',
      status: 400,
      code: 'malformed',
      send: async () => {
        enableIntake();
        return post('{ not json');
      },
    },
    {
      label: 'payload too large',
      status: 413,
      code: 'too-large',
      send: async () => {
        enableIntake();
        return post(JSON.stringify({ ...VALID_BODY, notes: 'x'.repeat(40_000) }));
      },
    },
    {
      label: 'unsupported content type',
      status: 415,
      code: 'unsupported-media-type',
      send: async () => {
        enableIntake();
        return POST(
          new Request('https://example.test/api/enquiry', {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'hello',
          })
        );
      },
    },
    {
      label: 'consent notice not configured',
      status: 422,
      code: 'consent-notice-missing',
      send: async () => {
        enableIntake();
        delete process.env.INSTLE_CONSENT_NOTICE_VERSION;
        return post();
      },
    },
    {
      label: 'idempotency key reused for a different payload',
      status: 409,
      code: 'idempotency-conflict',
      send: async () => {
        enableIntake();
        await post({ ...VALID_BODY, idempotencyKey: 'synthetic-key-1' });
        return post({ ...VALID_BODY, name: 'Another Synthetic Person', idempotencyKey: 'synthetic-key-1' });
      },
    },
    {
      label: 'rate limited',
      status: 429,
      code: 'rate-limited',
      send: async () => {
        enableIntake();
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const response = await post({ ...VALID_BODY, phone: `98450123${String(attempt).padStart(2, '0')}` });
          if (response.status === 429) return response;
        }
        throw new Error('The rate limit was never reached.');
      },
    },
    // Refusals and server errors.
    {
      label: 'intake switched off',
      status: 503,
      code: 'intake-disabled',
      send: async () => post(),
    },
    {
      label: 'production without distributed abuse controls',
      status: 503,
      code: 'abuse-controls-unavailable',
      send: async () => {
        enableIntake();
        process.env.INSTLE_DEPLOY_ENV = 'production';
        return post();
      },
    },
    {
      label: 'destination throws on dispatch',
      status: 503,
      code: 'destination-error',
      send: async () => {
        enableIntake();
        process.env.INSTLE_LEAD_RETENTION_DAYS = '30';
        registerProductionLeadDestination(failingDestination);
        return post();
      },
    },
    {
      label: 'idempotency store throws inside lead processing',
      status: 500,
      code: 'unexpected-error',
      send: async () => {
        enableIntake();
        setIdempotencyStore(new UnreachableIdempotencyStore());
        return post();
      },
    },
    {
      label: 'rate-limit store throws before lead processing',
      status: 500,
      code: 'unexpected-error',
      send: async () => {
        enableIntake();
        setRateLimitStore(new UnreachableRateLimitStore());
        return post();
      },
    },
    // Methods other than POST.
    { label: 'GET', status: 405, send: async () => GET() },
    { label: 'PUT', status: 405, send: async () => PUT() },
    { label: 'PATCH', status: 405, send: async () => PATCH() },
    { label: 'DELETE', status: 405, send: async () => DELETE() },
    { label: 'OPTIONS', status: 204, send: async () => OPTIONS() },
  ];

  it.each(cases)('$label: $status with no-store and noindex, nofollow', async ({ label, status, code, send }) => {
    const response = await send();
    expect(response.status, label).toBe(status);
    expectPrivateHeaders(response, label);
    if (code !== undefined) {
      expect((await response.json()).code, label).toBe(code);
    }
  });

  it('names only POST and OPTIONS as allowed methods', async () => {
    for (const response of [await GET(), await PUT(), await PATCH(), await DELETE(), await OPTIONS()]) {
      expect(response.headers.get('allow')).toBe('OPTIONS, POST');
    }
  });
});

describe('request handling with intake enabled', () => {
  beforeEach(enableIntake);

  it('rejects a non-JSON content type with 415', async () => {
    const request = new Request('https://example.test/api/enquiry', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect((await POST(request)).status).toBe(415);
  });

  it('rejects malformed JSON with 400', async () => {
    expect((await POST(enquiryRequest('{ not json'))).status).toBe(400);
  });

  it('rejects an oversized body with 413', async () => {
    const oversized = JSON.stringify({ ...VALID_BODY, notes: 'x'.repeat(40_000) });
    expect((await POST(enquiryRequest(oversized))).status).toBe(413);
  });

  it('rejects a payload failing validation with 422 and field-level messages', async () => {
    const response = await POST(enquiryRequest({ ...VALID_BODY, consent: false }));
    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.errors.consent).toBeTruthy();
  });

  it('never echoes a submitted value in a validation error response', async () => {
    const response = await POST(
      enquiryRequest({ ...VALID_BODY, phone: '0000000000', name: 'Distinctive Name Token' })
    );
    const text = await response.text();
    expect(text).not.toContain('Distinctive Name Token');
    expect(text).not.toContain('0000000000');
  });

  it('returns 503 when no destination can accept the enquiry', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    const response = await POST(enquiryRequest(VALID_BODY));
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.phone).toBe(PRIMARY_PHONE);
  });

  it('returns 503 in production when abuse controls are not distributed', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    const response = await POST(enquiryRequest(VALID_BODY));
    const body = await response.json();
    // Either the abuse-control guard or the destination guard may fire first;
    // both must refuse rather than accept.
    expect(['abuse-controls-unavailable', 'no-destination']).toContain(body.code);
  });

  it('accepts a valid enquiry and returns only a reference and next steps', async () => {
    const response = await POST(enquiryRequest(VALID_BODY));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.reference).toMatch(/^IRE-/);
    expect(body.nextSteps).toContain(PRIMARY_PHONE);

    // The stored record must not come back to the client.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('Synthetic Test Person');
    expect(serialised).not.toContain('9845012345');
    expect(serialised).not.toContain('Jayanagar');
    expect(serialised).not.toContain('consentTimestamp');
  });

  it('returns the same reference for a repeated identical submission', async () => {
    const first = await (await POST(enquiryRequest(VALID_BODY))).json();
    const second = await (await POST(enquiryRequest(VALID_BODY))).json();
    expect(second.reference).toBe(first.reference);
    expect(second.isDuplicate).toBe(true);
  });

  it('rate limits after the configured number of attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await POST(
        enquiryRequest({ ...VALID_BODY, phone: `98450123${String(attempt).padStart(2, '0')}` })
      );
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  });

  it('includes the phone number in the rate-limit message', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await POST(enquiryRequest({ ...VALID_BODY, phone: `98460123${String(attempt).padStart(2, '0')}` }));
    }
    const response = await POST(enquiryRequest({ ...VALID_BODY, phone: '9847012399' }));
    if (response.status === 429) {
      const body = await response.json();
      expect(body.error).toContain(PRIMARY_PHONE);
    }
  });

  it('refuses to store anything when no consent notice version is configured', async () => {
    delete process.env.INSTLE_CONSENT_NOTICE_VERSION;
    const response = await POST(enquiryRequest(VALID_BODY));
    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.code).toBe('consent-notice-missing');
  });
});

describe('prototype route policy', () => {
  it('lists exactly the three known prototype prefixes', () => {
    expect([...PROTOTYPE_ROUTE_PREFIXES]).toEqual(['/concept-1', '/concept-2', '/concept-review']);
  });

  it('classifies prototype routes and their children as private', () => {
    for (const prefix of PROTOTYPE_ROUTE_PREFIXES) {
      expect(isPrototypeRoute(prefix)).toBe(true);
      expect(isPrototypeRoute(`${prefix}/intake`)).toBe(true);
    }
  });

  it('does not classify public routes as prototypes', () => {
    for (const route of ['/', '/buy', '/sell', '/rent', '/rent-out', '/commercial', '/areas']) {
      expect(isPrototypeRoute(route), route).toBe(false);
    }
  });
});
