/**
 * Shared lead types.
 *
 * Kept in their own module so the destination adapters and the processing pipeline
 * can both import them without a circular dependency.
 */

import type { CustomerIntent } from '@/config/constants';
import type { AssetTypeId } from '@/config/service-matrix';

export type LeadIntent = CustomerIntent;

/** Budget preference bands. Enum values, not free text. */
export type BudgetBandId =
  | 'under-50-lakh'
  | '50-lakh-to-1-crore'
  | '1-to-2-5-crore'
  | '2-5-to-5-crore'
  | 'above-5-crore'
  | 'prefer-to-discuss';

/** Monthly rent preference bands. */
export type RentBandId =
  | 'under-15000'
  | '15000-to-30000'
  | '30000-to-60000'
  | '60000-to-1-lakh'
  | 'above-1-lakh'
  | 'prefer-to-discuss';

export type TimelineId =
  | 'within-30-days'
  | '1-to-3-months'
  | '3-to-6-months'
  | 'later'
  | 'not-decided';

export type FurnishingId = 'unfurnished' | 'semi-furnished' | 'fully-furnished' | 'no-preference';

export type OwnershipRoleId = 'owner' | 'co-owner' | 'authorised-representative' | 'other';

export type ContactPreferenceId = 'phone-call' | 'phone-call-morning' | 'phone-call-evening';

export interface LeadPayload {
  intent: LeadIntent;
  assetType: AssetTypeId;
  /** Free-text area names the customer typed, length-bounded. */
  preferredAreas: readonly string[];
  budgetBand?: BudgetBandId;
  rentBand?: RentBandId;
  timeline?: TimelineId;
  furnishing?: FurnishingId;
  ownershipRole?: OwnershipRoleId;
  /** Bedroom configuration, e.g. "2 BHK". Enum-constrained upstream. */
  configuration?: string;
  /** Short customer note. Never logged, never sent to analytics. */
  notes?: string;
  contactPreference: ContactPreferenceId;
  name: string;
  /** Normalised digits. Stored, never logged. */
  phone: string;
  /** Must be literal true. */
  consent: boolean;
  /** Optional separate marketing permission. Defaults to false, never preselected. */
  marketingConsent: boolean;
  /** Client-supplied idempotency token. Not personal data. */
  idempotencyKey?: string;
}

export type LeadDisposition =
  | 'new'
  | 'assigned'
  | 'contact_attempted'
  | 'qualified'
  | 'closed_lost'
  | 'do_not_contact';

export interface StoredLeadRecord {
  id: string;
  createdAt: string;
  intent: LeadIntent;
  customer: {
    name: string;
    phone: string;
    contactPreference: ContactPreferenceId;
  };
  requirement: {
    assetType: AssetTypeId;
    preferredAreas: readonly string[];
    budgetBand?: BudgetBandId;
    rentBand?: RentBandId;
    timeline?: TimelineId;
    furnishing?: FurnishingId;
    ownershipRole?: OwnershipRoleId;
    configuration?: string;
    notes?: string;
  };
  governance: {
    /** Affirmative consent to be contacted about this requirement. */
    serviceConsentGiven: true;
    consentTimestamp: string;
    /** Version of the notice the customer actually saw. */
    consentNoticeVersion: string;
    /** Separate optional permission. */
    marketingConsentGiven: boolean;
    /**
     * Proposed deletion date, present only when a retention period has been
     * configured. A timestamp is not an enforcement mechanism; the destination
     * implements deletion.
     */
    proposedRetentionUntil: string | null;
    retentionPolicyConfigured: boolean;
    status: LeadDisposition;
    /** Queue that owns follow-up. Null until operations assign one. */
    assignedQueue: string | null;
  };
}
