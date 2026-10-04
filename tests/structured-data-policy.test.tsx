import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from '@/app/page';
import {
  FORBIDDEN_KEYS,
  PERMITTED_NESTED_TYPES,
  PERMITTED_TYPES,
  SCHEMA_ORG_CONTEXT,
  STRUCTURAL_VALUE_KEYS,
  auditGraph,
  findHostname,
  normaliseVisibleText,
} from '@/lib/structured-data-policy';
import { buildOrganisationNode, buildSiteGraph, type JsonLdObject } from '@/lib/structured-data';

/**
 * Task 13.1. The structured data policy: the permitted types, the vocabulary
 * allowlist, the forbidden keys, and `auditGraph` returning every failure by path.
 * Requirements 5.6, 5.7, 5.8 and 5.13.
 */

function confirmDomain(origin = 'https://example-instle.test') {
  process.env.INSTLE_PUBLIC_ORIGIN = origin;
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
}

/** The path each failure names, which is everything before the first `: `. */
function pathsOf(failures: readonly string[]): string[] {
  return failures.map((failure) => failure.slice(0, failure.indexOf(': ')));
}

function hostnameFailures(failures: readonly string[]): string[] {
  return failures.filter((failure) => failure.includes('carries the hostname'));
}

/**
 * Text a reader sees. Script and style bodies go first, so the JSON-LD in the
 * page can never supply the text it is being checked against. React's `<!-- -->`
 * separators sit between adjacent text nodes, so they are removed rather than
 * turned into a space.
 */
function visibleTextOf(markup: string): string {
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const VISIBLE = 'INSTLE REAL ESTATE helps people buy property in Bengaluru. Call 9353096264.';

function graphOf(...nodes: JsonLdObject[]): JsonLdObject {
  return { '@context': SCHEMA_ORG_CONTEXT, '@graph': nodes };
}

const ORGANISATION: JsonLdObject = {
  '@type': 'Organization',
  name: 'INSTLE REAL ESTATE',
  telephone: '9353096264',
  areaServed: { '@type': 'City', name: 'Bengaluru' },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '9353096264',
    contactType: 'customer service',
    availableLanguage: ['en'],
  },
};

describe('the policy constants', () => {
  it('permits exactly the seven types Requirement 5.6 lists', () => {
    expect([...PERMITTED_TYPES]).toEqual([
      'Organization',
      'Person',
      'BreadcrumbList',
      'WebSite',
      'WebPage',
      'Service',
      'Article',
    ]);
  });

  /**
   * Every key added here is a key whose values no longer have to be true on the
   * page. Adding one therefore means editing this test on purpose.
   *
   * Raised from 7 to 8 by task 13.2 for `item`. A breadcrumb `ListItem.item`
   * holds the crumb's URL, an identifier exactly like `@id` and `url`; without
   * the exemption every BreadcrumbList would fail the visible-text rule the
   * moment the domain is confirmed and breadcrumbs start being emitted. The
   * hostname rule still applies to it while the domain is unconfirmed.
   */
  it('keeps the vocabulary allowlist short and explicit', () => {
    const MAX_STRUCTURAL_VALUE_KEYS = 8;
    expect([...STRUCTURAL_VALUE_KEYS]).toEqual([
      '@type',
      '@context',
      '@id',
      'url',
      'item',
      'position',
      'contactType',
      'availableLanguage',
    ]);
    expect(STRUCTURAL_VALUE_KEYS.length).toBeLessThanOrEqual(MAX_STRUCTURAL_VALUE_KEYS);
  });

  it('exempts a breadcrumb item URL from visibility, but not from the hostname rule', () => {
    const breadcrumbs = graphOf({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bengaluru', item: 'https://example-instle.test/buy' },
      ],
    });
    expect(auditGraph(breadcrumbs, VISIBLE, { domainConfirmed: true })).toEqual({ ok: true, failures: [] });
    expect(auditGraph(breadcrumbs, VISIBLE, { domainConfirmed: false }).failures).toEqual([
      '@graph[0].itemListElement[0].item: "https://example-instle.test/buy" carries the hostname "example-instle.test" while the domain is unconfirmed',
    ]);

    // An object under `item` is not exempt: its values are checked under their own keys.
    const asThing = graphOf({
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Bengaluru', item: { name: 'Hidden page' } }],
    });
    expect(auditGraph(asThing, VISIBLE, { domainConfirmed: true }).failures).toEqual([
      '@graph[0].itemListElement[0].item.name: "Hidden page" does not appear in the visible text of the page',
    ]);
  });

  it('exempts no key that carries a claim about the business', () => {
    for (const key of ['name', 'description', 'telephone', 'jobTitle', 'headline', 'serviceType']) {
      expect(STRUCTURAL_VALUE_KEYS as readonly string[], key).not.toContain(key);
    }
  });

  it('forbids every business fact Requirement 5.7 names', () => {
    expect([...FORBIDDEN_KEYS]).toEqual([
      'address',
      'openingHours',
      'openingHoursSpecification',
      'priceRange',
      'aggregateRating',
      'reviewCount',
      'review',
      'foundingDate',
      'award',
      'sameAs',
    ]);
  });

  it('allows exactly three nested value types, each under one named property', () => {
    expect(PERMITTED_NESTED_TYPES).toEqual({
      areaServed: 'City',
      contactPoint: 'ContactPoint',
      itemListElement: 'ListItem',
    });
  });
});

