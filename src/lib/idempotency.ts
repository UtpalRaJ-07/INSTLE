/**
 * Idempotency with payload binding.
 *
 * Problems in the previous implementation, all of which this addresses:
 *   1. The dedupe key embedded the customer's phone number, putting personal data
 *      into a cache key.
 *   2. The entry was written before durable acceptance was known, so a failed
 *      delivery permanently blocked the customer's retry.
 *   3. A client-supplied `idempotencyKey` was used verbatim, so two unrelated
 *      customers sending the same key would be handed each other's reference.
 *   4. There was no reservation step, so two simultaneous requests could both
 *      pass the check and create two records.
 *
 * The key is now a hash, a client-supplied key is bound to a fingerprint of the
 * payload, and an entry is only marked complete after the destination accepts.
 */

export const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;

export type ReservationOutcome =
  /** Caller owns the key and should proceed with delivery. */
  | { state: 'reserved' }
  /** Another request holds the key and has not finished. Caller should not duplicate. */
  | { state: 'in-flight' }
  /** A previous identical request already succeeded. Return this reference. */
  | { state: 'completed'; leadId: string }
  /** The key exists but was used for a different payload. Refuse rather than leak. */
  | { state: 'fingerprint-mismatch' };

export interface IdempotencyStore {
  readonly name: string;
  /** False for per-process stores. Checked before production traffic is served. */
  readonly isDistributed: boolean;
  reserve(key: string, fingerprint: string, ttlMs: number, now: number): Promise<ReservationOutcome>;
  complete(key: string, leadId: string, now: number): Promise<void>;
  /** Release a reservation so a genuine retry is possible after a failure. */
  release(key: string): Promise<void>;
  reset(): Promise<void>;
}

interface Entry {
  fingerprint: string;
  leadId: string | null;
  expiresAt: number;
}

/** Per-process store. Development and tests only. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly name = 'in-memory-idempotency';
  readonly isDistributed = false;
  private readonly entries = new Map<string, Entry>();

  async reserve(
    key: string,
    fingerprint: string,
    ttlMs: number,
    now: number
  ): Promise<ReservationOutcome> {
    const existing = this.entries.get(key);

    if (existing && existing.expiresAt > now) {
      if (existing.fingerprint !== fingerprint) {
        return { state: 'fingerprint-mismatch' };
      }
      if (existing.leadId) {
        return { state: 'completed', leadId: existing.leadId };
      }
      return { state: 'in-flight' };
    }

    this.entries.set(key, { fingerprint, leadId: null, expiresAt: now + ttlMs });
    return { state: 'reserved' };
  }

  async complete(key: string, leadId: string, now: number): Promise<void> {
    const existing = this.entries.get(key);
    this.entries.set(key, {
      fingerprint: existing?.fingerprint ?? '',
      leadId,
      expiresAt: now + IDEMPOTENCY_WINDOW_MS,
    });
  }

  async release(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async reset(): Promise<void> {
    this.entries.clear();
  }
}

let activeStore: IdempotencyStore = new InMemoryIdempotencyStore();

export function getIdempotencyStore(): IdempotencyStore {
  return activeStore;
}

export function setIdempotencyStore(store: IdempotencyStore): void {
  activeStore = store;
}

export async function resetIdempotencyForTesting(): Promise<void> {
  await activeStore.reset();
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Fingerprint of the meaningful payload content.
 *
 * The phone number is included, because two submissions differing only by phone
 * number are genuinely different enquiries — but it is hashed with everything
 * else, so no readable personal data becomes a store key.
 */
export async function computePayloadFingerprint(parts: readonly (string | undefined)[]): Promise<string> {
  const normalised = parts.map((part) => (part ?? '').trim().toLowerCase()).join('\u0000');
  return sha256Hex(normalised);
}

/**
 * Derive the storage key.
 *
 * With a client-supplied key, the key is namespaced by that value *and* bound to
 * the payload fingerprint through `reserve`, so one client's key can never return
 * another client's reference. Without one, the fingerprint alone is the key.
 */
export async function deriveIdempotencyKey(
  clientKey: string | undefined,
  fingerprint: string
): Promise<string> {
  if (clientKey && clientKey.trim().length > 0) {
    return `client:${await sha256Hex(clientKey.trim())}`;
  }
  return `payload:${fingerprint}`;
}
