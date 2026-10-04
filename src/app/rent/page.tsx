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
  title: 'Rent a home in Bengaluru',
  description: `Looking to rent a flat, independent house or villa in Bengaluru? Tell ${CANONICAL_BRAND} your areas, monthly budget and move-in date, or call ${PRIMARY_PHONE}.`,
  path: '/rent',
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
  title: 'Rent a home in Bengaluru',
  lead: 'Tell us where you want to stay, what you can pay each month, and when you need to move in.',
  path: '/rent',
};

export default function RentPage() {
  const assetTypes = getOfferedAssetTypes('rent');

  return (
    <>
      <JsonLd data={buildServiceGraph(INTRO)} />

      <PageIntro eyebrow="Renting" titleId="rent-heading" title={INTRO.title} lead={INTRO.lead}>
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

      <Section labelledBy="rent-help-heading">
        <SectionHeader
          titleId="rent-help-heading"
          eyebrow="What we do"
          title="Where a broker saves you time"
          lead="Renting in Bengaluru is mostly a scheduling problem. Places move quickly, owners are hard to reach, and half the visits turn out to be nothing like the description."
        />
        <CardGrid columns={3}>
          <Card title="Filtering before you travel" titleId="rent-help-1">
            We would rather tell you a place is wrong for you on the phone than have you cross the city
            to find out.
          </Card>
          <Card title="Getting the visit arranged" titleId="rent-help-2">
            Reaching the owner or caretaker, and fixing a time that actually happens.
          </Card>
          <Card title="Going through the terms" titleId="rent-help-3">
            Rent, deposit, maintenance, notice period, what is included, and what happens at the end.
            Read all of that before you commit to anything.
          </Card>
        </CardGrid>
      </Section>

      <Section tone="raised" labelledBy="rent-types-heading">
        <SectionHeader titleId="rent-types-heading" eyebrow="Property types" title="What we help with" />
        <Prose>
          <BulletList items={assetTypes.map((asset) => asset.label)} />
          <p>
            Helpful to mention early: how many people will be staying, whether you need parking,
            whether you have a pet, and whether you want it furnished. Those four answers rule a lot
            in and out.
          </p>
          <p>
            Looking for office or retail space on lease instead? That is the{' '}
            <Link href="/commercial">commercial page</Link>.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="rent-limits-heading">
        <SectionHeader titleId="rent-limits-heading" eyebrow="Worth being clear about" title="What this is not" />
        <Callout>
          <CalloutText>
            Sending a requirement starts a conversation. It does not hold a property for you, and it
            does not mean something matching your requirement is available right now.
          </CalloutText>
          <CalloutText>
            We also will not screen you, or ask you to be screened, on the basis of your occupation,
            community, family status, or where you are from. If that is something you have run into
            elsewhere, you have our sympathy, and it is not how we work.
          </CalloutText>
        </Callout>
      </Section>

      <EnquirySection intent="rent" />

      <RelatedLinks groups={serviceLinkGroups('rent')} idPrefix="rent" tone="paper" />

      <ContactBand
        title="Need something quickly?"
        text={`Call ${PRIMARY_PHONE}. A short conversation usually gets further than a form when you are moving soon.`}
      />
    </>
  );
}
