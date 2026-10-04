import React from 'react';
import type { Metadata } from 'next';
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
  Card,
  CardGrid,
  ContactBand,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';
import { CivicStreetscapeBand } from '@/components/Bengaluru';

export const metadata: Metadata = buildPageMetadata({
  title: 'Buy property in Bengaluru',
  description: `Looking for a flat, independent house, villa or site in Bengaluru? Tell ${CANONICAL_BRAND} your areas and budget, or call ${PRIMARY_PHONE} to talk it through.`,
  path: '/buy',
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
  title: 'Buy property in Bengaluru',
  lead: 'Tell us the areas you are considering, what kind of property, and roughly what you can spend. We work on it from there.',
  path: '/buy',
};

export default function BuyPage() {
  const assetTypes = getOfferedAssetTypes('buy');

  return (
    <>
      <JsonLd data={buildServiceGraph(INTRO)} />

      <PageIntro eyebrow="Buying" titleId="buy-heading" title={INTRO.title} lead={INTRO.lead}>
        <ActionRow>
          <CallButton />
          <SecondaryLink href="#enquiry">Send your requirement</SecondaryLink>
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

      <Section labelledBy="buy-what-heading">
        <SectionHeader
          titleId="buy-what-heading"
          eyebrow="What you get"
          title="What a broker is actually for"
          lead="Not access to a catalogue. Anyone can see the listings. What is harder is working out which of them are worth your Saturday."
        />
        <CardGrid columns={3}>
          <Card title="Narrowing it down" titleId="buy-help-1">
            Most people start with more areas than they can realistically look at, and a budget that
            works in some of them and not others. The first conversation is usually about closing that
            gap.
          </Card>
          <Card title="Arranging the visits" titleId="buy-help-2">
            Getting to the right person, at a time that works, without four rounds of phone tag. This
            is unglamorous and it is most of the job.
          </Card>
          <Card title="Saying when something is off" titleId="buy-help-3">
            If the access road is a problem, or the price does not reflect what is around it, you
            should hear that from us rather than work it out afterwards.
          </Card>
        </CardGrid>
      </Section>

      <Section tone="raised" labelledBy="buy-types-heading">
        <SectionHeader
          titleId="buy-types-heading"
          eyebrow="Property types"
          title="What we help with"
        />
        <Prose>
          <BulletList items={assetTypes.map((asset) => asset.label)} />
          <p>
            Sites are a different exercise from homes. If you are looking at a site, the useful
            starting point is the dimensions or the area in square feet, and what you intend to
            build. Say so on the call and we will take it from there.
          </p>
          <p>
            Looking for an office, shop or warehouse instead? That is on our{' '}
            <a href="/commercial">commercial page</a>, where we are also straight about what we have
            not confirmed yet.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="buy-limits-heading">
        <SectionHeader titleId="buy-limits-heading" eyebrow="Worth being clear about" title="What this is not" />
        <Callout>
          <CalloutText>
            Sending a requirement starts a conversation. It does not reserve anything, and it does not
            mean we currently have a property that matches what you have described.
          </CalloutText>
          <CalloutText>
            We are a brokerage. We do not arrange home loans, assess your borrowing capacity, give
            financial or tax advice, or certify that a property&rsquo;s paperwork is in order. Those
            are separate jobs for separate people, and you should use them.
          </CalloutText>
        </Callout>
      </Section>

      <EnquirySection intent="buy" />

      <RelatedLinks groups={serviceLinkGroups('buy')} idPrefix="buy" tone="paper" />

      <ContactBand
        title="Rather just talk?"
        text={`Call ${PRIMARY_PHONE} and tell us what you are looking for. No form needed.`}
      />
    </>
  );
}
