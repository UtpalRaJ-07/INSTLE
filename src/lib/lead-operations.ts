/**
 * Enquiry processing pipeline.
 *
 * Contract, stated plainly because the previous version broke it:
 *   A customer sees success only after an approved, durable destination has
 *   confirmed acceptance. A resolved promise is not acceptance. A memory store is
 *   not durable. Notification delivery is a separate concern from durable receipt.
 */

import { getDeployEnvironment } from '@/config/site';
import { trackSafeEvent } from './telemetry';
import {
  resolveLeadDestination,
  stagingLeadStore,
  type DispatchResult,
  type LeadDestinationAdapter,
} from './lead-destination';
import {
  IDEMPOTENCY_WINDOW_MS,
  computePayloadFingerprint,
  deriveIdempotencyKey,
  getIdempotencyStore,
} from './idempotency';
import type { LeadPayload, StoredLeadRecord } from './lead-types';

export const DISPATCH_TIMEOUT_MS = 8000;

export type LeadFailureCode =
  | 'no-destination'
  | 'destination-rejected'
  | 'destination-timeout'
  | 'destination-error'
  | 'not-durable'
  | 'duplicate-in-flight'
  | 'idempotency-conflict'
  | 'retention-policy-missing'
  | 'consent-notice-missing';

export type ProcessLeadResult =
  | {
      success: true;
      leadId: string;
      isDuplicate: boolean;
      /** Whether the assigned queue was actually notified. */
      notificationDelivered: boolean;
    }
  | {
      success: false;
      failureCode: LeadFailureCode;
      /** Whether the customer can usefully retry. */
      retriable: boolean;
    };

function readTrimmedEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Retention period in days, only when an operator has configured one. */
function getConfiguredRetentionDays(): number | null {
  const raw = Number(readTrimmedEnv('INSTLE_LEAD_RETENTION_DAYS'));
  if (!Number.isInteger(raw) || raw <= 0 || raw > 3650) return null;
  return raw;
}

/** Version identifier of the approved notice the customer was shown. */
function getConsentNoticeVersion(): string | null {
  return readTrimmedEnv('INSTLE_CONSENT_NOTICE_VERSION') ?? null;
}

function getAssignedQueue(): string | null {
  return readTrimmedEnv('INSTLE_LEAD_QUEUE') ?? null;
}

/**
 * Reference identifier. Random, and carries no customer data — the previous
 * format embedded the intent and a timestamp, which is harmless, but a reference
 * should not be guessable or enumerable either.
 */
function generateLeadId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, 12);
  return `IRE-${token}`;
}

function buildRecord(
  payload: LeadPayload,
  leadId: string,
  consentNoticeVersion: string,
  retentionDays: number | null,
  now: Date
): StoredLeadRecord {
  const timestamp = now.toISOString();
  return {
    id: leadId,
    createdAt: timestamp,
    intent: payload.intent,
    customer: {
      name: payload.name,
      phone: payload.phone,
      contactPreference: payload.contactPreference,
    },
    requirement: {
      assetType: payload.assetType,
      preferredAreas: payload.preferredAreas,
      budgetBand: payload.budgetBand,
      rentBand: payload.rentBand,
      timeline: payload.timeline,
      furnishing: payload.furnishing,
      ownershipRole: payload.ownershipRole,
      configuration: payload.configuration,
      notes: payload.notes,
    },
    governance: {
      serviceConsentGiven: true,
      consentTimestamp: timestamp,
      consentNoticeVersion,
      marketingConsentGiven: payload.marketingConsent,
      proposedRetentionUntil:
        retentionDays === null
          ? null
          : new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
      retentionPolicyConfigured: retentionDays !== null,
      status: 'new',
      assignedQueue: getAssignedQueue(),
    },
  };
}

async function dispatchWithTimeout(
  adapter: LeadDestinationAdapter,
  record: StoredLeadRecord,
  timeoutMs: number
): Promise<DispatchResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DispatchResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ success: false, failureReason: 'timeout', retriable: true }),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([
      adapter.dispatch(record).catch(
        (): DispatchResult => ({
          success: false,
          failureReason: 'adapter-threw',
          retriable: true,
        })
      ),
      timeout,
    ]);
    // Defend against an adapter resolving with something that is not a result.
    if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
      return { success: false, failureReason: 'adapter-invalid-result', retriable: true };
    }
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Notify the assigned queue. Deliberately separate from durable acceptance:
 * if this fails, the enquiry is still safely stored and the customer is still
 * told it was received, but the failure is reported so an operator can act.
 *
 * No notification transport is configured because none is approved (OWN-07), so
 * this currently reports "not delivered" rather than pretending otherwise.
 */
