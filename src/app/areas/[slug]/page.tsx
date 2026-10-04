import React, { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { resolveLocalitySlug, type AdministrativeMapping } from '@/config/localities';
import {
  getPublishedAreaRecordBySlug,
  getPublishedAreaSlugs,
} from '@/config/locality-sections';
import { getClaim } from '@/config/claims';
import { localityLinkGroups } from '@/lib/internal-links';
import { buildPageMetadata } from '@/lib/metadata';
import { buildBreadcrumbNode, buildOrganisationGraph } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd/JsonLd';
import {
  ActionRow,
  Breadcrumbs,
  BulletList,
  CallButton,
  ContactBand,
  DetailList,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';
import { AreaOrientationPlate, TypographicPlate } from '@/components/Bengaluru';
import { RelatedLinks } from '@/components/RelatedLinks/RelatedLinks';
import {
  areaOrientationPlateRecord,
  canRenderAreaOrientationPlate,
} from '@/config/media-register';

interface LocalityPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Rendered per request, never prerendered. Requirements 1.3 and 1.12.
 *
 * Visibility is the publication gate evaluated at the date of the request, and the
 * gate's verdict changes with no rebuild: a record's `nextReviewAt` passes, a
 * claim's `recheckBy` passes, an approval is withdrawn. Left to the default, this
 * route would be prerendered — the params below at build time, any other slug on
 * its first visit — and that HTML would keep being served after the gate had
 * started rejecting the record, which is exactly the stale page Property 4 forbids.
 * `force-dynamic` makes the page and `generateMetadata` run on every request, so a
 * withdrawn record 404s from the next request. It adds no client JavaScript.
 */
export const dynamic = 'force-dynamic';

/**
 * One date per request, shared by `generateMetadata` and the page.
 *
 * Both ask the gate, and if each read the clock separately, a record whose review
 * expired between the two reads could get its real title and its summary as the
 * description on a response whose body is a 404 — the leak Requirement 1.4 rules
 * out. React's `cache` scopes the value to one server request.
 */
const requestDate = cache((): Date => new Date());

/**
 * The gate's own list, so it can never name a slug the page would 404 — and never
 * an alias, because the accessor returns canonical record slugs only (1.11). Under
 * `force-dynamic` nothing is prerendered from it. While it returns no slug at all,
 * the `next build` route table still labels this route ● rather than ƒ; that label
 * is cosmetic — the prerender manifest carries no entry for the route and every
 * response is sent `Cache-Control: private, no-cache, no-store`.
 *
 * Every lookup on this route goes through the `getPublishedArea*` accessors, so a
 * `region-hub` record is held to the region hub gate (Requirements 2.7, 2.9) —
 * three published locality links and two unique sections — and not merely to the
 * locality gate.
 */
export async function generateStaticParams() {
  return getPublishedAreaSlugs(new Date()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: LocalityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locality = getPublishedAreaRecordBySlug(slug, requestDate());

  if (!locality) {
    // Unknown, gate-failing, or an alias whose canonical fails. Nothing from the
    // record — not its name, summary or canonical slug — reaches the metadata.
    return buildPageMetadata({
      title: 'Page not found',
      description: 'This page does not exist.',
      path: `/areas/${slug}`,
      noindex: true,
    });
  }

  return buildPageMetadata({
    title: `Property in ${locality.canonicalName}, Bengaluru`,
    description: locality.summary,
    path: `/areas/${locality.slug}`,
  });
}

/**
 * The eyebrow above the `<h1>`. A description of the page, not a label for the
 * place: nothing here asserts anything about the area, so nothing here needs a
 * source. Requirement 1.6 — see the comment at the `PageIntro` below.
 */
const LOCALITY_PAGE_EYEBROW = 'Area guide';

/** A mapping the page may show: one whose boundary set is recorded. */
type VersionedMapping = AdministrativeMapping & { boundaryVersion: string };

/**
 * Requirement 1.7. The value and the boundary set it belongs to, as one string, so
 * they can only ever be rendered into the same element: "East Zone, ward 80 (2023
 * delimitation)", never a bare ward number.
 */
function formatAdministrativeMapping(mapping: VersionedMapping): string {
  return `${mapping.value} (${mapping.boundaryVersion})`;
}

export default async function LocalityPage({ params }: LocalityPageProps) {
  const { slug } = await params;
  // One request date for every gate decision this response makes.
  const now = requestDate();

  // Requirement 1.11. The alias is resolved first and the gate is evaluated on the
  // canonical record — an alias has no gate verdict of its own.
  const canonicalSlug = resolveLocalitySlug(slug);
  const locality = getPublishedAreaRecordBySlug(canonicalSlug, now);
  if (!locality) {
    // Unknown, draft, expired, unapproved, thinner than two 120-word sections, a
    // region hub below its thresholds, or an alias whose canonical page is any of
    // those. All of them are a real 404 — no partial content, no soft 404, no
    // redirect to the homepage, and for an alias no redirect to a 404.
    notFound();
  }

  // A spelling variant of a live page redirects to it rather than becoming a
  // second page.
  if (canonicalSlug !== slug) {
    permanentRedirect(`/areas/${canonicalSlug}`);
  }

  // The gate fails a record carrying any mapping without a boundary set (1.14), so
  // on a published record this keeps every mapping. It is stated anyway, because
  // what it narrows is what the markup below is allowed to print.
  const administrativeMappings = locality.administrativeMappings.filter(
    (mapping): mapping is VersionedMapping => Boolean(mapping.boundaryVersion?.trim())
  );

  // Requirement 8.1: the three link groups — service pages, related guides, nearby
  // localities — built by the Internal_Link_System at the request date. A nearby
  // locality appears only when its own page passes the gate (8.5) and the
  // relationship is carried by a claim that passes the claim gate (8.4): an
  // unexplained adjacency is an unsourced fact, so an unevidenced relationship
  // renders nothing at all, not a link and not a stub. Each group carries at most
  // six links, and an empty one renders no heading and no container (8.9).
  const linkGroups = localityLinkGroups(locality, now);

  // The orientation plate draws its neighbours from the same rule, at the same date,
  // never from the raw record: `renderableNearbyRelationships`, which the nearby
  // links, this decision and the record's Media_Register entry all call. Property 1
  // found the plate naming a recorded neighbour whose own page fails the gate; a
  // neighbour the page may not link is a neighbour it may not draw either.
  const drawsPlate = canRenderAreaOrientationPlate(locality, now);
  const plateRecord = drawsPlate ? areaOrientationPlateRecord(locality, now) : null;

  const breadcrumb = buildBreadcrumbNode([
    { name: 'Home', path: '/' },
    { name: 'Areas', path: '/areas' },
    { name: locality.canonicalName, path: `/areas/${locality.slug}` },
  ]);

  // Sources actually behind the page, listed with their exact references —
  // including the claim behind each administrative mapping the page shows.
  const sources = Array.from(
    new Set(
      locality.sections
        .flatMap((section) => section.claimIds)
        .concat(locality.summaryClaimIds)
        .concat(
          administrativeMappings.flatMap((mapping) => (mapping.claimId ? [mapping.claimId] : []))
        )
    )
  )
    .map((claimId) => getClaim(claimId))
    .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim));

  return (
    <>
      {/*
        `buildOrganisationGraph`, not `buildSiteGraph`: the site graph carries the
        owner's Person node, whose `jobTitle` — "Owner and CEO" — appears nowhere a
        reader of an area page can see. The footer names the owner; no area page
        states the role. Requirement 5.6 permits a property value only when the same
        value is in the visible text of the page emitting it.
      */}
      <JsonLd data={buildOrganisationGraph(breadcrumb ? [breadcrumb] : [])} />

      <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
        <Breadcrumbs
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Areas', href: '/areas' },
            { label: locality.canonicalName },
          ]}
        />
      </div>

      {/*
        Requirement 1.6 permits `marketingGroup` to be rendered "only as a browsing
        label whose surrounding wording identifies the grouping as a browsing aid".
        This eyebrow used to carry the group verbatim, with no such wording anywhere
        on the page — a reader met "North Bengaluru" directly above "Property in
        Yelahanka" and had nothing telling them that it is how we file areas rather
        than a boundary. The hub carries the group beside `BROWSING_AID_NOTE`, so
        that is where the label belongs; here the eyebrow says what the page is.
      */}
      <PageIntro
        eyebrow={LOCALITY_PAGE_EYEBROW}
        titleId="locality-heading"
        title={`Property in ${locality.canonicalName}`}
        lead={locality.summary}
      >
        <ActionRow>
          <CallButton />
          <SecondaryLink href="/buy">Buying here</SecondaryLink>
          <SecondaryLink href="/sell">Selling here</SecondaryLink>
        </ActionRow>
      </PageIntro>

      {/*
        The Bengaluru element for this page, Requirement 9.2.
        With two to four approved nearby relationships, the orientation plate draws
        the area and what it sits beside. With fewer there is nothing to orient
        against, and Requirement 9.15 is explicit about what happens then: the
        typographic treatment renders alone — no placeholder image, no empty frame,
        no substitute graphic.
      */}
      <Section tight>
        {plateRecord ? (
          <AreaOrientationPlate record={plateRecord} />
        ) : (
          <TypographicPlate
            kicker="Bengaluru"
            name={locality.canonicalName}
            note="No orientation map is published for this area yet. One goes up when the areas around it have been researched and reviewed."
          />
        )}
      </Section>

      {/* Every section, in full. The gate admits only records with at least two of
          at least 120 words each (1.5), so a published page always shows two. */}
      {locality.sections.map((section) => (
        <Section key={section.sectionId} labelledBy={`section-${section.sectionId}`}>
          <SectionHeader titleId={`section-${section.sectionId}`} title={section.heading} />
          <Prose>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </Prose>
        </Section>
      ))}

      {/* Requirement 1.7: each value in the same <dd> as the boundary set it comes
          from. The browsing group is deliberately absent here (1.6). */}
      {administrativeMappings.length > 0 ? (
        <Section tone="raised" labelledBy="locality-boundaries-heading">
          <SectionHeader
            titleId="locality-boundaries-heading"
            eyebrow="Boundaries"
            title="Administrative boundaries"
            lead="Each value is shown with the boundary set it was recorded against, because the same place can sit in a different area when boundaries are redrawn."
          />
          <DetailList
            items={administrativeMappings.map((mapping) => ({
              key: mapping.mappingType,
              value: formatAdministrativeMapping(mapping),
            }))}
          />
        </Section>
      ) : null}

      {locality.approvedFaq.length > 0 ? (
        <Section labelledBy="locality-faq-heading">
          <SectionHeader titleId="locality-faq-heading" eyebrow="Questions" title="Questions people ask" />
          <Prose>
            {locality.approvedFaq.map((faq) => (
              <div key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </Prose>
        </Section>
      ) : null}

      {/* Services, related guides and nearby areas, each named by the destination's
          own name, each nearby link with its claim-backed statement in the same
          list item. A group with nothing to link is absent, heading and all. */}
      <RelatedLinks groups={linkGroups} idPrefix="locality" />


      {/* Sources, author, reviewer and review date. Not decoration: the page is
          only publishable because these exist. */}
      <Section labelledBy="locality-sources-heading">
        <SectionHeader
          titleId="locality-sources-heading"
          eyebrow="Provenance"
          title="Where this came from"
        />
        <DetailList
          items={[
            { key: 'Written by', value: locality.author ?? '—' },
            { key: 'Local review', value: locality.localReviewer ?? '—' },
            { key: 'Editorial review', value: locality.seoReviewer ?? '—' },
            { key: 'Sources last checked', value: locality.sourceCheckedAt ?? '—' },
            { key: 'Next review due', value: locality.nextReviewAt ?? '—' },
          ]}
        />
        {sources.length > 0 ? (
          <Prose>
            <h3>Sources</h3>
            <BulletList
              items={sources.flatMap((claim) =>
                claim.sources.map(
                  (source) =>
                    `${claim.claimText} — ${source.publisher}${
                      source.locationInSource ? `, ${source.locationInSource}` : ''
                    }${source.accessDate ? ` (read ${source.accessDate})` : ''}`
                )
              )}
            />
          </Prose>
        ) : null}
      </Section>

      <ContactBand
        title={`Looking in ${locality.canonicalName}?`}
        text={`Call ${PRIMARY_PHONE} and tell us what you need there. ${CANONICAL_BRAND} will tell you honestly whether we can help.`}
        enquiryHref="/areas"
        enquiryLabel="All areas"
      />
    </>
  );
}
