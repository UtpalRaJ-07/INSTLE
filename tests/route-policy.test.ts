import { describe, expect, it } from 'vitest';
import { STATIC_PUBLIC_ROUTES, getPublicRoutes } from '@/lib/public-routes';
import { getAllLocalitySlugs } from '@/config/localities';
import { GUIDE_REGISTRY, getPublishedGuideSlugs } from '@/config/guides';
import { HEADER_NAV_ITEMS, NAV_GROUPS, isPrototypeRoute } from '@/config/constants';
import robots from '@/app/robots';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';

const NOW = new Date('2026-09-29T00:00:00.000Z');

function confirmDomain() {
  process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
  process.env.INSTLE_DEPLOY_ENV = 'production';
}

describe('public route registry', () => {
  it('contains no draft locality route', () => {
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    for (const slug of getAllLocalitySlugs()) {
      expect(paths).not.toContain(`/areas/${slug}`);
    }
  });

  it('contains no unpublished guide route', () => {
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    const publishedSlugs = new Set(getPublishedGuideSlugs(NOW));
    for (const guide of GUIDE_REGISTRY) {
      if (!publishedSlugs.has(guide.slug)) {
        expect(paths).not.toContain(`/guides/${guide.slug}`);
      }
    }
  });

  it('contains every published guide route', () => {
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    for (const slug of getPublishedGuideSlugs(NOW)) {
      expect(paths).toContain(`/guides/${slug}`);
    }
  });

  it('contains no prototype route', () => {
    for (const route of getPublicRoutes(NOW)) {
      expect(isPrototypeRoute(route.path)).toBe(false);
    }
  });

  /**
   * No privacy or terms page is registered, because no approved wording has been
   * supplied. This test exists so that adding such a route forces a deliberate
   * decision rather than slipping in with invented legal text.
   */
  it('registers no legal-wording route while none is approved', () => {
    const paths = STATIC_PUBLIC_ROUTES.map((route) => route.path);
    expect(paths).not.toContain('/privacy');
    expect(paths).not.toContain('/terms');
    expect(paths).not.toContain('/cookie-preferences');
  });

  it('registers no PIN-code route while no postal mapping is source-backed', () => {
    const paths = STATIC_PUBLIC_ROUTES.map((route) => route.path);
    expect(paths.some((path) => path.includes('pin'))).toBe(false);
  });

  it('uses a content date for lastModified rather than the current time', () => {
    for (const route of getPublicRoutes(NOW)) {
      expect(route.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('navigation', () => {
  const navHrefs = [
    ...HEADER_NAV_ITEMS.map((item) => item.href),
    ...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
  ];

  it('links only to registered public routes', () => {
    const publicPaths = new Set(getPublicRoutes(NOW).map((route) => route.path));
    for (const href of navHrefs) {
      expect(publicPaths.has(href), `${href} must be a registered public route`).toBe(true);
    }
  });

  it('never links to a prototype route', () => {
    for (const href of navHrefs) {
      expect(isPrototypeRoute(href)).toBe(false);
    }
  });

  it('keeps the drawer short enough to scan', () => {
    const total = NAV_GROUPS.reduce((sum, group) => sum + group.items.length, 0);
    expect(total).toBeLessThanOrEqual(14);
  });
});

describe('robots.txt', () => {
  it('disallows everything while indexing is not permitted', () => {
    const result = robots();
    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(result.sitemap).toBeUndefined();
  });

  it('advertises no sitemap URL while the domain is unconfirmed', () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    expect(robots().sitemap).toBeUndefined();
  });

  it('allows crawling and advertises the sitemap once the domain is confirmed', () => {
    confirmDomain();
    const result = robots();
    expect(result.sitemap).toBe('https://example-instle.test/sitemap.xml');
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule?.allow).toBe('/');
    expect(rule?.disallow).toEqual(['/api/']);
  });

  /**
   * Prototype routes must stay crawlable so their noindex is observable. Blocking
   * them in robots.txt would hide that instruction while leaving them indexable
   * from external links.
   */
  it('does not block prototype routes in robots.txt', () => {
    confirmDomain();
    const serialised = JSON.stringify(robots());
    expect(serialised).not.toContain('concept-1');
    expect(serialised).not.toContain('concept-2');
    expect(serialised).not.toContain('concept-review');
  });
});

describe('sitemap.xml', () => {
  it('returns 404 while the domain is unconfirmed, so no sitemap is served', async () => {
    const response = await sitemapRoute();
    expect(response.status).toBe(404);
  });

  it('returns 404 in a preview deployment even with a confirmed domain', async () => {
    confirmDomain();
    process.env.INSTLE_DEPLOY_ENV = 'preview';
    const response = await sitemapRoute();
    expect(response.status).toBe(404);
  });

  it('serves only eligible absolute canonical URLs once confirmed', async () => {
    confirmDomain();
    const response = await sitemapRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');

    const body = await response.text();
    // The home page canonical is the bare origin, without a trailing slash.
    expect(body).toContain('<loc>https://example-instle.test</loc>');
    expect(body).toContain('<loc>https://example-instle.test/buy</loc>');
    expect(body).toContain('<loc>https://example-instle.test/about/utpal-raj-kb</loc>');

    // No draft locality, and no prototype.
    for (const slug of getAllLocalitySlugs()) {
      expect(body).not.toContain(`/areas/${slug}<`);
    }
    expect(body).not.toContain('concept-1');
    expect(body).not.toContain('concept-review');
  });
});

describe('prototype route detection', () => {
  it('matches the prototype prefixes and their children', () => {
    expect(isPrototypeRoute('/concept-1')).toBe(true);
    expect(isPrototypeRoute('/concept-1/intake')).toBe(true);
    expect(isPrototypeRoute('/concept-review')).toBe(true);
  });

  it('does not match a public route with a similar name', () => {
    expect(isPrototypeRoute('/concept-1-guide')).toBe(false);
    expect(isPrototypeRoute('/buy')).toBe(false);
  });
});
