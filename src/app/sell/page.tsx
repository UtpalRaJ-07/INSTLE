import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { getOfferedAssetTypes } from '@/config/service-matrix';
import { serviceLinkGroups } from '@/lib/internal-links';
import { buildPageMetadata } from '@/lib/metadata';
import { buildServiceGraph, type ServiceIntro } from '@/lib/structured-data';
import { EnquirySection } from '@/components/EnquiryForm/EnquirySection';
import { JsonLd } from '@/components/JsonLd/JsonLd';
import { RelatedLinks } from '@/components/RelatedLinks/RelatedLinks';
import {
  ActionRow,
  BulletList,
  CallButton,
  Callout,
  CalloutText,
  ContactBand,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';
import { CivicStreetscapeBand } from '@/components/Bengaluru';

export const metadata: Metadata = buildPageMetadata({
  title: 'Sell your property in Bengaluru',
  description: `Selling a flat, independent house, villa or site in Bengaluru? Tell ${CANONICAL_BRAND} about the property, or call ${PRIMARY_PHONE}. No documents needed to start.`,
  path: '/sell',
});

/**
 * Rendered per request. The page lists the published guides for its intent, so it
 * shows what the gate admits at the date of the request (Requirement 1.3);
 * prerendered, it would keep linking a guide after its review date passed and its
 * own page began returning 404 — the disagreement Property 2 rules out. Adds no
 * client JavaScript.
 */
export const dynamic = 'force-dynamic';

/** The `<h1>` and lead, rendered once and read by the Service node verbatim. */
const INTRO: ServiceIntro = {
  title: 'Sell your property in Bengaluru',
  lead: 'Tell us what the property is, where it is, and when you would like to sell. That is enough for a first conversation.',
  path: '/sell',
};

export default function SellPage() {
  const assetTypes = getOfferedAssetTypes('sell');

  return (
    <>
      <JsonLd data={buildServiceGraph(INTRO)} />

      <PageIntro eyebrow="Selling" titleId="sell-heading" title={INTRO.title} lead={INTRO.lead}>
        <ActionRow>
          <CallButton />
          <SecondaryLink href="#enquiry">Send property details</SecondaryLink>
        </ActionRow>
      </PageIntro>

      {/*
        The Bengaluru element, Requirement 9.2. The cropped variant of the street
        drawing: one house with a monkey-top window, a rain tree and a compound
        gate. Labelled an illustration in the figure's own caption.
      */}
      <Section tight>
        <CivicStreetscapeBand variant="cropped" />
      </Section>

      {/* Landlord traffic used to land here, because both intents pointed at /sell. */}
      <Section tight labelledBy="sell-landlord-heading">
        <Callout title="Renting it out rather than selling?">
          <CalloutText>
            <Link href="/rent-out">The rent out page</Link> asks about furnishing, availability and
            the things that matter for a tenancy. This page is about selling.
          </CalloutText>
        </Callout>
      </Section>

      <Section tone="raised" labelledBy="sell-first-heading">
        <SectionHeader
          titleId="sell-first-heading"
          eyebrow="Starting out"
          title="What we ask, and what we do not"
        />
        <Prose>
          <h3>What we ask at the first conversation</h3>
          <BulletList
            items={[
              'What the property is — flat, independent house, villa or site.',
              'The locality, or a main road nearby. Not the full address.',
              'Whether you own it, co-own it, or represent the owner.',
              'When you would like to sell, even roughly.',
              'A price you have in mind, if you have one.',
              'A number we can reach you on.',
            ]}
          />
          <h3>What we do not ask for</h3>
          <p>
            No title deed, no khata, no tax receipt, no identity proof, no bank statement. There is no
            upload on this website, and you should be wary of any early-stage form that wants those
            things. Paperwork gets handled later, when there is an actual buyer, alongside the
            independent professionals involved.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="sell-price-heading">
        <SectionHeader
          titleId="sell-price-heading"
          eyebrow="Price"
          title="A figure you have in mind is not a valuation"
        />
        <Prose>
          <p>
            Telling us what you are hoping for helps, because it tells us what you are working
            towards. It is not a valuation, and this website does not produce one. There is no
            instant-value calculator here, because a number generated without anyone seeing the
            property is a guess wearing a suit.
          </p>
          <p>
            If we think your expectation is going to be difficult in that area, we will say so. That
            is a less pleasant conversation than agreeing with you, and a more useful one.
          </p>
        </Prose>
      </Section>

      {/* The 30-day request, answered honestly. */}
      <Section tone="raised" labelledBy="sell-timeline-heading">
        <SectionHeader
          titleId="sell-timeline-heading"
          eyebrow="Timelines"
          title="If you need to sell within 30 days"
        />
        <Prose>
          <p>
            You can tell us that, and we record it as your target. It changes how we work: we will be
            direct about whether the price fits the timeline, and we will focus on people who are
            actually in a position to move.
          </p>
          <p>
            What we will not do is promise the property will sell within 30 days. A sale needs a buyer
            who wants your specific property at a price you will accept, with funds, through
            registration. We do not control any of those. Anyone guaranteeing you a date is either
            guessing or planning to drop your price until it works.
          </p>
          <p>
            We also have not published a response-time commitment, because we have not staffed one
            yet. When we do, it will say who is responsible for it.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="sell-types-heading">
        <SectionHeader titleId="sell-types-heading" eyebrow="Property types" title="What we handle" />
        <Prose>
          <BulletList items={assetTypes.map((asset) => asset.label)} />
          <p>
            Selling commercial property is on the <Link href="/commercial">commercial page</Link>,
            including what we have not confirmed about it yet.
          </p>
        </Prose>
      </Section>

      <EnquirySection intent="sell" />

      <RelatedLinks groups={serviceLinkGroups('sell')} idPrefix="sell" tone="paper" />

      <ContactBand
        title="Rather just talk?"
        text={`Call ${PRIMARY_PHONE} and tell us about the property. Nothing to fill in.`}
      />
    </>
  );
}
