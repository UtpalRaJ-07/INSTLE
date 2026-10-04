/**
 * Canonical Project Constants for INSTLE REAL ESTATE
 *
 * Sourced from AGENTS.md section 2 and the master blueprint section 5.
 * These values are project invariants. Do not localise, reformat, or "improve" them.
 */

export const CANONICAL_BRAND = 'INSTLE REAL ESTATE';
export const SHORT_BRAND = 'INSTLE';

/**
 * Primary business contact phone.
 * Canonical digits: 9353096264.
 * Not to be assumed as a WhatsApp number. No country prefix or visual formatting
 * may be added without owner approval (AGENTS.md section 2).
 */
export const PRIMARY_PHONE = '9353096264';
export const PRIMARY_PHONE_TEL = 'tel:9353096264';

/**
 * Domain status is unconfirmed until explicitly provided by the owner.
 * Canonical links, absolute URLs and sitemaps remain omitted while unset.
 * See src/config/site.ts for the runtime gate.
 */
export const DOMAIN_STATUS = 'TO BE CONFIRMED';

/**
 * Prohibited brand terms per blueprint section 5.
 */
export const PROHIBITED_BRAND_TERMS = [
  'LUXERE',
  'Luxere',
  'Generic Real Estate',
  'Instle Real Estate', // Mixed case prohibited; canonical must be all-caps lockup
] as const;

/**
 * The four customer intents the owner asked for, plus the commercial path.
 * `slug` doubles as the telemetry enum value, so it must stay stable.
 */
export type CustomerIntent = 'buy' | 'rent' | 'sell' | 'rent-out' | 'commercial' | 'general';

export interface IntentDefinition {
  intent: CustomerIntent;
  /** First-person action label, as the master prompt's copy direction requires. */
  actionLabel: string;
  /** Short plain-English description of who the path is for. */
  audience: string;
  href: string;
}

export const CUSTOMER_INTENTS: readonly IntentDefinition[] = [
  {
    intent: 'buy',
    actionLabel: 'I want to buy',
    audience: 'For buyers looking for a flat, independent house, villa or site.',
    href: '/buy',
  },
  {
    intent: 'sell',
    actionLabel: 'I want to sell',
    audience: 'For owners who want to sell a property they own or represent.',
    href: '/sell',
  },
  {
    intent: 'rent',
    actionLabel: 'I want to rent',
    audience: 'For tenants looking for a home on rent.',
    href: '/rent',
  },
  {
    intent: 'rent-out',
    actionLabel: 'I want to rent out',
    audience: 'For landlords who want to rent out a flat, house or villa.',
    href: '/rent-out',
  },
] as const;

/**
 * Primary navigation. Kept short so the mobile drawer stays scannable;
 * secondary pages are grouped rather than listed flat.
 *
 * Retained as a flat array under the original export name because existing
 * components import it. NAV_GROUPS below is the grouped view.
 */
export const PRIMARY_NAV_ITEMS = [
  { label: 'Buy', href: '/buy' },
  { label: 'Rent', href: '/rent' },
  { label: 'Sell', href: '/sell' },
  { label: 'Rent out', href: '/rent-out' },
  { label: 'Commercial', href: '/commercial' },
  { label: 'Areas', href: '/areas' },
  { label: 'Guides', href: '/guides' },
  { label: 'How we help', href: '/how-it-works' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
] as const;

export interface NavGroup {
  /** Group heading. `null` means render the links without a heading. */
  title: string | null;
  items: readonly { label: string; href: string }[];
}

/** Shown inline in the desktop header. */
export const HEADER_NAV_ITEMS = [
  { label: 'Buy', href: '/buy' },
  { label: 'Rent', href: '/rent' },
  { label: 'Sell', href: '/sell' },
  { label: 'Rent out', href: '/rent-out' },
  { label: 'Areas', href: '/areas' },
  { label: 'Contact', href: '/contact' },
] as const;

/** Full grouped navigation, used by the mobile drawer and the footer. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: 'Tell us what you need',
    items: [
      { label: 'Buy property', href: '/buy' },
      { label: 'Sell property', href: '/sell' },
      { label: 'Rent a home', href: '/rent' },
      { label: 'Rent out property', href: '/rent-out' },
      { label: 'Commercial property', href: '/commercial' },
    ],
  },
  {
    title: 'Bengaluru',
    items: [
      { label: 'Areas we cover', href: '/areas' },
      { label: 'Guides', href: '/guides' },
    ],
  },
  {
    title: 'About us',
    items: [
      { label: 'How we help', href: '/how-it-works' },
      { label: `About ${CANONICAL_BRAND}`, href: '/about' },
      { label: 'Utpal Raj KB', href: '/about/utpal-raj-kb' },
      { label: 'Contact', href: '/contact' },
    ],
  },
] as const;

/**
 * Route prefixes that are private design material. They must stay out of
 * navigation, sitemaps and public linking, and must remain noindex.
 */
export const PROTOTYPE_ROUTE_PREFIXES = ['/concept-1', '/concept-2', '/concept-review'] as const;

export function isPrototypeRoute(pathname: string): boolean {
  return PROTOTYPE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