describe('auditGraph: permitted types (Requirement 5.6)', () => {
  it('passes a graph of permitted nodes whose every value a reader can see', () => {
    expect(auditGraph(graphOf(ORGANISATION), VISIBLE)).toEqual({ ok: true, failures: [] });
  });

  it('fails a node type outside the list, named by its path', () => {
    const audit = auditGraph(graphOf({ '@type': 'RealEstateAgent', name: 'INSTLE REAL ESTATE' }), VISIBLE);
    expect(audit.ok).toBe(false);
    expect(audit.failures).toEqual(['@graph[0].@type: "RealEstateAgent" is not a permitted type']);
  });

  it('fails a type outside the list at any depth', () => {
    const audit = auditGraph(
      graphOf({ ...ORGANISATION, makesOffer: { '@type': 'Offer', name: 'Bengaluru' } }),
      VISIBLE
    );
    expect(audit.failures).toEqual(['@graph[0].makesOffer.@type: "Offer" is not a permitted type']);
  });

  it('accepts a nested value type only under the property named for it', () => {
    const audit = auditGraph(
      graphOf(
        { '@type': 'ContactPoint', telephone: '9353096264' },
        { ...ORGANISATION, location: { '@type': 'City', name: 'Bengaluru' } }
      ),
      VISIBLE
    );
    expect(audit.failures).toEqual([
      '@graph[0].@type: "ContactPoint" is not a permitted type',
      '@graph[1].location.@type: "City" is not a permitted type',
    ]);
  });

  it('checks every entry of an array @type, and fails a node with none', () => {
    const audit = auditGraph(
      graphOf({ '@type': ['Organization', 'LocalBusiness'], name: 'INSTLE REAL ESTATE' }, { name: 'Bengaluru' }),
      VISIBLE
    );
    expect(audit.failures).toEqual([
      '@graph[0].@type: "LocalBusiness" is not a permitted type',
      '@graph[1]: a node must declare an @type',
    ]);
  });

  it('treats a root without @graph as the node itself', () => {
    expect(auditGraph({ '@type': 'Person', name: 'INSTLE REAL ESTATE' }, VISIBLE).ok).toBe(true);
    expect(auditGraph({ '@type': 'Product', name: 'INSTLE REAL ESTATE' }, VISIBLE).failures).toEqual([
      '@type: "Product" is not a permitted type',
    ]);
  });
});