async function notifyAssignedQueue(record: StoredLeadRecord): Promise<boolean> {
  if (!record.governance.assignedQueue) return false;
  // Integration point. Intentionally unimplemented: sending to an unapproved
  // destination would be an unreviewed disclosure of personal data.
  return false;
}

export interface ProcessLeadOptions {
  adapter?: LeadDestinationAdapter;
  now?: Date;
  timeoutMs?: number;
}

export async function processLeadEnquiry(
  payload: LeadPayload,
  options: ProcessLeadOptions = {}
): Promise<ProcessLeadResult> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? DISPATCH_TIMEOUT_MS;

  let adapter = options.adapter;
  if (!adapter) {
    const resolution = resolveLeadDestination();
    if (!resolution.available) {
      return { success: false, failureCode: 'no-destination', retriable: true };
    }
    adapter = resolution.adapter;
  }

  /**
   * A non-durable destination must never produce a customer success response in
   * production. The check keys off the declared deploy environment rather than
   * NODE_ENV, because `next start` sets NODE_ENV=production for every preview
   * build too — and a preview needs the memory adapter to exercise this path
   * end to end with synthetic data.
   */
  if (!adapter.isDurable && getDeployEnvironment() === 'production') {
    return { success: false, failureCode: 'not-durable', retriable: true };
  }

  const consentNoticeVersion = getConsentNoticeVersion();
  if (!consentNoticeVersion) {
    // Storing personal data against an unidentified notice cannot be evidenced
    // later, so refuse rather than record an unverifiable consent.
    return { success: false, failureCode: 'consent-notice-missing', retriable: false };
  }

  const retentionDays = getConfiguredRetentionDays();
  if (adapter.approvedForRealData && retentionDays === null) {
    return { success: false, failureCode: 'retention-policy-missing', retriable: false };
  }

  const fingerprint = await computePayloadFingerprint([
    payload.intent,
    payload.assetType,
    payload.phone,
    payload.name,
    payload.budgetBand,
    payload.rentBand,
    payload.timeline,
    [...payload.preferredAreas].sort().join('|'),
  ]);
  const idempotencyKey = await deriveIdempotencyKey(payload.idempotencyKey, fingerprint);
  const store = getIdempotencyStore();

  const reservation = await store.reserve(
    idempotencyKey,
    fingerprint,
    IDEMPOTENCY_WINDOW_MS,
    now.getTime()
  );

  if (reservation.state === 'completed') {
    return {
      success: true,
      leadId: reservation.leadId,
      isDuplicate: true,
      notificationDelivered: false,
    };
  }
  if (reservation.state === 'in-flight') {
    return { success: false, failureCode: 'duplicate-in-flight', retriable: true };
  }
  if (reservation.state === 'fingerprint-mismatch') {
    // Same client key, different payload. Never hand back the other reference.
    return { success: false, failureCode: 'idempotency-conflict', retriable: false };
  }

  const leadId = generateLeadId();
  const record = buildRecord(payload, leadId, consentNoticeVersion, retentionDays, now);

  const dispatchResult = await dispatchWithTimeout(adapter, record, timeoutMs);

  if (!dispatchResult.success) {
    // Release the reservation so a genuine retry is not blocked by a failure.
    await store.release(idempotencyKey);
    trackSafeEvent('form_submit_error', {
      intent: payload.intent,
      sourceComponent: 'enquiry-api',
      statusCode: 503,
    });

    const failureCode: LeadFailureCode =
      dispatchResult.failureReason === 'timeout'
        ? 'destination-timeout'
        : dispatchResult.failureReason === 'adapter-threw' ||
            dispatchResult.failureReason === 'adapter-invalid-result'
          ? 'destination-error'
          : 'destination-rejected';

    return { success: false, failureCode, retriable: dispatchResult.retriable ?? true };
  }

  // Durable acceptance confirmed. Only now is the dedupe entry recorded.
  await store.complete(idempotencyKey, leadId, now.getTime());

  const notificationDelivered = await notifyAssignedQueue(record);

  trackSafeEvent('form_submit_success', {
    intent: payload.intent,
    sourceComponent: 'enquiry-api',
    statusCode: 200,
  });

  return { success: true, leadId, isDuplicate: false, notificationDelivered };
}

/** Test helper. Clears the development staging store only. */
export function resetLeadOperationsForTesting(): void {
  stagingLeadStore.clear();
}

export { stagingLeadStore };
export type { LeadPayload, StoredLeadRecord } from './lead-types';
