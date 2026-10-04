import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { getPublishedGuides } from '@/config/guides';
import { guideLink } from '@/lib/internal-links';
import { buildPageMetadata } from '@/lib/metadata';
import {
  ActionRow,
  CallButton,
  ContactBand,
  EmptyState,
  EmptyStateText,
  LinkCard,
  LinkCardGrid,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
} from '@/components/ui';

export const metadata: Metadata = buildPageMetadata({
  title: 'Guides',
  description: `Straight answers to questions people ask ${CANONICAL_BRAND} about buying, selling and renting property in Bengaluru.`,
  path: '/guides',
});

/**
 * Rendered per request, so the list is what the guide gate admits at the date of
 * the request (Requirement 4.13) and never links a guide whose own page has
 * started returning 404. Adds no client JavaScript.
 */
export const dynamic = 'force-dynamic';

export default function GuidesPage() {
  const guides = getPublishedGuides(new Date());

  return (
    <>
      <PageIntro
        eyebrow="Guides"
        titleId="guides-heading"
        title="Questions people ask us"
        lead="Short, honest answers. Where the answer is “we cannot promise that”, it says so."
      />

      {guides.length > 0 ? (
        <Section labelledBy="guides-list-heading">
          <SectionHeader titleId="guides-list-heading" eyebrow="Published" title="Published guides" />
          <LinkCardGrid>
            {guides.map((guide) => (
              <LinkCard key={guide.guideId} href={guideLink(guide).href} title={guideLink(guide).text}>
                {guide.directAnswer.length > 170
                  ? `${guide.directAnswer.slice(0, 167)}…`
                  : guide.directAnswer}
              </LinkCard>
            ))}
          </LinkCardGrid>
        </Section>
      ) : (
        <Section>
          <EmptyState title="No guides are published yet">
            <EmptyStateText>
              Guides go up when there is a named person behind them who can stand by what they say.
            </EmptyStateText>
            <ActionRow>
              <CallButton />
            </ActionRow>
          </EmptyState>
        </Section>
      )}

      <Section tone="raised" labelledBy="guides-scope-heading">
        <SectionHeader
          titleId="guides-scope-heading"
          eyebrow="What is not here"
          title="Topics we have not published"
        />
        <Prose>
          <p>
            You will not find guides here on property documents, stamp duty, capital gains, khata
            transfers, or brokerage fee percentages. Those are the pages most real estate sites lead
            with, and they are also the ones most likely to be quietly out of date or quietly wrong.
          </p>
          <p>
            They are written and waiting. They publish when someone qualified has checked them against
            current primary sources and put their name to them. Guessing at tax rates to fill a content
            calendar is how people end up making expensive decisions on bad information.
          </p>
          <p>
            In the meantime, ask us on the phone. We will tell you what we know, and where you need a
            lawyer or a chartered accountant rather than a broker.
          </p>
        </Prose>
      </Section>

      <ContactBand
        title="Question not answered here?"
        text={`Call ${PRIMARY_PHONE} and ask it directly.`}
      />
    </>
  );
}