describe('auditGraph: forbidden keys (Requirement 5.7)', () => {
  it.each([...FORBIDDEN_KEYS])('fails "%s" wherever it appears, named by its path', (key) => {
    const top = auditGraph(graphOf({ ...ORGANISATION, [key]: 'Bengaluru' }), VISIBLE);
    expect(top.failures).toEqual([`@graph[0].${key}: "${key}" is a forbidden key`]);

    const nested = auditGraph(
      graphOf({ ...ORGANISATION, contactPoint: { '@type': 'ContactPoint', [key]: 'Bengaluru' } }),
      VISIBLE
    );
    expect(nested.failures).toEqual([`@graph[0].contactPoint.${key}: "${key}" is a forbidden key`]);
  });
});

describe('auditGraph: values a reader can see (Requirement 5.6)', () => {
  it('fails a value absent from the visible text', () => {
    const audit = auditGraph(graphOf({ ...ORGANISATION, description: 'A sentence nobody reads.' }), VISIBLE);
    expect(audit.failures).toEqual([
      '@graph[0].description: "A sentence nobody reads." does not appear in the visible text of the page',
    ]);
  });

  it('matches after whitespace and case normalisation', () => {
    const audit = auditGraph(graphOf({ ...ORGANISATION, name: '  instle   real\nestate ' }), VISIBLE);
    expect(audit.ok).toBe(true);
    expect(normaliseVisibleText('  INSTLE\t REAL\n\nESTATE ')).toBe('instle real estate');
  });

  it('exempts schema vocabulary under a structural key, and nothing else', () => {
    // `customer service` and `en` appear nowhere in VISIBLE, and pass.
    expect(auditGraph(graphOf(ORGANISATION), VISIBLE).ok).toBe(true);

    // A content key inside the same ContactPoint is not exempt.
    const audit = auditGraph(
      graphOf({ ...ORGANISATION, contactPoint: { '@type': 'ContactPoint', name: 'Sales desk' } }),
      VISIBLE
    );
    expect(audit.failures).toEqual([
      '@graph[0].contactPoint.name: "Sales desk" does not appear in the visible text of the page',
    ]);
  });

  it('checks a number like any other value, unless its key is structural', () => {
    const audit = auditGraph(graphOf({ ...ORGANISATION, numberOfEmployees: 12 }), VISIBLE);
    expect(audit.failures).toEqual([
      '@graph[0].numberOfEmployees: "12" does not appear in the visible text of the page',
    ]);
    const positioned = auditGraph(
      graphOf({
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Bengaluru' }],
      }),
      VISIBLE
    );
    expect(positioned.ok).toBe(true);
  });
});

describe('auditGraph: every failure, not the first', () => {
  it('returns each fault in the graph by path, in document order', () => {
    const audit = auditGraph(
      graphOf(
        { ...ORGANISATION, description: 'Invisible.', sameAs: 'Bengaluru' },
        { '@type': 'Review', name: 'Bengaluru', aggregateRating: 'Bengaluru' }
      ),
      VISIBLE,
      { domainConfirmed: true }
    );
    expect(pathsOf(audit.failures)).toEqual([
      '@graph[0].description',
      '@graph[0].sameAs',
      '@graph[1].@type',
      '@graph[1].aggregateRating',
    ]);
  });
});

