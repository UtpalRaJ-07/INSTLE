import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  getDeployEnvironment,
  getPublicOrigin,
  getSiteOriginState,
  isDomainConfirmed,
  isRealIntakeEnabled,
  isSearchIndexingAllowed,
  parsePublicOrigin,
} from '@/config/site';
import { buildPageMetadata, buildPrototypeMetadata } from '@/lib/metadata';
import { buildBreadcrumbNode, buildOrganisationNode, buildOwnerNode } from '@/lib/structured-data';

/**
 * The domain gate is the difference between a safe preview and an accidentally
 * indexed site with a guessed canonical URL. Both modes are tested here: unset
 * now, and confirmed via synthetic configuration.
 */

function confirmDomain(origin = 'https://example-instle.test') {
  process.env.INSTLE_PUBLIC_ORIGIN = origin;
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
  process.env.INSTLE_DEPLOY_ENV = 'production';
}

describe('parsePublicOrigin', () => {
  it('accepts a bare https origin', () => {
    expect(parsePublicOrigin('https://example.com').origin).toBe('https://example.com');
  });

  it('rejects http', () => {
    const result = parsePublicOrigin('http://example.com');
    expect(result.origin).toBeNull();
    expect(result.reason).toMatch(/https/);
  });

  it('rejects an origin carrying a path, query or fragment', () => {
    expect(parsePublicOrigin('https://example.com/site').origin).toBeNull();
    expect(parsePublicOrigin('https://example.com/?a=1').origin).toBeNull();
  });

  it('rejects embedded credentials', () => {
    expect(parsePublicOrigin('https://user:pass@example.com').origin).toBeNull();
  });

  it('rejects a non-URL', () => {
    expect(parsePublicOrigin('example.com').origin).toBeNull();
  });
});

describe('domain-unset mode', () => {
  it('reports the domain as unconfirmed by default', () => {
    expect(isDomainConfirmed()).toBe(false);
    expect(getPublicOrigin()).toBeNull();
    expect(getSiteOriginState().status).toBe('TO BE CONFIRMED');
  });

  // A production host string alone must not become a canonical domain.
  it('does not treat a supplied origin as canonical without explicit confirmation', () => {
    process.env.INSTLE_PUBLIC_ORIGIN = 'https://example.com';
    expect(isDomainConfirmed()).toBe(false);
    expect(getPublicOrigin()).toBeNull();
    expect(getSiteOriginState().rejectionReason).toMatch(/INSTLE_DOMAIN_CONFIRMED is not set/);
  });

  it('does not confirm when the flag is set but no usable origin is supplied', () => {
    process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
    expect(isDomainConfirmed()).toBe(false);
    expect(getSiteOriginState().rejectionReason).toMatch(/missing or unusable/);
  });

  it('never produces an absolute URL', () => {
    expect(absoluteUrl('/buy')).toBeNull();
    expect(absoluteUrl('/')).toBeNull();
  });

  it('emits no canonical and no absolute Open Graph URL in page metadata', () => {
    const metadata = buildPageMetadata({
      title: 'Buy property in Bengaluru',
      description: 'Description.',
      path: '/buy',
    });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph?.url).toBeUndefined();
  });

  it('marks every page noindex while the domain is unconfirmed', () => {
    const metadata = buildPageMetadata({ title: 'T', description: 'D', path: '/buy' });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('omits domain-dependent identifiers from structured data', () => {
    const organisation = buildOrganisationNode();
    expect(organisation.url).toBeUndefined();
    expect(organisation['@id']).toBeUndefined();
    expect(buildOwnerNode().url).toBeUndefined();
  });

  it('emits no breadcrumb graph, because item URLs cannot be built', () => {
    expect(
      buildBreadcrumbNode([
        { name: 'Home', path: '/' },
        { name: 'Buy', path: '/buy' },
      ])
    ).toBeNull();
  });

  it('forbids search indexing', () => {
    expect(isSearchIndexingAllowed()).toBe(false);
  });
});

describe('domain-confirmed mode', () => {
  it('reports the confirmed origin', () => {
    confirmDomain();
    expect(isDomainConfirmed()).toBe(true);
    expect(getPublicOrigin()).toBe('https://example-instle.test');
  });

  it('adds a self-referencing canonical and an absolute Open Graph URL', () => {
    confirmDomain();
    const metadata = buildPageMetadata({ title: 'T', description: 'D', path: '/buy' });
    expect(metadata.alternates?.canonical).toBe('https://example-instle.test/buy');
    expect(metadata.openGraph?.url).toBe('https://example-instle.test/buy');
  });

  it('allows indexing only in a production deployment', () => {
    confirmDomain();
    expect(isSearchIndexingAllowed()).toBe(true);

    process.env.INSTLE_DEPLOY_ENV = 'preview';
    expect(isSearchIndexingAllowed()).toBe(false);
  });

  it('still honours a per-page noindex override', () => {
    confirmDomain();
    const metadata = buildPageMetadata({
      title: 'T',
      description: 'D',
      path: '/areas/unknown',
      noindex: true,
    });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('includes domain-dependent identifiers in structured data', () => {
    confirmDomain();
    expect(buildOrganisationNode().url).toBe('https://example-instle.test');
    const breadcrumb = buildBreadcrumbNode([
      { name: 'Home', path: '/' },
      { name: 'Buy', path: '/buy' },
    ]);
    expect(breadcrumb).not.toBeNull();
  });
});

describe('deploy environment defaults', () => {
  it('treats an unlabelled build as development outside production', () => {
    expect(getDeployEnvironment()).toBe('development');
  });

  it('accepts only the three known environment labels', () => {
    process.env.INSTLE_DEPLOY_ENV = 'staging';
    expect(getDeployEnvironment()).toBe('development');
    process.env.INSTLE_DEPLOY_ENV = 'preview';
    expect(getDeployEnvironment()).toBe('preview');
  });
});

describe('intake mode', () => {
  it('is disabled unless explicitly enabled, so the site defaults to call-only', () => {
    expect(isRealIntakeEnabled()).toBe(false);
  });

  it('is enabled by an explicit truthy flag', () => {
    process.env.INSTLE_ENQUIRY_INTAKE_ENABLED = 'true';
    expect(isRealIntakeEnabled()).toBe(true);
  });
});

describe('prototype metadata', () => {
  it('is always noindex and never canonical', () => {
    confirmDomain();
    const metadata = buildPrototypeMetadata('Concept 1', 'Internal design review.');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });
});
