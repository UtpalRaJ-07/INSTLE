/**
 * Structured data.
 *
 * A deliberately small, truthful graph. Master prompt section 20:
 *   "Do not invent a public address, map coordinates, opening hours, priceRange,
 *    awards, foundingDate, branch locations, aggregateRating, reviewCount, or
 *    sameAs profiles to complete schema."
 *
 * So the graph contains exactly what is known: the organisation's name, its
 * telephone number, the city it works in, and the owner as a person. `url` and
 * `@id` appear only once the domain is confirmed.
 *
 * Requirement 5.6 adds a second rule: a property value is emitted only when the
 * same value appears in the visible text of the page emitting it. So nothing here
 * carries prose of its own. The organisation has no `description`, because no
 * page shows one; a service page's `Service` node takes its `name` and
 * `description` from that page's `<h1>` and lead, passed in by the page from the
 * same constant it renders.
 *
 * Not used, and why:
 *   - LocalBusiness / RealEstateAgent: both want an address. None is approved
 *     (OWN-04), and inventing one to unlock a search feature is exactly what the
 *     rules forbid. Organization is truthful without it.
 *   - AggregateRating / Review: no genuine reviews exist.
 *   - Offer / RealEstateListing / Product: there is no inventory.
 *   - FAQPage: not needed for the content to be useful.
 */

import { CANONICAL_BRAND } from '@/config/constants';
import { PRIMARY_PHONE } from '@/config/constants';
import { OWNER_PROFILE } from '@/config/owner';
import { absoluteUrl } from '@/config/site';

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
export interface JsonLdObject {
  [key: string]: JsonLdValue | undefined;
}

/**
 * Serialise JSON-LD for embedding in a script tag.
 *
 * `<` is escaped so a value can never terminate the script element, and the
 * Unicode line separators are escaped because they are literal newlines in
 * JavaScript string context.
 */
export function serialiseJsonLd(value: JsonLdObject): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function withOptionalUrl(node: JsonLdObject, path: string): JsonLdObject {
  const url = absoluteUrl(path);
  if (!url) return node;
  return { ...node, '@id': url, url };
}

/**
 * The organisation node. Name and telephone only, plus area served.
 *
 * No `description`: the sentence it used to carry appeared in no visible text on
 * the homepage, and Requirement 5.6 permits a value only when a reader can see
 * it. `contactType` and `availableLanguage` stay, as schema vocabulary rather
 * than claims (`STRUCTURAL_VALUE_KEYS`).
 */
export function buildOrganisationNode(): JsonLdObject {
  return withOptionalUrl(
    {
      '@type': 'Organization',
      name: CANONICAL_BRAND,
      telephone: PRIMARY_PHONE,
      areaServed: { '@type': 'City', name: 'Bengaluru' },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: PRIMARY_PHONE,
        contactType: 'customer service',
        availableLanguage: ['en'],
      },
    },
    '/'
  );
}

/** The owner node. Name and role only — no sameAs, image, or credentials. */
export function buildOwnerNode(): JsonLdObject {
  const organisationUrl = absoluteUrl('/');
  const node: JsonLdObject = {
    '@type': 'Person',
    name: OWNER_PROFILE.name,
    jobTitle: 'Owner and CEO',
  };
  if (organisationUrl) {
    node.worksFor = { '@type': 'Organization', name: CANONICAL_BRAND, '@id': organisationUrl };
  } else {
    node.worksFor = { '@type': 'Organization', name: CANONICAL_BRAND };
  }
  return withOptionalUrl(node, OWNER_PROFILE.route);
}

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

/**
 * Breadcrumbs. Emitted only when every destination has an absolute URL, because
 * a BreadcrumbList without item URLs describes nothing useful.
 */
export function buildBreadcrumbNode(entries: readonly BreadcrumbEntry[]): JsonLdObject | null {
  const items = entries.map((entry) => ({ name: entry.name, url: absoluteUrl(entry.path) }));
  if (items.some((item) => item.url === null)) return null;

  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * What a service page shows a reader first: its `<h1>` and its lead. The page
 * holds this once and passes the same object to `PageIntro` and to
 * `buildServiceGraph`, so the text a machine reads is the text a person reads,
 * character for character, and the two cannot drift apart.
 */
export interface ServiceIntro {
  /** The page's `<h1>`, and the Service node's `name`. */
  readonly title: string;
  /** The page's lead paragraph, and the Service node's `description`. */
  readonly lead: string;
  /** The page's route. Becomes `url` and `@id` once the domain is confirmed. */
  readonly path: string;
}

/**
 * A service page's Service node, provided by the organisation.
 *
 * No `areaServed` of its own and no `serviceType`: the provider already carries
 * the city, and anything further would be a value the page does not show.
 */
export function buildServiceNode(intro: ServiceIntro): JsonLdObject {
  const node: JsonLdObject = {
    '@type': 'Service',
    name: intro.title,
    description: intro.lead,
    provider: buildOrganisationNode(),
  };
  const pageUrl = absoluteUrl(intro.path);
  if (!pageUrl) return node;
  // A fragment, so the Service is not given the identifier of the page itself.
  return { ...node, '@id': `${pageUrl}#service`, url: pageUrl };
}

const SCHEMA_ORG = 'https://schema.org';

/**
 * Root graph used on the homepage and the owner profile, the two pages that show
 * the owner's role. Every other page uses `buildOrganisationGraph` or
 * `buildServiceGraph`, which carry no owner node.
 */
export function buildSiteGraph(extraNodes: readonly JsonLdObject[] = []): JsonLdObject {
  return {
    '@context': SCHEMA_ORG,
    '@graph': [buildOrganisationNode(), buildOwnerNode(), ...extraNodes],
  };
}

/**
 * The graph a guide or locality page emits: the organisation, followed by any
 * page nodes passed in (its breadcrumbs, once the domain is confirmed). The owner
 * node is left out for the same reason as on a service page: the footer names
 * the owner, but neither page shows the owner's role, so the Person node's
 * `jobTitle` would be a value no reader of that page can see (Requirement 5.6).
 */
export function buildOrganisationGraph(extraNodes: readonly JsonLdObject[] = []): JsonLdObject {
  return { '@context': SCHEMA_ORG, '@graph': [buildOrganisationNode(), ...extraNodes] };
}

/**
 * The graph a service page emits: its Service node and nothing else. The owner
 * node is left out because no service page shows the owner's role, so its
 * `jobTitle` would be a value no reader of that page can see.
 */
export function buildServiceGraph(intro: ServiceIntro): JsonLdObject {
  return { '@context': SCHEMA_ORG, '@graph': [buildServiceNode(intro)] };
}
