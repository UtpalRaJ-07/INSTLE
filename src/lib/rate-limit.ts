/**
 * Rate limiting behind a store interface.
 *
 * The previous implementation used a module-level Map. That works on one process
 * and silently stops working the moment the app runs on more than one instance,
 * which is the normal deployment shape for this framework.
 *
 * The interface below makes that property explicit via `isDistributed`. The API
 * route refuses production traffic while the configured store is not distributed,
 * instead of appearing to enforce a limit it cannot enforce.
 *
 * No distributed backend is wired up because no vendor is approved (OWN-07).
 * Implementing `RateLimitStore` against the chosen store is the only work needed.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Epoch milliseconds when the window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  readonly name: string;
  /** False for per-process stores. The API route checks this before serving production. */
  readonly isDistributed: boolean;
  consume(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitDecision>;
  reset(): Promise<void>;
}

export const RATE_LIMIT_MAX_REQUESTS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Per-process sliding window. Suitable for local development and tests only.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  readonly name = 'in-memory-sliding-window';
  readonly isDistributed = false;
  private readonly hits = new Map<string, number[]>();

  async consume(
    key: string,
    limit: number,
    windowMs: number,
    now: number
  ): Promise<RateLimitDecision> {
    const timestamps = (this.hits.get(key) ?? []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= limit) {
      this.hits.set(key, timestamps);
      const oldest = timestamps[0] ?? now;
      return { allowed: false, remaining: 0, resetAt: oldest + windowMs };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return {
      allowed: true,
      remaining: limit - timestamps.length,
      resetAt: (timestamps[0] ?? now) + windowMs,
    };
  }

  async reset(): Promise<void> {
    this.hits.clear();
  }
}

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

export function getRateLimitStore(): RateLimitStore {
  return activeStore;
}

/** Register a distributed store once one is approved and provisioned. */
export function setRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

export async function checkRateLimit(
  clientKey: string,
  now: number = Date.now()
): Promise<RateLimitDecision> {
  return activeStore.consume(clientKey, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS, now);
}

export async function resetRateLimitForTesting(): Promise<void> {
  await activeStore.reset();
}
