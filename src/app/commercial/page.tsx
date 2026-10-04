import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { ASSET_TYPES, getCoverage } from '@/config/service-matrix';
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
  title: 'Commercial property enquiries in Bengaluru',
  description: `Office, shop, warehouse or industrial property in Bengaluru? Tell ${CANONICAL_BRAND} what you need and we will say whether we can help. Call ${PRIMARY_PHONE}.`,
  path: '/commercial',
});

/**
 * Rendered per request. The page lists the published guides for its intent, so it
 * shows what the gate admits at the date of the request (Requirement 1.3);
 * prerendered, it would keep linking a guide after its review date passed and its
 * own page began returning 404 — the disagreement Property 2 rules out. Adds no
 * client JavaScript.
 */
export const dynamic = 'force-dynamic';

/**
 * The `<h1>` and lead, rendered once and read by the Service node verbatim. The
 * Service node therefore names an enquiry route, which is what this page is, and
 * claims no commercial capability the page does not.
 */
const INTRO: ServiceIntro = {
  title: 'Commercial property enquiries',
  lead: 'Tell us what you need and we will tell you straight away whether it is something we can take on.',
  path: '/commercial',
};

/**
 * Commercial hub.
 *
 * This page exists because customers ask, and because the owner asked for the
 * breadth. It deliberately does not claim capability: every commercial
 * intent/asset combination in the service matrix is 'on-request', meaning
 * requested but not yet confirmed by operations (OWN-03).
 *
 * The honest version of that is a page that invites the enquiry and says what has
 * not been settled, rather than a page describing warehouse expertise nobody has
 * verified. Detail pages for office, shop, warehouse and industrial property stay
 * as drafts until capability is confirmed.
 */
export default function CommercialPage() {
  const commercialAssets = ASSET_TYPES.filter((asset) => asset.category === 'commercial');
  const allOnRequest = commercialAssets.every(
    (asset) => getCoverage('commercial', asset.id) === 'on-request'
  );

  return (
    <>
      <JsonLd data={buildServiceGraph(INTRO)} />

      <PageIntro eyebrow="Commercial" titleId="commercial-heading" title={INTRO.title} lead={INTRO.lead}>
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

      {allOnRequest ? (
        <Section tight labelledBy="commercial-status-heading">
          <Callout title="Where we actually stand on commercial work">
            <CalloutText>
              Our confirmed service is residential property — flats, independent houses, villas and
              sites. Commercial work is something we are asked about regularly and want to do, but we
              have not yet drawn the line on which parts of it we can handle properly.
            </CalloutText>
            <CalloutText>
              So this page is an enquiry route, not a service description. We are not going to claim
              office leasing or warehouse experience we have not established, and we would rather turn
              something down early than take it on badly.
            </CalloutText>
          </Callout>
        </Section>
      ) : null}

      <Section tone="raised" labelledBy="commercial-types-heading">
        <SectionHeader
          titleId="commercial-types-heading"
          eyebrow="What people ask about"
          title="The kinds of enquiry we get"
        />
        <Prose>
          <BulletList items={commercialAssets.map((asset) => asset.label)} />
          <p>
            Across buying, selling, taking on lease and leasing out. Tell us which of those you are
            doing, because they are very different conversations.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="commercial-useful-heading">
        <SectionHeader
          titleId="commercial-useful-heading"
          eyebrow="Useful to include"
          title="What helps us answer quickly"
        />
        <Prose>
          <BulletList
            items={[
              'What the space is for — office, retail, storage, light manufacturing.',
              'Roughly how much area, in square feet.',
              'The area or corridor you are looking at.',
              'Whether you are buying, selling, taking on lease, or leasing out.',
              'Your timeline.',
            ]}
          />
          <p>
            If it turns out to be outside what we handle, we will say so on the first call rather than
            keep you waiting.
          </p>
        </Prose>
      </Section>

      <Section tone="raised" labelledBy="commercial-limits-heading">
        <SectionHeader titleId="commercial-limits-heading" eyebrow="Worth being clear about" title="What we do not do" />
        <Prose>
          <BulletList
            items={[
              'No rental yield, occupancy, or return projections. Those are forecasts, not facts.',
              'No investment advice, and no valuation.',
              'No property management service.',
              'No legal, tax or regulatory opinion on a commercial transaction.',
            ]}
          />
          <p>
            Residential requirements are better served by the{' '}
            <Link href="/buy">buying</Link>, <Link href="/sell">selling</Link>,{' '}
            <Link href="/rent">renting</Link> and <Link href="/rent-out">renting out</Link> pages.
          </p>
        </Prose>
      </Section>

      <EnquirySection intent="commercial" />

      <RelatedLinks groups={serviceLinkGroups('commercial')} idPrefix="commercial" tone="paper" />

      <ContactBand
        title="Not sure it is something we cover?"
        text={`Call ${PRIMARY_PHONE} and ask. A two-minute conversation will settle it.`}
      />
    </>
  );
}
