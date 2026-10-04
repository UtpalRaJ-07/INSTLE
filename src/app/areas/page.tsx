import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { getPublishedLocalities } from '@/config/localities';
import { GEOGRAPHIC_COVERAGE_STATEMENT } from '@/config/service-matrix';
import { groupPublishedLocalities } from '@/lib/locality-grouping';
import { buildPageMetadata } from '@/lib/metadata';
import {
  ActionRow,
  BulletList,
  CallButton,
  ContactBand,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';
import { CorridorDiagram } from '@/components/Bengaluru';
import { AreaHub } from '@/components/AreaHub/AreaHub';

/**
 * Static wording only. No record field reaches the metadata — in particular no
 * `marketingGroup`, which is a browsing label and not a place description.
 * Requirement 1.6. The page emits no structured data of its own.
 */
export const metadata: Metadata = buildPageMetadata({
  title: 'Areas we work in across Bengaluru',
  description: `Which Bengaluru area are you considering? Tell ${CANONICAL_BRAND} where you are looking and we will tell you what we know. Call ${PRIMARY_PHONE}.`,
  path: '/areas',
});

/**
 * Rendered per request, for the same reason as `/areas/[slug]`. The hub lists what
 * the gate admits at the date of the request (Requirement 1.3); prerendered, it
 * would keep linking a record after its review date or a claim's recheck date had
 * passed and its own page had started returning 404. Adds no client JavaScript.
 */
export const dynamic = 'force-dynamic';

/**
 * Area hub.
 *
 * A thin wrapper around the shared publication gate. Visibility is decided in one
 * place — `getPublishedLocalities`, called with the date of this render — and the
 * grouping and markup take whatever it admits. Requirements 1.3, 2.5.
 *
 * Nothing passes the gate today, so `AreaHub` renders the empty state naming the
 * four publication conditions, at HTTP 200. Requirement 2.1.
 */
export default function AreasPage() {
  const groups = groupPublishedLocalities(getPublishedLocalities(new Date()));

  return (
    <>
      <PageIntro
        eyebrow="Bengaluru areas"
        titleId="areas-heading"
        title="Areas we work in"
        lead="Which area are you considering? Tell us, and we will tell you what we actually know about it."
      >
        <ActionRow>
          <CallButton />
          <SecondaryLink href="/buy">Buying</SecondaryLink>
          <SecondaryLink href="/rent">Renting</SecondaryLink>
        </ActionRow>
      </PageIntro>

      {/*
        The corridor schematic. An orientation aid and nothing more: no place is
        named on it, no boundary is drawn because no boundary claim has passed the
        claim gate, and it carries no distance and no travel time. The figure's own
        caption says so, which is Requirement 9.3.
      */}
      <Section tight>
        <CorridorDiagram />
      </Section>

      {/*
        One heading per non-empty group, the browsing-aid note beside each, at most
        25 visible links per group and the rest in a closed <details> in this same
        HTML — or, while nothing passes the gate, the empty state.
      */}
      <AreaHub groups={groups} />


      <Section tone="raised" labelledBy="areas-coverage-heading">
        <SectionHeader
          titleId="areas-coverage-heading"
          eyebrow="Coverage"
          title="Where we work"
          lead={GEOGRAPHIC_COVERAGE_STATEMENT}
        />
        <Prose>
          <p>
            We are not going to claim an office in every locality or coverage of every PIN code. What we
            will do is tell you, on the first call, whether the area you are asking about is one we can
            genuinely help in.
          </p>
          <p>
            That includes saying no. If you are looking somewhere we do not work, it is better for you
            to know in two minutes than to find out in two weeks.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="areas-standard-heading">
        <SectionHeader
          titleId="areas-standard-heading"
          eyebrow="Our standard"
          title="What goes into an area guide before we publish it"
        />
        <Prose>
          <BulletList
            items={[
              'Every factual claim supported by two sources from different publishers, not two pages from the same one.',
              'Exact references — the actual notification, map or bulletin, with the date it was read. Not an organisation homepage.',
              'A named person who checked the evidence, and a named person who reviewed the writing.',
              'A recheck date, because ward boundaries and project statuses change.',
              'No invented commute times, distances, price trends, PIN codes, or “high demand” statements.',
              'Planned infrastructure described as planned, never as operational.',
            ]}
          />
          <p>
            If a claim cannot clear that, it comes out of the page. If enough of them come out, the page
            does not publish.
          </p>
        </Prose>
      </Section>

      <ContactBand
        title="Tell us the area you have in mind"
        text={`Call ${PRIMARY_PHONE}. We will tell you what we know, and say so when we do not know.`}
      />
    </>
  );
}
