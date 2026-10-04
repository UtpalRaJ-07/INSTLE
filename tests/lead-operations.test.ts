import { beforeEach, describe, expect, it } from 'vitest';
import { processLeadEnquiry } from '@/lib/lead-operations';
import {
  MemoryStagingAdapter,
  UnconfiguredDestinationAdapter,
  clearProductionLeadDestinationForTesting,
  registerProductionLeadDestination,
  resolveLeadDestination,
  type DispatchResult,
  type LeadDestinationAdapter,
} from '@/lib/lead-destination';
import {
  InMemoryIdempotencyStore,
  computePayloadFingerprint,
  deriveIdempotencyKey,
  getIdempotencyStore,
  resetIdempotencyForTesting,
  setIdempotencyStore,
} from '@/lib/idempotency';
import { InMemoryRateLimitStore, checkRateLimit, resetRateLimitForTesting } from '@/lib/rate-limit';
import type { LeadPayload, StoredLeadRecord } from '@/lib/lead-types';

/**
 * These tests encode the contract the previous implementation broke: a customer
 * must not be told an enquiry was received unless a durable destination said so.
 */

const PAYLOAD: LeadPayload = {
  intent: 'buy',
  assetType: 'flat',
  preferredAreas: ['Jayanagar'],
  budgetBand: '50-lakh-to-1-crore',
  timeline: '1-to-3-months',
  contactPreference: 'phone-call',
  name: 'Synthetic Test Person',
  phone: '9845012345',
  consent: true,
  marketingConsent: false,
};

/** An adapter that reports whatever the test tells it to. */
class ScriptedAdapter implements LeadDestinationAdapter {
  readonly name = 'scripted';
  readonly approvedForRealData = false;
  readonly isDurable = true;
  public calls = 0;
  constructor(private readonly behaviour: () => Promise<DispatchResult>) {}
  async dispatch(): Promise<DispatchResult> {
    this.calls += 1;
    return this.behaviour();
  }
}

class DurableRecordingAdapter implements LeadDestinationAdapter {
  readonly name = 'durable-recording';
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
  await resetIdempotencyForTesting();
  await resetRateLimitForTesting();
  process.env.INSTLE_CONSENT_NOTICE_VERSION = 'test-notice-v1';
});

describe('destination resolution', () => {
  it('refuses to serve production with no registered destination', () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    const resolution = resolveLeadDestination();
    expect(resolution.available).toBe(false);
    if (!resolution.available) {
      expect(resolution.reason).toMatch(/No approved production lead destination/);
    }
  });

  it('falls back to memory staging outside production', () => {
    const resolution = resolveLeadDestination();
    expect(resolution.available).toBe(true);
    if (resolution.available) {
      expect(resolution.adapter.isDurable).toBe(false);
      expect(resolution.adapter.approvedForRealData).toBe(false);
    }
  });

  it('refuses to register an adapter that is not approved for real data', () => {
    expect(() => registerProductionLeadDestination(new MemoryStagingAdapter())).toThrow(
      /approvedForRealData/
    );
  });

  it('refuses to register an approved-but-non-durable adapter', () => {
    const notDurable: LeadDestinationAdapter = {
      name: 'spreadsheet',
      approvedForRealData: true,
      isDurable: false,
      async dispatch() {
        return { success: true };
      },
    };
    expect(() => registerProductionLeadDestination(notDurable)).toThrow(/not durable/);
  });

  it('accepts an approved durable adapter', () => {
    const approved: LeadDestinationAdapter = {
      name: 'approved-crm',
      approvedForRealData: true,
      isDurable: true,
      async dispatch() {
        return { success: true, externalId: 'crm-1' };
      },
    };
    expect(() => registerProductionLeadDestination(approved)).not.toThrow();
  });
});