describe('auditGraph: no hostname while the domain is unconfirmed (Requirements 5.8, 5.13)', () => {
  const withUrls = graphOf({
    ...ORGANISATION,
    '@id': 'https://example-instle.test/#organisation',
    url: 'https://example-instle.test',
    description: 'Write to mail@example.co.in, see www.example.com or //cdn.example.net/logo',
  });
  const text = `${VISIBLE} Write to mail@example.co.in, see www.example.com or //cdn.example.net/logo`;

  it('fails every value that carries a hostname, structural or not', () => {
    const audit = auditGraph(withUrls, text, { domainConfirmed: false });
    expect(audit.failures).toEqual([
      '@graph[0].@id: "https://example-instle.test/#organisation" carries the hostname "example-instle.test" while the domain is unconfirmed',
      '@graph[0].url: "https://example-instle.test" carries the hostname "example-instle.test" while the domain is unconfirmed',
      '@graph[0].description: "Write to mail@example.co.in, see www.example.com or //cdn.example.net/logo" carries the hostname "example.co.in" while the domain is unconfirmed',
    ]);
  });

  it('recognises each shape of hostname, and not the abbreviations a property page uses', () => {
    expect(findHostname('https://example.com/buy')).toBe('example.com');
    expect(findHostname('//cdn.example.net/logo')).toBe('cdn.example.net');
    expect(findHostname('see www.example')).toBe('www.example');
    expect(findHostname('mail@example.co.in')).toBe('example.co.in');
    expect(findHostname('Flats above 1,200 sq.ft, e.g. in Bengaluru, i.e. near a metro.')).toBeNull();
    expect(findHostname('tel:9353096264')).toBeNull();
    expect(findHostname('Owner and CEO, INSTLE REAL ESTATE')).toBeNull();
  });

  it('exempts only the exact schema.org vocabulary IRI, and only as @context', () => {
    expect(auditGraph(graphOf(ORGANISATION), VISIBLE, { domainConfirmed: false }).ok).toBe(true);

    const otherContext = auditGraph(
      { '@context': 'https://example.com/vocab', '@graph': [ORGANISATION] },
      VISIBLE,
      { domainConfirmed: false }
    );
    expect(hostnameFailures(otherContext.failures)).toEqual([
      '@context: "https://example.com/vocab" carries the hostname "example.com" while the domain is unconfirmed',
    ]);

    const contextAsUrl = auditGraph(graphOf({ ...ORGANISATION, url: SCHEMA_ORG_CONTEXT }), VISIBLE, {
      domainConfirmed: false,
    });
    expect(pathsOf(hostnameFailures(contextAsUrl.failures))).toEqual(['@graph[0].url']);
  });

  it('allows the confirmed domain once it is confirmed', () => {
    expect(auditGraph(withUrls, text, { domainConfirmed: true })).toEqual({ ok: true, failures: [] });
  });

  it('reads the domain state from the site configuration by default', () => {
    expect(hostnameFailures(auditGraph(withUrls, text).failures)).toHaveLength(3);
    confirmDomain();
    expect(hostnameFailures(auditGraph(withUrls, text).failures)).toEqual([]);
  });
});

describe('auditGraph on the site graph the homepage emits today', () => {
  const markup = renderToStaticMarkup(<HomePage />);
  const homeText = visibleTextOf(markup);

  it('checks against the text a reader sees, not the JSON-LD in the page', () => {
    // `customer service` is in the page's JSON-LD and nowhere a reader can see it.
    expect(markup).toContain('application/ld+json');
    expect(markup).toContain('"contactType":"customer service"');
    expect(normaliseVisibleText(homeText)).not.toContain('customer service');
    expect(normaliseVisibleText(homeText)).toContain('instle real estate');
  });

  /**
   * Task 13.2 fixed the defect this test used to pin: `buildOrganisationNode`
   * emitted a `description` sentence that appeared in no visible text on the
   * homepage. With it removed, every value in the homepage graph is one a reader
   * of the homepage can see.
   */
  it('passes: every value in the homepage graph is one a reader can see', () => {
    expect(buildOrganisationNode()).not.toHaveProperty('description');
    expect(auditGraph(buildSiteGraph(), homeText)).toEqual({ ok: true, failures: [] });
  });

  it('carries no hostname in any value while the domain is unconfirmed', () => {
    const graph = buildSiteGraph();
    expect(hostnameFailures(auditGraph(graph, homeText).failures)).toEqual([]);
    const values = JSON.stringify(graph['@graph']);
    expect(findHostname(values)).toBeNull();
  });

  it('would report every identifier the builder adds, were it emitted unconfirmed', () => {
    confirmDomain();
    const graph = buildSiteGraph();
    expect(hostnameFailures(auditGraph(graph, homeText).failures)).toEqual([]);
    expect(pathsOf(hostnameFailures(auditGraph(graph, homeText, { domainConfirmed: false }).failures))).toEqual([
      '@graph[0].@id',
      '@graph[0].url',
      '@graph[1].worksFor.@id',
      '@graph[1].@id',
      '@graph[1].url',
    ]);
  });
});
