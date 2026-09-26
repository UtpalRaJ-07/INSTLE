/**
 * Lead Operations & Synthetic CRM Queue Adapter
 * Complies with Blueprint M7 & Recovery Brief Section 3
 */

export interface LeadPayload {
  intent: 'buy' | 'rent' | 'sell' | 'rent-out' | 'general';
  assetType: string;
  localities?: string[];
  budgetBand?: string;
  timeline?: string;
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

export interface LeadQueueRecord {
  id: string;
  createdAt: string;
  intent: string;
  assetType: string;
  localityCount: number;
  status: LeadDisposition;
  retentionExpiresAt: string;
  assignedBrokerId: string;
  // Note: PII is encrypted/isolated and never written to diagnostic log streams
}

// In-memory synthetic queue fixture for local testing and demonstration
const SYNTHETIC_LEAD_QUEUE: LeadQueueRecord[] = [];
const IDEMPOTENCY_STORE = new Map<string, { leadId: string; timestamp: number }>();

/**
 * Validate and enqueue an advisory enquiry safely
 */
export function processSyntheticEnquiry(payload: LeadPayload): {
  success: boolean;
  leadId?: string;
  error?: string;
  isDuplicate?: boolean;
} {
  // 1. Mandatory Consent Check (DPDP Act 2023)
  if (!payload.consent) {
    return { success: false, error: 'DPDP consent acknowledgment is mandatory.' };
  }

  // 2. Validate Contact Fields
  const cleanName = payload.name.trim();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Valid client name required.' };
  }

  const cleanPhone = payload.phone.replace(/[^0-9+]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Valid telephone contact required.' };
  }

  // 3. Idempotency & Duplicate Prevention
  const dedupeKey = payload.idempotencyKey || `${cleanPhone}-${payload.intent}`;
  const now = Date.now();
  const existing = IDEMPOTENCY_STORE.get(dedupeKey);

  if (existing && now - existing.timestamp < 15 * 60 * 1000) {
    return {
      success: true,
      leadId: existing.leadId,
      isDuplicate: true,
    };
  }

  // 4. Generate Synthetic Queue Entry
  const leadId = `IRE-SYN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  const record: LeadQueueRecord = {
    id: leadId,
    createdAt: new Date().toISOString(),
    intent: payload.intent,
    assetType: payload.assetType,
    localityCount: payload.localities?.length || 1,
    status: 'new',
    retentionExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    assignedBrokerId: 'BROKER-BENGALURU-DESK-01',
  };

  SYNTHETIC_LEAD_QUEUE.push(record);
  IDEMPOTENCY_STORE.set(dedupeKey, { leadId, timestamp: now });

  return {
    success: true,
    leadId,
    isDuplicate: false,
  };
}

export function getSyntheticQueueMetrics() {
  return {
    totalEnqueued: SYNTHETIC_LEAD_QUEUE.length,
    activePending: SYNTHETIC_LEAD_QUEUE.filter((r) => r.status === 'new').length,
  };
}