describe('processLeadEnquiry — false success prevention', () => {
  it('succeeds and returns a reference when the destination accepts', async () => {
    const adapter = new DurableRecordingAdapter();
    const result = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.leadId).toMatch(/^IRE-/);
      expect(result.isDuplicate).toBe(false);
    }
    expect(adapter.records).toHaveLength(1);
  });

  // The exact defect: the adapter resolved with success:false and the caller
  // still returned a customer success.
  it('fails when the adapter resolves with success false', async () => {
    const adapter = new ScriptedAdapter(async () => ({
      success: false,
      failureReason: 'rejected',
      retriable: true,
    }));
    const result = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failureCode).toBe('destination-rejected');
      expect(result.retriable).toBe(true);
    }
  });

  it('fails when the adapter throws', async () => {
    const adapter = new ScriptedAdapter(async () => {
      throw new Error('network down');
    });
    const result = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.failureCode).toBe('destination-error');
  });

  it('fails when the adapter never resolves within the timeout', async () => {
    const adapter = new ScriptedAdapter(() => new Promise<DispatchResult>(() => undefined));
    const result = await processLeadEnquiry(PAYLOAD, { adapter, timeoutMs: 20 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.failureCode).toBe('destination-timeout');
  });

  it('fails when the adapter resolves with something that is not a result', async () => {
    const adapter = new ScriptedAdapter(async () => undefined as unknown as DispatchResult);
    const result = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.failureCode).toBe('destination-error');
  });

  it('fails when no destination is available at all', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    const result = await processLeadEnquiry(PAYLOAD);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.failureCode).toBe('no-destination');
  });

  it('never reports success from the explicitly unconfigured destination', async () => {
    const result = await processLeadEnquiry(PAYLOAD, {
      adapter: new UnconfiguredDestinationAdapter(),
    });
    expect(result.success).toBe(false);
  });
});

describe('processLeadEnquiry — governance preconditions', () => {
  it('refuses to store anything without an identified consent notice version', async () => {
    delete process.env.INSTLE_CONSENT_NOTICE_VERSION;
    const adapter = new DurableRecordingAdapter();
    const result = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failureCode).toBe('consent-notice-missing');
      expect(result.retriable).toBe(false);
    }
    // Nothing reached the destination.
    expect(adapter.records).toHaveLength(0);
  });

  it('refuses a real-data destination with no configured retention period', async () => {
    const approved: LeadDestinationAdapter = {
      name: 'approved-crm',
      approvedForRealData: true,
      isDurable: true,
      async dispatch() {
        return { success: true };
      },
    };
    const result = await processLeadEnquiry(PAYLOAD, { adapter: approved });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.failureCode).toBe('retention-policy-missing');
  });

  it('records a proposed retention date only when a policy is configured', async () => {
    const adapter = new DurableRecordingAdapter();
    await processLeadEnquiry(PAYLOAD, { adapter });
    expect(adapter.records[0]?.governance.retentionPolicyConfigured).toBe(false);
    expect(adapter.records[0]?.governance.proposedRetentionUntil).toBeNull();

    process.env.INSTLE_LEAD_RETENTION_DAYS = '90';
    await resetIdempotencyForTesting();
    const second = new DurableRecordingAdapter();
    await processLeadEnquiry({ ...PAYLOAD, phone: '9845012399' }, { adapter: second });
    expect(second.records[0]?.governance.retentionPolicyConfigured).toBe(true);
    expect(second.records[0]?.governance.proposedRetentionUntil).toBeTruthy();
  });

  it('separates durable acceptance from queue notification', async () => {
    const adapter = new DurableRecordingAdapter();
    const result = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(result.success).toBe(true);
    if (result.success) {
      // No notification transport is approved, so this is honestly false.
      expect(result.notificationDelivered).toBe(false);
    }
  });

  it('stores the consent notice version that was actually shown', async () => {
    const adapter = new DurableRecordingAdapter();
    await processLeadEnquiry(PAYLOAD, { adapter });
    expect(adapter.records[0]?.governance.consentNoticeVersion).toBe('test-notice-v1');
  });
});

