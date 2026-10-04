import { describe, expect, it } from 'vitest';
import {
  buildOrganisationNode,
  buildOwnerNode,
  buildServiceGraph,
  buildServiceNode,
  buildSiteGraph,
  serialiseJsonLd,
  type JsonLdObject,
  type ServiceIntro,
} from '@/lib/structured-data';
import { FORBIDDEN_KEYS } from '@/lib/structured-data-policy';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { AGGREGATE_RATING_MARKUP_PERMITTED } from '@/config/reviews';
import { OWNER_PROFILE } from '@/config/owner';

describe('serialiseJsonLd', () => {
  it('escapes characters that could break out of a script element', () => {
    const output = serialiseJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(output).not.toContain('</script>');
    expect(output).toContain('\\u003c');
  });

  it('escapes the Unicode line separators', () => {
    const output = serialiseJsonLd({ name: 'a\u2028b\u2029c' });
    expect(output).toContain('\\u2028');
    expect(output).toContain('\\u2029');
    expect(output).not.toContain('\u2028');
  });

  it('produces valid JSON', () => {
    const output = serialiseJsonLd(buildSiteGraph());
    expect(() => JSON.parse(output.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'))).not.toThrow();
  });
});

describe('organisation node', () => {
  const node = buildOrganisationNode();

  it('uses the canonical brand exactly', () => {
    expect(node.name).toBe(CANONICAL_BRAND);
  });

  it('uses the canonical phone digits', () => {
    expect(node.telephone).toBe(PRIMARY_PHONE);
  });

  it('invents no address, coordinates, hours, price range or rating', () => {
    const serialised = JSON.stringify(node);
    for (const forbidden of [
      'address',
      'geo',
      'openingHours',
      'openingHoursSpecification',
      'priceRange',
      'aggregateRating',
      'reviewCount',
      'review',
      'award',
      'foundingDate',
      'numberOfEmployees',
      'sameAs',
      'location',
      'branchOf',
    ]) {
      expect(serialised, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('is not typed as a LocalBusiness or RealEstateAgent, since no address is approved', () => {
    expect(node['@type']).toBe('Organization');
  });

  it('carries no description, because no page shows one (Requirement 5.6)', () => {
    expect(node).not.toHaveProperty('description');
  });

  it('keeps its contact point, with the vocabulary values the policy exempts', () => {
    expect(node.contactPoint).toEqual({
      '@type': 'ContactPoint',
      telephone: PRIMARY_PHONE,
      contactType: 'customer service',
      availableLanguage: ['en'],
    });
  });
});

describe('service node', () => {
  const intro: ServiceIntro = {
    title: 'Buy property in Bengaluru',
    lead: 'Tell us the areas you are considering.',
    path: '/buy',
  };

  it('takes its name and description verbatim from the page intro', () => {
    const node = buildServiceNode(intro);
    expect(node['@type']).toBe('Service');
    expect(node.name).toBe(intro.title);
    expect(node.description).toBe(intro.lead);
  });

  it('is provided by the organisation, and has no identifier while the domain is unconfirmed', () => {
    const node = buildServiceNode(intro);
    expect(node.provider).toEqual(buildOrganisationNode());
    expect(node).not.toHaveProperty('@id');
    expect(node).not.toHaveProperty('url');
  });

  it('gains its page URL and a fragment identifier once the domain is confirmed', () => {
    process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
    process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
    const node = buildServiceNode(intro);
    expect(node.url).toBe('https://example-instle.test/buy');
    expect(node['@id']).toBe('https://example-instle.test/buy#service');
    expect((node.provider as JsonLdObject)['@id']).toBe('https://example-instle.test');
  });

  it('is the only node in a service graph: no owner, and no forbidden fact', () => {
    const graph = buildServiceGraph(intro);
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph']).toEqual([buildServiceNode(intro)]);
    const serialised = JSON.stringify(graph);
    for (const key of FORBIDDEN_KEYS) expect(serialised, key).not.toContain(`"${key}"`);
    expect(serialised).not.toContain(OWNER_PROFILE.name);
  });
});

describe('owner node', () => {
  const node = buildOwnerNode();

  it('uses the supplied name and role only', () => {
    expect(node.name).toBe(OWNER_PROFILE.name);
    expect(node.jobTitle).toBe('Owner and CEO');
  });

  it('does not claim founder status', () => {
    expect(JSON.stringify(node)).not.toContain('founder');
  });

  it('invents no image, sameAs, education or credential', () => {
    const serialised = JSON.stringify(node);
    for (const forbidden of ['image', 'sameAs', 'alumniOf', 'hasCredential', 'award', 'birthDate']) {
      expect(serialised, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('site graph', () => {
  const graph = buildSiteGraph();

  it('contains only the organisation and the owner by default', () => {
    expect(Array.isArray(graph['@graph'])).toBe(true);
    expect((graph['@graph'] as unknown[]).length).toBe(2);
  });

  it('contains no listing, offer or product markup', () => {
    const serialised = JSON.stringify(graph);
    for (const forbidden of [
      'Offer',
      'Product',
      'RealEstateListing',
      'Accommodation',
      'SingleFamilyResidence',
      'Apartment',
      'price',
      'availability',
    ]) {
      expect(serialised, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('contains no FAQPage markup, so launch does not depend on FAQ rich results', () => {
    expect(JSON.stringify(graph)).not.toContain('FAQPage');
  });
});

describe('review markup policy', () => {
  it('forbids self-serving aggregate rating markup', () => {
    expect(AGGREGATE_RATING_MARKUP_PERMITTED).toBe(false);
  });
});
