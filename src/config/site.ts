/**
 * Environment, verified public origin, and launch-readiness configuration.
 *
 * Master prompt section 19 ("Domain-dependent SEO gate"):
 *   "A production host string alone does not constitute owner confirmation of the
 *    canonical domain."
 *
 * So two separate signals are required before any absolute public URL is emitted:
 *   1. INSTLE_PUBLIC_ORIGIN — the exact https origin the owner purchased.
 *   2. INSTLE_DOMAIN_CONFIRMED=true — an explicit owner confirmation flag.
 *
 * A hosting provider's own host variable (VERCEL_URL and friends) is deliberately
 * NOT consulted, and a forwarded request header is never used to build a canonical
 * URL. Both would let a preview deployment invent a canonical origin.
 */

export type DeployEnvironment = 'development' | 'preview' | 'production';

export interface SiteOriginState {
  /** True only when the owner has both supplied and confirmed the origin. */
  domainConfirmed: boolean;
  /** The verified origin, e.g. "https://example.com". Null while unconfirmed. */
  origin: string | null;
  /** Human-readable status for docs and internal surfaces. */
  status: string;
  /** Why the origin was rejected, when it was supplied but not usable. */
  rejectionReason: string | null;
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY.has(value.toLowerCase());
}

export function getDeployEnvironment(): DeployEnvironment {
  const explicit = readEnv('INSTLE_DEPLOY_ENV')?.toLowerCase();
  if (explicit === 'production' || explicit === 'preview' || explicit === 'development') {
    return explicit;
  }
  // Without an explicit value, anything built for production is treated as a
  // PREVIEW, not production. That way a preview deployment can never inherit
  // production indexing permission by accident.
  return process.env.NODE_ENV === 'production' ? 'preview' : 'development';
}

/**
 * Normalise and validate a supplied origin. Returns null if it is not an
 * absolute https origin without path, query or fragment.
 */
export function parsePublicOrigin(raw: string | undefined): { origin: string | null; reason: string | null } {
  if (!raw) return { origin: null, reason: null };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { origin: null, reason: 'INSTLE_PUBLIC_ORIGIN is not a valid absolute URL.' };
  }
  if (url.protocol !== 'https:') {
    return { origin: null, reason: 'INSTLE_PUBLIC_ORIGIN must use https.' };
  }
  if (url.username || url.password) {
    return { origin: null, reason: 'INSTLE_PUBLIC_ORIGIN must not contain credentials.' };
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    return {
      origin: null,
      reason: 'INSTLE_PUBLIC_ORIGIN must be a bare origin with no path, query or fragment.',
    };
  }
  return { origin: url.origin, reason: null };
}

export function getSiteOriginState(): SiteOriginState {
  const confirmed = isTruthy(readEnv('INSTLE_DOMAIN_CONFIRMED'));
  const { origin, reason } = parsePublicOrigin(readEnv('INSTLE_PUBLIC_ORIGIN'));

  if (!confirmed) {
    return {
      domainConfirmed: false,
      origin: null,
      status: 'TO BE CONFIRMED',
      rejectionReason: origin
        ? 'An origin was supplied but INSTLE_DOMAIN_CONFIRMED is not set, so it is not treated as canonical.'
        : reason,
    };
  }

  if (!origin) {
    return {
      domainConfirmed: false,
      origin: null,
      status: 'TO BE CONFIRMED',
      rejectionReason:
        reason ?? 'INSTLE_DOMAIN_CONFIRMED is set but INSTLE_PUBLIC_ORIGIN is missing or unusable.',
    };
  }

  return { domainConfirmed: true, origin, status: origin, rejectionReason: null };
}

/** True only when a self-referencing canonical / sitemap / absolute OG URL may be emitted. */
export function isDomainConfirmed(): boolean {
  return getSiteOriginState().domainConfirmed;
}

/** The verified origin, or null. Never guess a fallback. */
export function getPublicOrigin(): string | null {
  return getSiteOriginState().origin;
}

/**
 * Whether search engines may index this deployment at all.
 * Requires production environment AND a confirmed domain, so development and
 * preview builds stay out of the index even if they are publicly reachable.
 */
export function isSearchIndexingAllowed(): boolean {
  return getDeployEnvironment() === 'production' && isDomainConfirmed();
}

/** Build an absolute URL for a path, or null while the domain is unconfirmed. */
export function absoluteUrl(path: string): string | null {
  const origin = getPublicOrigin();
  if (!origin) return null;
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return normalised === '/' ? origin : `${origin}${normalised}`;
}

/**
 * Whether the enquiry form may accept real personal data.
 *
 * Requires an explicit operator opt-in. Until the owner supplies an approved
 * destination, notice text and retention process (OWN-07, OWN-08, OWN-09) this
 * stays false and the site runs in call-only mode.
 */
export function isRealIntakeEnabled(): boolean {
  return isTruthy(readEnv('INSTLE_ENQUIRY_INTAKE_ENABLED'));
}
