/**
 * Canonical Project Constants for INSTLE REAL ESTATE
 * Sourced directly from blueprint instructions.
 */

export const CANONICAL_BRAND = 'INSTLE REAL ESTATE';
export const SHORT_BRAND = 'INSTLE';

/**
 * Primary business contact phone.
 * Canonical digits: 9353096264.
 * Not to be assumed as a WhatsApp number.
 */
export const PRIMARY_PHONE = '9353096264';
export const PRIMARY_PHONE_TEL = 'tel:9353096264';

/**
 * Domain status is unconfirmed until explicitly provided by owner.
 * Canonical links and sitemaps remain omitted while unset.
 */
export const DOMAIN_STATUS = 'TO BE CONFIRMED';

/**
 * Prohibited brand terms per blueprint lines 129, 584.
 */
export const PROHIBITED_BRAND_TERMS = [
  'LUXERE',
  'Luxere',
  'Generic Real Estate',
  'Instle Real Estate', // Mixed case prohibited; canonical must be all-caps lockup
] as const;

export const PRIMARY_NAV_ITEMS = [
  { label: 'Buy', href: '/buy' },
  { label: 'Rent', href: '/rent' },
  { label: 'Sell', href: '/sell' },
  { label: 'Areas', href: '/areas' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Contact', href: '/contact' },
] as const;