describe('idempotency', () => {
  it('returns the same reference for an identical repeat submission', async () => {
    const adapter = new DurableRecordingAdapter();
    const first = await processLeadEnquiry(PAYLOAD, { adapter });
    const second = await processLeadEnquiry(PAYLOAD, { adapter });

    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.leadId).toBe(first.leadId);
      expect(second.isDuplicate).toBe(true);
    }
    // Only one record reached the destination.
    expect(adapter.records).toHaveLength(1);
  });

  // The previous version recorded the dedupe entry before knowing whether delivery
  // worked, permanently blocking the customer's retry.
  it('does not block a retry after a delivery failure', async () => {
    let shouldFail = true;
    const adapter = new ScriptedAdapter(async () =>
      shouldFail
        ? { success: false, failureReason: 'rejected', retriable: true }
        : { success: true, externalId: 'ok' }
    );

    const failed = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(failed.success).toBe(false);

    shouldFail = false;
    const retried = await processLeadEnquiry(PAYLOAD, { adapter });
    expect(retried.success).toBe(true);
    expect(adapter.calls).toBe(2);
  });

  it('refuses to hand back another reference for the same client key with a different payload', async () => {
    const adapter = new DurableRecordingAdapter();
    const first = await processLeadEnquiry(
      { ...PAYLOAD, idempotencyKey: 'sharedkey123' },
      { adapter }
    );
    expect(first.success).toBe(true);

    const conflicting = await processLeadEnquiry(
      { ...PAYLOAD, name: 'Someone Else', phone: '9845012399', idempotencyKey: 'sharedkey123' },
      { adapter }
    );
    expect(conflicting.success).toBe(false);
    if (!conflicting.success) {
      expect(conflicting.failureCode).toBe('idempotency-conflict');
      expect(conflicting.retriable).toBe(false);
    }
  });

  it('treats two concurrent identical submissions as one record', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter = new ScriptedAdapter(async () => {
      await gate;
      return { success: true, externalId: 'ok' };
    });

    const both = Promise.all([
      processLeadEnquiry(PAYLOAD, { adapter }),
      processLeadEnquiry(PAYLOAD, { adapter }),
    ]);
    release?.();
    const [a, b] = await both;

    // The invariant is one record, not one success: whichever request loses the
    // race is either told it is a duplicate of the same reference, or told the
    // first one is still in flight. Neither creates a second record.
    expect(adapter.calls).toBe(1);

    const references = [a, b]
      .filter((result) => result.success)
      .map((result) => (result.success ? result.leadId : ''));
    expect(new Set(references).size).toBeLessThanOrEqual(1);

    const created = [a, b].filter((result) => result.success && !result.isDuplicate);
    expect(created).toHaveLength(1);

    const loser = [a, b].find((result) => !result.success || result.isDuplicate);
    expect(loser).toBeDefined();
    if (loser && !loser.success) {
      expect(loser.failureCode).toBe('duplicate-in-flight');
    }
  });

  it('declares the in-memory stores as non-distributed', () => {
    expect(getIdempotencyStore().isDistributed).toBe(false);
    expect(new InMemoryRateLimitStore().isDistributed).toBe(false);
  });
});

describe('idempotency keys carry no readable personal data', () => {
  it('derives a hashed key, not one containing the phone number', async () => {
    const fingerprint = await computePayloadFingerprint(['buy', 'flat', '9845012345']);
    const key = await deriveIdempotencyKey(undefined, fingerprint);
    expect(key).not.toContain('9845012345');
    expect(key).toMatch(/^payload:[0-9a-f]{64}$/);
  });

  it('hashes a client-supplied key too', async () => {
    const fingerprint = await computePayloadFingerprint(['buy']);
    const key = await deriveIdempotencyKey('customer-9845012345', fingerprint);
    expect(key).not.toContain('9845012345');
    expect(key).toMatch(/^client:[0-9a-f]{64}$/);
  });

  it('produces a different fingerprint for a different phone number', async () => {
    const a = await computePayloadFingerprint(['buy', 'flat', '9845012345']);
    const b = await computePayloadFingerprint(['buy', 'flat', '9845012399']);
    expect(a).not.toBe(b);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit and then refuses', async () => {
    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(await checkRateLimit('client-a', 1_000_000));
    }
    expect(results.slice(0, 5).every((result) => result.allowed)).toBe(true);
    expect(results[5]?.allowed).toBe(false);
  });

  it('keeps separate buckets per client key', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await checkRateLimit('client-b', 1_000_000);
    }
    expect((await checkRateLimit('client-b', 1_000_000)).allowed).toBe(false);
    expect((await checkRateLimit('client-c', 1_000_000)).allowed).toBe(true);
  });

  it('lets the window slide', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await checkRateLimit('client-d', 1_000_000);
    }
    expect((await checkRateLimit('client-d', 1_000_000)).allowed).toBe(false);
    // Eleven minutes later the window has passed.
    expect((await checkRateLimit('client-d', 1_000_000 + 11 * 60 * 1000)).allowed).toBe(true);
  });
});

describe('durability guard keys off the deploy environment', () => {
  /**
   * `next start` sets NODE_ENV=production for a preview build too, so keying the
   * durability guard off NODE_ENV made a synthetic preview submission fail. It is
   * keyed off the declared deploy environment instead.
   */
  it('permits the memory adapter in a preview deployment', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'preview';
    const resolution = resolveLeadDestination();
    expect(resolution.available).toBe(true);
    if (!resolution.available) return;

    const result = await processLeadEnquiry(PAYLOAD, { adapter: resolution.adapter });
    expect(result.success).toBe(true);
  });

  it('refuses the memory adapter in a production deployment', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    const result = await processLeadEnquiry(PAYLOAD, { adapter: new MemoryStagingAdapter() });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.failureCode).toBe('not-durable');
  });
});
