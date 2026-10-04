import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  LOCALITY_REGISTRY,
  LOCALITY_SLUG_ALIASES,
  getAllLocalitySlugs,
  getPublishedLocalitySlugs,
  resolveLocalitySlug,
} from '@/config/localities';
import { HEADER_NAV_ITEMS, NAV_GROUPS, PRIMARY_NAV_ITEMS } from '@/config/constants';
import { getPublicRoutes } from '@/lib/public-routes';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';

import { PROPERTY_RUN_CONFIG, arbSlug } from './arbitraries';

/**
 * Property 5: Slug resolution is idempotent and canonical-fixed.
 *
 * **Validates: Requirements 1.11**
 *
 * One place, one page. `resolveLocalitySlug` is what enforces that, and it has to
 * do so before the publication gate is consulted — otherwise an alias could reach
 * a different verdict from its canonical slug.
 *
 * Two halves. The arithmetic half: resolving any string lands on something that is
 * not itself an alias key, and resolving again changes nothing. The surface half:
 * no alias key appears in navigation, in `generateStaticParams` or in the sitemap,
 * so an alias is a way in rather than a second address.
 *
 * The generator includes the alias keys and the registry's canonical slugs
 * explicitly — a purely random slug pool would essentially never produce either,
 * and those are the only inputs where the function does anything at all.
 */

const ALIAS_KEYS = Object.keys(LOCALITY_SLUG_ALIASES);
const CANONICAL_SLUGS = getAllLocalitySlugs();

/**
 * Any string a router could hand this function: slug-shaped values, the alias
 * keys, the canonical slugs, and the hostile keys that exist on every object
 * literal's prototype. `__proto__` and `constructor` are in the pool because a
 * plain-object lookup answers for them even though the alias map does not declare
 * them, and a path segment is attacker-controlled text.
 */
const arbAnySlugInput: fc.Arbitrary<string> = fc.oneof(
  { arbitrary: fc.constantFrom(...ALIAS_KEYS), weight: 3 },
  { arbitrary: fc.constantFrom(...CANONICAL_SLUGS), weight: 3 },
  { arbitrary: arbSlug, weight: 3 },
  {
    arbitrary: fc.constantFrom(
      '__proto__',
      'constructor',
      'prototype',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '',
      ' ',
      'Indiranagar'
    ),
    weight: 2,
  }
);

describe('Property 5: slug resolution is idempotent and canonical-fixed', () => {
  it('never resolves to a value that is itself an alias key', () => {
    fc.assert(
      fc.property(arbAnySlugInput, (input) => {
        const resolved = resolveLocalitySlug(input);
        expect(typeof resolved, `resolving ${JSON.stringify(input)} returned a non-string`).toBe(
          'string'
        );
        expect(ALIAS_KEYS, `${input} resolved to another alias key`).not.toContain(resolved);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(arbAnySlugInput, (input) => {
        const once = resolveLocalitySlug(input);
        expect(resolveLocalitySlug(once)).toBe(once);
        // And stable under repetition, not merely on the second application.
        expect(resolveLocalitySlug(resolveLocalitySlug(once))).toBe(once);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('leaves every canonical slug unchanged', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CANONICAL_SLUGS), (slug) => {
        expect(resolveLocalitySlug(slug)).toBe(slug);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('leaves a slug the registry does not know unchanged', () => {
    const known = new Set([...CANONICAL_SLUGS, ...ALIAS_KEYS]);
    fc.assert(
      fc.property(
        arbSlug.filter((slug) => !known.has(slug)),
        (slug) => {
          // Resolution is not a membership test. An unknown slug passes through and
          // the gate returns 404 — inventing a redirect target would be worse.
          expect(resolveLocalitySlug(slug)).toBe(slug);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('resolves every alias key onto a canonical slug the registry holds', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALIAS_KEYS), (alias) => {
        const resolved = resolveLocalitySlug(alias);
        expect(resolved).not.toBe(alias);
        expect(CANONICAL_SLUGS).toContain(resolved);
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

describe('Property 5: no alias key reaches a public surface', () => {
  it('appears in no navigation link', () => {
    const hrefs = [
      ...HEADER_NAV_ITEMS.map((item) => item.href),
      ...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
      ...PRIMARY_NAV_ITEMS.map((item) => item.href),
    ];
    expect(hrefs.length).toBeGreaterThan(10);
    fc.assert(
      fc.property(fc.constantFrom(...ALIAS_KEYS), (alias) => {
        expect(hrefs).not.toContain(`/areas/${alias}`);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('appears in no static param and in no public route', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALIAS_KEYS),
        fc.date({
          min: new Date('2026-01-01T00:00:00.000Z'),
          max: new Date('2030-12-31T00:00:00.000Z'),
          noInvalidDate: true,
        }),
        (alias, now) => {
          // Whatever the gate admits at any date, an alias is never one of them.
          expect(getPublishedLocalitySlugs(now)).not.toContain(alias);
          expect(getPublicRoutes(now).map((route) => route.path)).not.toContain(`/areas/${alias}`);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('appears in no served sitemap', async () => {
    process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
    process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
    process.env.INSTLE_DEPLOY_ENV = 'production';

    const response = await sitemapRoute();
    expect(response.status).toBe(200);
    const body = await response.text();

    for (const alias of ALIAS_KEYS) {
      expect(body, `alias "${alias}" reached the sitemap`).not.toContain(`/areas/${alias}`);
    }
    // Nor does any registry slug, because none passes the gate yet.
    for (const record of LOCALITY_REGISTRY) {
      expect(body).not.toContain(`/areas/${record.slug}<`);
    }
  });
});
