/**
 * Service capability matrix.
 *
 * The owner answered "everything everything" when asked about scope. The master
 * prompt is explicit that this is *requested product breadth* and does not
 * establish staffing, fees, certifications, or citywide fulfilment.
 *
 * So each intent/asset combination carries a separate coverage status:
 *
 *   'offered'      The brokerage has confirmed it handles this. Describe the service.
 *   'on-request'   Requested by the owner but delivery not yet confirmed. The page
 *                  invites a conversation without claiming capability.
 *   'not-offered'  Explicitly excluded. Hidden from selectors, no public claim.
 *
 * Nothing here may move to 'offered' without an owner/operations confirmation
 * recorded in docs/implementation/CAPABILITY-MATRIX.md (OWN-03).
 */

import type { CustomerIntent } from './constants';

export type CoverageStatus = 'offered' | 'on-request' | 'not-offered';

export type AssetTypeId =
  | 'flat'
  | 'independent-house'
  | 'villa'
  | 'plot'
  | 'office'
  | 'shop'
  | 'warehouse'
  | 'industrial'
  | 'other';

export interface AssetType {
  id: AssetTypeId;
  /** Customer-facing label in Indian English. */
  label: string;
  /** Plain description used as field help where useful. */
  hint?: string;
  category: 'residential' | 'commercial' | 'other';
}

export const ASSET_TYPES: readonly AssetType[] = [
  { id: 'flat', label: 'Flat / apartment', category: 'residential' },
  { id: 'independent-house', label: 'Independent house', category: 'residential' },
  { id: 'villa', label: 'Villa', category: 'residential' },
  { id: 'plot', label: 'Site / plot', hint: 'Residential site or plot', category: 'residential' },
  { id: 'office', label: 'Office space', category: 'commercial' },
  { id: 'shop', label: 'Shop / showroom', category: 'commercial' },
  { id: 'warehouse', label: 'Warehouse / godown', category: 'commercial' },
  { id: 'industrial', label: 'Industrial property', category: 'commercial' },
  { id: 'other', label: 'Other — discuss with the team', category: 'other' },
] as const;

const ASSET_TYPE_BY_ID = new Map(ASSET_TYPES.map((asset) => [asset.id, asset]));

export function getAssetType(id: string): AssetType | undefined {
  return ASSET_TYPE_BY_ID.get(id as AssetTypeId);
}

export interface ServiceCapability {
  intent: CustomerIntent;
  assetType: AssetTypeId;
  coverage: CoverageStatus;
  /** Who inside the business owns delivery. Null until operations assign it. */
  responsibleOwner: string | null;
  /** Why this status was chosen. Shown in internal docs, not on the website. */
  basis: string;
}

/**
 * Residential buy/sell/rent/rent-out is the service the existing site already
 * describes and the brokerage identity is built on, so it is treated as offered.
 * Everything commercial stays on-request until operations confirm capability.
 */
const REQUESTED_BUT_UNCONFIRMED =
  'Requested by the owner as part of "everything everything"; delivery capability not yet confirmed (OWN-03).';
const EXISTING_CORE_SERVICE =
  'Core residential brokerage service already described across the existing site and the blueprint V1 scope.';

function row(
  intent: CustomerIntent,
  assetType: AssetTypeId,
  coverage: CoverageStatus,
  basis: string
): ServiceCapability {
  return { intent, assetType, coverage, responsibleOwner: null, basis };
}

const RESIDENTIAL_SALE_ASSETS: AssetTypeId[] = ['flat', 'independent-house', 'villa', 'plot'];
const RESIDENTIAL_RENTAL_ASSETS: AssetTypeId[] = ['flat', 'independent-house', 'villa'];
const COMMERCIAL_ASSETS: AssetTypeId[] = ['office', 'shop', 'warehouse', 'industrial'];

export const SERVICE_MATRIX: readonly ServiceCapability[] = [
  // Buying and selling residential property.
  ...RESIDENTIAL_SALE_ASSETS.flatMap((asset) => [
    row('buy', asset, 'offered', EXISTING_CORE_SERVICE),
    row('sell', asset, 'offered', EXISTING_CORE_SERVICE),
  ]),
  // Renting and renting out residential property. A plot is not a rental home.
  ...RESIDENTIAL_RENTAL_ASSETS.flatMap((asset) => [
    row('rent', asset, 'offered', EXISTING_CORE_SERVICE),
    row('rent-out', asset, 'offered', EXISTING_CORE_SERVICE),
  ]),
  row('rent', 'plot', 'not-offered', 'Renting a residential site is not a service this site describes.'),
  row('rent-out', 'plot', 'not-offered', 'Renting out a residential site is not a service this site describes.'),

  // Commercial property, all intents. Requested, not confirmed.
  ...COMMERCIAL_ASSETS.flatMap((asset) => [
    row('buy', asset, 'on-request', REQUESTED_BUT_UNCONFIRMED),
    row('sell', asset, 'on-request', REQUESTED_BUT_UNCONFIRMED),
    row('rent', asset, 'on-request', REQUESTED_BUT_UNCONFIRMED),
    row('rent-out', asset, 'on-request', REQUESTED_BUT_UNCONFIRMED),
    row('commercial', asset, 'on-request', REQUESTED_BUT_UNCONFIRMED),
  ]),

  // "Other" always stays available as a conversation, never as claimed expertise.
  row('buy', 'other', 'on-request', 'General discussion route; no specialist expertise claimed.'),
  row('sell', 'other', 'on-request', 'General discussion route; no specialist expertise claimed.'),
  row('rent', 'other', 'on-request', 'General discussion route; no specialist expertise claimed.'),
  row('rent-out', 'other', 'on-request', 'General discussion route; no specialist expertise claimed.'),
  row('commercial', 'other', 'on-request', 'General discussion route; no specialist expertise claimed.'),
  row('general', 'other', 'on-request', 'General discussion route; no specialist expertise claimed.'),
] as const;

export function getCoverage(intent: CustomerIntent, assetType: AssetTypeId): CoverageStatus {
  const match = SERVICE_MATRIX.find((row) => row.intent === intent && row.assetType === assetType);
  return match?.coverage ?? 'not-offered';
}

/** Asset types a customer may select for an intent. Excludes 'not-offered'. */
export function getSelectableAssetTypes(intent: CustomerIntent): readonly AssetType[] {
  return ASSET_TYPES.filter((asset) => getCoverage(intent, asset.id) !== 'not-offered');
}

/** Asset types the site may actively describe as a service for an intent. */
export function getOfferedAssetTypes(intent: CustomerIntent): readonly AssetType[] {
  return ASSET_TYPES.filter((asset) => getCoverage(intent, asset.id) === 'offered');
}

/** True when at least one asset type for this intent is confirmed as offered. */
export function isIntentConfirmedOffered(intent: CustomerIntent): boolean {
  return SERVICE_MATRIX.some((row) => row.intent === intent && row.coverage === 'offered');
}

/**
 * Geographic coverage.
 *
 * No locality is confirmed as operationally served. Until operations supply the
 * territory matrix, the site describes Bengaluru generally and never claims a
 * staffed presence in a named area or PIN code.
 */
export const CONFIRMED_SERVICE_AREAS: readonly string[] = [] as const;

export const GEOGRAPHIC_COVERAGE_STATEMENT =
  'We work across Bengaluru. Tell us the area you have in mind and we will say straight away whether we can help there.';
