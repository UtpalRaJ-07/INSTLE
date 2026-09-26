/**
 * Lead Operations & Advisory Enquiry Pipeline for INSTLE REAL ESTATE
 * Sourced from Blueprint M7 & Recovery Brief Section 3
 * 
 * Complies with India DPDP Act 2023 principles:
 * - Affirmative consent required (strictly boolean true)
 * - Data minimization: fields restricted to verified advisory requirements
 * - Memory-isolated staging store retaining full enquiry payload for desk review
 * - Zero PII in diagnostic telemetry or log streams
 */

import { trackSafeEvent } from './telemetry';

export type LeadIntent = 'buy' | 'rent' | 'sell' | 'rent-out' | 'general';

export interface LeadPayload {
  intent: LeadIntent;
  assetType?: string;
  localities?: string[];
  budgetBand?: string;
  timeline?: string;
  furnishing?: string;
  leaseDuration?: string;
  ownershipRole?: string;
  propertyAddressOrNotes?: string;
  contactPreference?: string;
  name: string;
  phone: string;
  consent: boolean;
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
    contactPreference: string;
  };
  requirement: {
    assetType: string;
    localities: string[];
    budgetBand: string;
    timeline: string;
    furnishing?: string;
    leaseDuration?: string;
    ownershipRole?: string;
    notes?: string;
  };
  governance: {
    dpdpConsentGiven: boolean;
    consentTimestamp: string;
    retentionExpiresAt: string;
    assignedBrokerId: string;
    status: LeadDisposition;
  };
}

/**
 * Pluggable Lead Destination Adapter Contract
 * Prepares the platform for production CRM integration (Decision D-09)
 */
export interface LeadDestinationAdapter {
  name: string;
  dispatch(record: StoredLeadRecord): Promise<{ success: boolean; externalId?: string; error?: string }>;
}

/**
 * In-Memory Staging Adapter for Local Development and Staging Verification
 * Retains complete records securely without writing unreviewed plaintext to disk
 */
class MemoryStagingAdapter implements LeadDestinationAdapter {
  name = 'Internal Memory Staging Adapter';
  private records: Map<string, StoredLeadRecord> = new Map();

  async dispatch(record: StoredLeadRecord) {
    this.records.set(record.id, record);
    return { success: true, externalId: record.id };
  }

  getRecord(id: string): StoredLeadRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): StoredLeadRecord[] {
    return Array.from(this.records.values());
  }

  clear() {
    this.records.clear();
  }
}

export const stagingLeadStore = new MemoryStagingAdapter();

// Sliding-window rate limiting store (IP or client identifier -> timestamps)
const RATE_LIMIT_STORE = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 5;

// Idempotency store (dedupeKey -> { leadId, timestamp })
const IDEMPOTENCY_STORE = new Map<string, { leadId: string; timestamp: number }>();
const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitizedPayload?: LeadPayload;
}

/**
 * Strict Runtime Schema Validation
 */
