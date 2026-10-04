import React from 'react';
import type { Metadata } from 'next';
import { CUSTOMER_INTENTS, PRIMARY_PHONE } from '@/config/constants';
import { buildPageMetadata } from '@/lib/metadata';
import {
  ActionRow,
  CallButton,
  IntentCards,
  LinkCard,
  LinkCardGrid,
  PageIntro,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';

export const metadata: Metadata = buildPageMetadata({
  title: 'Page not found',
  description: 'This page does not exist. Here are the main things you can do from here.',
  path: '/404',
  noindex: true,
});

/**
 * 404.
 *
 * Returns a real 404 status (Next.js handles that for this convention) and offers
 * the routes a lost visitor most likely wanted. It does not redirect to the
 * homepage, which would turn a missing page into a soft 404.
 */
export default function NotFound() {
  return (
    <>
      <PageIntro
        eyebrow="404"
        titleId="not-found-heading"
        title="We could not find that page"
        lead="It may have moved, or the address may have a typo in it. Here is what you can do from here."
      >
        <ActionRow>
          <CallButton />
          <SecondaryLink href="/">Go to the home page</SecondaryLink>
        </ActionRow>
      </PageIntro>

      <Section labelledBy="not-found-intents-heading">
        <SectionHeader
          titleId="not-found-intents-heading"
          eyebrow="Start here"
          title="What would you like to do?"
        />
        <IntentCards intents={CUSTOMER_INTENTS} />
      </Section>

      <Section tone="raised" labelledBy="not-found-links-heading">
        <SectionHeader titleId="not-found-links-heading" eyebrow="Other pages" title="You may want" />
        <LinkCardGrid>
          <LinkCard href="/areas" title="Areas we work in">
            Where we work across Bengaluru, and how our area guides are researched.
          </LinkCard>
          <LinkCard href="/guides" title="Guides">
            Straight answers to questions people ask us.
          </LinkCard>
          <LinkCard href="/how-it-works" title="How we work">
            What happens at each stage, and what we do not promise.
          </LinkCard>
          <LinkCard href="/contact" title="Contact">
            Call {PRIMARY_PHONE} and speak to our team.
          </LinkCard>
        </LinkCardGrid>
      </Section>
    </>
  );
}
