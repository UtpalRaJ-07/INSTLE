import React, { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PRIMARY_PHONE } from '@/config/constants';
import { getPublishedGuideBySlug, getPublishedGuideSlugs } from '@/config/guides';
import { CUSTOMER_INTENTS } from '@/config/constants';
import { guideLinkGroups } from '@/lib/internal-links';
import { buildPageMetadata } from '@/lib/metadata';
import { buildBreadcrumbNode, buildOrganisationGraph } from '@/lib/structured-data';
import { GuideDirectAnswer } from '@/components/GuideDirectAnswer/GuideDirectAnswer';
import { JsonLd } from '@/components/JsonLd/JsonLd';
import { RelatedLinks } from '@/components/RelatedLinks/RelatedLinks';
import {
  ActionRow,
  Breadcrumbs,
  BulletList,
  CallButton,
  Callout,
  CalloutText,
  ContactBand,
  DetailList,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Rendered per request, never prerendered. Requirement 4.13: once a guide's next
 * review date passes with no later review, or a claim it cites is withdrawn, the
 * slug returns 404 — from the next request, not the next build. A prerendered page
 * would keep serving the stale guide until somebody redeployed. Adds no client
 * JavaScript.
 */
export const dynamic = 'force-dynamic';

/**
 * One date per request, shared by `generateMetadata` and the page, so the title
 * and the body can never disagree about whether the guide is published.
 */
const requestDate = cache((): Date => new Date());

/** The gate's own list. Under `force-dynamic` nothing is prerendered from it. */
export async function generateStaticParams() {
  return getPublishedGuideSlugs(new Date()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getPublishedGuideBySlug(slug, requestDate());

  if (!guide) {
    return buildPageMetadata({
      title: 'Page not found',
      description: 'This page does not exist.',
      path: `/guides/${slug}`,
      noindex: true,
    });
  }

  return buildPageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const now = requestDate();
  const guide = getPublishedGuideBySlug(slug, now);

  if (!guide) {
    // A draft guide is a 404, not a partially rendered page.
    notFound();
  }

  const breadcrumb = buildBreadcrumbNode([
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: guide.title, path: `/guides/${guide.slug}` },
  ]);

  const intentAction = CUSTOMER_INTENTS.find((item) => item.intent === guide.intent);

  return (
    <>
      {/*
        No Article structured data. Article expects an author identity, and these
        guides are attributed to the business rather than to a named individual.
        Claiming a person wrote them would be the fabrication the rules forbid.

        `buildOrganisationGraph`, not `buildSiteGraph`: the site graph carries the
        owner's Person node, whose `jobTitle` — "Owner and CEO" — appears nowhere a
        reader of a guide can see. The footer names the owner; no guide states the
        role. Requirement 5.6 permits a property value only when the same value is
        in the visible text of the page emitting it, so the owner node is left out
        here for the same reason a service page leaves it out.
      */}
      <JsonLd data={buildOrganisationGraph(breadcrumb ? [breadcrumb] : [])} />

      <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
        <Breadcrumbs
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Guides', href: '/guides' },
            { label: guide.title },
          ]}
        />
      </div>

      {/*
        The direct answer is PageIntro's first child, not its `lead`, so it renders
        straight after the <h1> and ahead of the action row and every section
        heading (Requirements 5.3, 5.11). The eyebrow sits above the <h1>.
      */}
      <PageIntro eyebrow="Guide" titleId="guide-heading" title={guide.title}>
        <GuideDirectAnswer text={guide.directAnswer} />
        <ActionRow>
          <CallButton />
          {intentAction ? (
            <SecondaryLink href={intentAction.href}>{intentAction.actionLabel}</SecondaryLink>
          ) : null}
        </ActionRow>
      </PageIntro>

      {guide.sections.map((section) => (
        <Section key={section.heading} labelledBy={`guide-${section.heading.replace(/\W+/g, '-')}`}>
          <SectionHeader
            titleId={`guide-${section.heading.replace(/\W+/g, '-')}`}
            title={section.heading}
          />
          <Prose>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <BulletList items={section.bullets} />
            ) : null}
          </Prose>
        </Section>
      ))}

      <Section tone="raised" labelledBy="guide-next-heading">
        <SectionHeader titleId="guide-next-heading" eyebrow="Next step" title="What to do now" />
        <Prose>
          <p>{guide.nextStep}</p>
        </Prose>
        <Callout title="Scope of this page">
          <CalloutText>{guide.scopeNote}</CalloutText>
        </Callout>
      </Section>

      {/* The intent's service page and the related guides that pass the guide gate
          today, through the same Internal_Link_System groups a locality page uses. */}
      <RelatedLinks groups={guideLinkGroups(guide, now)} idPrefix="guide" tone="paper" />


      <Section labelledBy="guide-provenance-heading">
        <SectionHeader
          titleId="guide-provenance-heading"
          eyebrow="Provenance"
          title="About this page"
        />
        <DetailList
          items={[
            { key: 'Written by', value: guide.attributedTo },
            { key: 'Last updated', value: guide.contentUpdatedAt ?? '—' },
            {
              key: 'Basis',
              value:
                guide.contentClass === 'own-process'
                  ? 'This page describes our own process and what we will not promise. It states no external legal, tax or market facts.'
                  : 'This page states external facts and carries a named author and subject reviewer.',
            },
            ...(guide.namedAuthor ? [{ key: 'Author', value: guide.namedAuthor }] : []),
            ...(guide.subjectReviewer
              ? [{ key: 'Reviewed by', value: guide.subjectReviewer }]
              : []),
          ]}
        />
      </Section>

      <ContactBand
        title="Want to go through this on a call?"
        text={`Call ${PRIMARY_PHONE} and we will answer it for your situation rather than in general.`}
        enquiryHref="/guides"
        enquiryLabel="All guides"
      />
    </>
  );
}