export function validateLeadPayload(raw: unknown): ValidationResult {
  const errors: Record<string, string> = {};

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: { request: 'Request body must be a valid JSON object.' } };
  }

  const data = raw as Record<string, unknown>;

  // 1. Mandatory DPDP Consent Check (strictly boolean true)
  if (data.consent !== true) {
    errors.consent = 'Affirmative DPDP consent acknowledgment is required.';
  }

  // 2. Intent validation
  const validIntents: LeadIntent[] = ['buy', 'rent', 'sell', 'rent-out', 'general'];
  const rawIntent = String(data.intent || '').trim() as LeadIntent;
  if (!validIntents.includes(rawIntent)) {
    errors.intent = 'Invalid enquiry intent. Must be buy, rent, sell, rent-out, or general.';
  }

  // 3. Name validation (2-100 characters, no dangerous scripts)
  const rawName = String(data.name || '').trim();
  if (!rawName || rawName.length < 2) {
    errors.name = 'Please provide your full legal or representative name (at least 2 characters).';
  } else if (rawName.length > 100) {
    errors.name = 'Name cannot exceed 100 characters.';
  } else if (/[<>{}]/.test(rawName)) {
    errors.name = 'Name contains invalid characters.';
  }

  // 4. Phone validation: Indian 10-digit mobile or valid E.164 phone
  const cleanPhone = String(data.phone || '').replace(/[^0-9]/g, '');
  // Valid Indian mobile numbers start with 6, 7, 8, or 9 and are 10 digits (or 12 with 91 prefix)
  const isIndian10Digit = /^[6-9]\d{9}$/.test(cleanPhone);
  const isIndianWith91 = /^91[6-9]\d{9}$/.test(cleanPhone);
  const isStandardValid = cleanPhone.length >= 10 && cleanPhone.length <= 15;

  if (!cleanPhone) {
    errors.phone = 'Telephone contact number is required.';
  } else if (!isIndian10Digit && !isIndianWith91 && !isStandardValid) {
    errors.phone = 'Please provide a valid telephone number (e.g. 10-digit Indian mobile number).';
  }

  // 5. Array and bounds checks
  let localities: string[] = [];
  if (Array.isArray(data.localities)) {
    localities = data.localities
      .map((loc) => String(loc).trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 10);
  }

  const assetType = String(data.assetType || 'Open to Guidance').trim().slice(0, 100);
  const budgetBand = data.budgetBand ? String(data.budgetBand).trim().slice(0, 100) : 'Open to Discussion';
  const timeline = data.timeline ? String(data.timeline).trim().slice(0, 100) : 'Flexible';
  const furnishing = data.furnishing ? String(data.furnishing).trim().slice(0, 100) : undefined;
  const leaseDuration = data.leaseDuration ? String(data.leaseDuration).trim().slice(0, 100) : undefined;
  const ownershipRole = data.ownershipRole ? String(data.ownershipRole).trim().slice(0, 100) : undefined;
  const propertyAddressOrNotes = data.propertyAddressOrNotes
    ? String(data.propertyAddressOrNotes).trim().slice(0, 500)
    : undefined;
  const contactPreference = data.contactPreference
    ? String(data.contactPreference).trim().slice(0, 50)
    : 'Phone Call';
  const idempotencyKey = data.idempotencyKey ? String(data.idempotencyKey).trim().slice(0, 128) : undefined;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const normalizedPhone = isIndianWith91 ? cleanPhone.slice(2) : cleanPhone;

  return {
    valid: true,
    errors: {},
    sanitizedPayload: {
      intent: rawIntent,
      assetType,
      localities,
      budgetBand,
      timeline,
      furnishing,
      leaseDuration,
      ownershipRole,
      propertyAddressOrNotes,
      contactPreference,
      name: rawName,
      phone: normalizedPhone,
      consent: true,
      idempotencyKey,
    },
  };
}

/**
 * Check and record client rate limiting
 */
export function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = (RATE_LIMIT_STORE.get(clientId) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  RATE_LIMIT_STORE.set(clientId, timestamps);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - timestamps.length };
}

/**
 * Process and persist an advisory enquiry safely into the staging queue
 */
export async function processLeadEnquiry(
  payload: LeadPayload,
  adapter: LeadDestinationAdapter = stagingLeadStore
): Promise<{
  success: boolean;
  leadId?: string;
  isDuplicate?: boolean;
  error?: string;
  record?: StoredLeadRecord;
}> {
  // 1. Check idempotency / deduplication
  const dedupeKey =
    payload.idempotencyKey ||
    `${payload.phone}-${payload.intent}-${(payload.localities || []).sort().join(',')}-${payload.budgetBand || ''}`;
  const now = Date.now();
  const existing = IDEMPOTENCY_STORE.get(dedupeKey);

  if (existing && now - existing.timestamp < IDEMPOTENCY_WINDOW_MS) {
    const existingRecord = stagingLeadStore.getRecord(existing.leadId);
    return {
      success: true,
      leadId: existing.leadId,
      isDuplicate: true,
      record: existingRecord,
    };
  }

  // 2. Generate formal reference ID
  const leadId = `IRE-${payload.intent.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // 3. Assemble complete stored lead record
  const record: StoredLeadRecord = {
    id: leadId,
    createdAt: new Date().toISOString(),
    intent: payload.intent,
    customer: {
      name: payload.name,
      phone: payload.phone,
      contactPreference: payload.contactPreference || 'Phone Call',
    },
    requirement: {
      assetType: payload.assetType || 'Open to Guidance',
      localities: payload.localities || [],
      budgetBand: payload.budgetBand || 'Open to Discussion',
      timeline: payload.timeline || 'Flexible',
      furnishing: payload.furnishing,
      leaseDuration: payload.leaseDuration,
      ownershipRole: payload.ownershipRole,
      notes: payload.propertyAddressOrNotes,
    },
    governance: {
      dpdpConsentGiven: true,
      consentTimestamp: new Date().toISOString(),
      retentionExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      assignedBrokerId: 'IRE-DESK-BENGALURU-CORE',
      status: 'new',
    },
  };

  // 4. Dispatch to adapter (memory staging store)
  await adapter.dispatch(record);

  // 5. Record idempotency
  IDEMPOTENCY_STORE.set(dedupeKey, { leadId, timestamp: now });

  // 6. Emit zero-PII safe telemetry
  trackSafeEvent('form_submit_success', {
    intent: payload.intent,
    statusCode: 200,
  });

  return {
    success: true,
    leadId,
    isDuplicate: false,
    record,
  };
}

export function resetLeadOperationsForTesting() {
  stagingLeadStore.clear();
  IDEMPOTENCY_STORE.clear();
  RATE_LIMIT_STORE.clear();
}
