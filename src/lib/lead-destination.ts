/**
 * Lead destination adapters and resolution.
 *
 * The previous implementation used an in-memory staging adapter as the *default*
 * argument of the processing function, so production would silently accept real
 * customer enquiries into process memory and report success.
 *
 * Resolution now works the other way round: production requires an explicitly
 * configured, approved destination, and refuses to run without one.
 */

import { getDeployEnvironment } from '@/config/site';
import type { StoredLeadRecord } from './lead-types';

export interface DispatchResult {
  success: boolean;
  /** Identifier returned by the destination, when it supplies one. */
  externalId?: string;
  /** Safe, non-PII failure reason for operational logging. */
  failureReason?: string;
  /** Whether the caller may retry. */
  retriable?: boolean;
}

export interface LeadDestinationAdapter {
  readonly name: string;
  /**
   * Whether this destination is approved for real personal data.
   * Only a destination that has passed security and privacy review may set true.
   */
  readonly approvedForRealData: boolean;
  /**
   * Whether acceptance is durable. A memory store is not durable, so a success
   * from it must never be reported to a real customer.
   */
  readonly isDurable: boolean;
  dispatch(record: StoredLeadRecord): Promise<DispatchResult>;
}

/**
 * Development and staging adapter. Keeps records in process memory so a developer
 * can exercise the flow end to end with synthetic data.
 *
 * `approvedForRealData` and `isDurable` are both false, which is what stops it
 * being usable in production.
 */
export class MemoryStagingAdapter implements LeadDestinationAdapter {
  readonly name = 'memory-staging';
  readonly approvedForRealData = false;
  readonly isDurable = false;
  private readonly records = new Map<string, StoredLeadRecord>();

  async dispatch(record: StoredLeadRecord): Promise<DispatchResult> {
    this.records.set(record.id, record);
    return { success: true, externalId: record.id };
  }

  getRecord(id: string): StoredLeadRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): StoredLeadRecord[] {
    return Array.from(this.records.values());
  }

  clear(): void {
    this.records.clear();
  }
}

/**
 * Explicit "no destination" adapter. Always fails, and says why.
 *
 * Used when intake is disabled or unconfigured, so a misconfiguration produces a
 * visible, retriable failure and the call-path fallback rather than a fake success.
 */
export class UnconfiguredDestinationAdapter implements LeadDestinationAdapter {
  readonly name = 'unconfigured';
  readonly approvedForRealData = false;
  readonly isDurable = false;

  async dispatch(): Promise<DispatchResult> {
    return {
      success: false,
      failureReason: 'no-approved-destination-configured',
      retriable: true,
    };
  }
}

export const stagingLeadStore = new MemoryStagingAdapter();
const unconfiguredDestination = new UnconfiguredDestinationAdapter();

let registeredProductionAdapter: LeadDestinationAdapter | null = null;

/**
 * Register the approved production destination. Called from deployment wiring
 * once a CRM, database or queue has been selected and reviewed (OWN-07, OWN-08).
 *
 * Throws if the adapter does not declare itself approved and durable, so an
 * unreviewed spreadsheet or append-log cannot be dropped in by mistake.
 */
export function registerProductionLeadDestination(adapter: LeadDestinationAdapter): void {
  if (!adapter.approvedForRealData) {
    throw new Error(
      `Adapter "${adapter.name}" is not marked approvedForRealData and cannot receive real enquiries.`
    );
  }
  if (!adapter.isDurable) {
    throw new Error(
      `Adapter "${adapter.name}" is not durable and cannot be used as a production lead destination.`
    );
  }
  registeredProductionAdapter = adapter;
}

export function clearProductionLeadDestinationForTesting(): void {
  registeredProductionAdapter = null;
}

export type DestinationResolution =
  | { available: true; adapter: LeadDestinationAdapter }
  | { available: false; reason: string };

/**
 * Resolve the destination for the current environment.
 *
 * Production returns a destination only when one has been registered and it
 * declares itself approved and durable. Development and preview fall back to
 * memory staging, which is acceptable because those environments must only ever
 * receive synthetic data.
 */
export function resolveLeadDestination(): DestinationResolution {
  const environment = getDeployEnvironment();

  if (environment === 'production') {
    if (!registeredProductionAdapter) {
      return {
        available: false,
        reason:
          'No approved production lead destination is registered. Real enquiries are not accepted; customers are directed to the phone path.',
      };
    }
    return { available: true, adapter: registeredProductionAdapter };
  }

  if (registeredProductionAdapter) {
    // If a real destination is registered outside production, prefer it only when
    // it is explicitly approved — otherwise keep synthetic traffic in memory.
    return { available: true, adapter: registeredProductionAdapter };
  }

  return { available: true, adapter: stagingLeadStore };
}

/** Exposed so a route can explain an outage without guessing. */
export function getUnconfiguredDestination(): LeadDestinationAdapter {
  return unconfiguredDestination;
}
