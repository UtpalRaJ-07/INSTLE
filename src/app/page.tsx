import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, CUSTOMER_INTENTS, PRIMARY_PHONE } from '@/config/constants';
import { OWNER_INTRODUCTION, OWNER_PROFILE } from '@/config/owner';
import { ASSET_TYPES, GEOGRAPHIC_COVERAGE_STATEMENT, getCoverage } from '@/config/service-matrix';
import { getPublishedLocalities } from '@/config/localities';
import { getPublishedGuides } from '@/config/guides';
import { getReviewDisplayState } from '@/config/reviews';
import { guideLink } from '@/lib/internal-links';
import { buildPageMetadata } from '@/lib/metadata';
import { buildSiteGraph } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd/JsonLd';
import { CivicStreetscapeBand } from '@/components/Bengaluru';
import { CssArchitecture } from '@/components/BrandIntro/CssArchitecture';
import {
  ActionRow,
  CallButton,
  Callout,
  CalloutText,
  Card,
  CardGrid,
  ContactBand,
  EmptyState,
  EmptyStateText,
  IntentCards,
  LinkCard,
  LinkCardGrid,
  PrimaryLink,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';
import styles from './page.module.css';

export const metadata: Metadata = buildPageMetadata({
  title: 'Buy, sell or rent property in Bengaluru',
  description: `Tell ${CANONICAL_BRAND} your preferred area, property type and budget. Speak to our team about buying, selling, renting or renting out property in Bengaluru. Call ${PRIMARY_PHONE}.`,
  path: '/',
});

/**
 * Rendered per request. The page lists the published localities and guides, so it
 * shows what the gate admits at the date of the request (Requirement 1.3);
 * prerendered, it would keep listing a record after its review date passed and its
 * own page began returning 404 — the disagreement Property 2 rules out. Adds no
 * client JavaScript.
 */
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const publishedLocalities = getPublishedLocalities();
  const guides = getPublishedGuides();
  const reviews = getReviewDisplayState();

  // Property types the brokerage has actually confirmed for buying or selling.
  const confirmedResidentialTypes = ASSET_TYPES.filter(
    (asset) => getCoverage('buy', asset.id) === 'offered' || getCoverage('sell', asset.id) === 'offered'
  );

  return (
    <>
      <JsonLd data={buildSiteGraph()} />

      {/*
        1. Headline, four intents, direct phone — over the settled architecture of
        the opening film, which dissolves into exactly this scene.
      */}
      <section className={`${styles.hero} surface-night`} aria-labelledby="home-heading">
        <div className={styles.heroArt}>
          <CssArchitecture still />
        </div>
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroInner}>
            <span className={styles.heroEyebrow}>Bengaluru real estate brokerage</span>
            <h1 id="home-heading" className={styles.heroTitle}>
              Buy, sell or rent property in Bengaluru
            </h1>
            <p className={styles.heroLead}>
              Tell {CANONICAL_BRAND} your preferred area, property type and budget. Speak to our
              team about buying, selling, renting or renting out.
            </p>
          </div>

          <div className={styles.heroIntents}>
            <h2 className="visually-hidden">What would you like to do?</h2>
            <IntentCards intents={CUSTOMER_INTENTS} />
          </div>

          <div className={styles.heroPhoneRow}>
            <CallButton />
            <span className={styles.heroPhoneNote}>
              Would rather talk it through? Call {PRIMARY_PHONE} and ask for whatever you need.
            </span>
          </div>
        </div>
      </section>

      {/*
        2. The Bengaluru element, Requirement 9.2.
        An original line drawing of a residential street — parapet water tanks, a
        monkey-top window, a rain tree, a compound gate. Not a photograph, not a
        property, and labelled an illustration in the figure's own caption.
      */}
      <Section tight>
        <CivicStreetscapeBand />
      </Section>

      {/* 3. What a brokerage actually does here, and how to start. */}
      <Section tone="raised" labelledBy="what-we-do-heading">
        <SectionHeader
          titleId="what-we-do-heading"
          eyebrow="What we do"
          title="A person, not a property catalogue"
          lead="This is not a listings site. There is nothing to scroll through here, and no prices or availability on these pages. What you do instead is tell us what you need, and someone works on it with you."
        />
        <CardGrid columns={3}>
          <Card title="You describe the requirement" titleId="home-help-1">
            Property type, the areas you are considering, roughly what you can spend, and when. None
            of it needs to be exact, and &ldquo;I am not sure yet&rdquo; is a real answer to most of
            those questions.
          </Card>
          <Card title="We tell you where you stand" titleId="home-help-2">
            Including when your expectation is going to be difficult in that area or at that budget.
            You are better off hearing that at the start than three weeks in.
          </Card>
          <Card title="Nothing is published about you" titleId="home-help-3">
            Your requirement is not posted anywhere. If you own the property, we do not put your
            number, address or photographs on a public portal.
          </Card>
        </CardGrid>
        {/* The contact route is offered once, in the closing band. Requirement 8.7
            allows a page three call actions, and the call button above, the band's
            call button and the band's contact link are those three. */}
        <ActionRow>
          <PrimaryLink href="/how-it-works">How we work</PrimaryLink>
        </ActionRow>
      </Section>

      {/* 4. Supported property types, driven by the service matrix. */}
      <Section labelledBy="property-types-heading">
        <SectionHeader
          titleId="property-types-heading"
          eyebrow="Property types"
          title="What we handle"
          lead="Residential property across Bengaluru, for buying, selling, renting and renting out."
        />
        <ul className={styles.typeList}>
          {confirmedResidentialTypes.map((asset) => (
            <li key={asset.id} className={styles.typeItem}>
              {asset.label}
            </li>
          ))}
        </ul>
        <p className={styles.typeNote}>
          Asked about commercial property — offices, shops, warehouses — often enough that it is
          worth saying where we stand: we have not yet drawn the line on which commercial work we
          take on.{' '}
          <Link href="/commercial">Tell us what you need</Link> and we will say straight away whether
          it is something we can help with.
        </p>
        <p className={styles.typeNote}>{GEOGRAPHIC_COVERAGE_STATEMENT}</p>
      </Section>

      {/* 5. The process, in four steps. */}
      <Section tone="raised" labelledBy="process-heading">
        <SectionHeader
          titleId="process-heading"
          eyebrow="How it goes"
          title="Four steps, and you can stop at any of them"
        />
        <ol className={styles.processList}>
          <li className={styles.processItem}>
            <h3 className={styles.processTitle}>Tell us what you need</h3>
            <p className={styles.processText}>
              By phone, or by sending the details from one of the four pages above.
            </p>
          </li>
          <li className={styles.processItem}>
            <h3 className={styles.processTitle}>We talk it through</h3>
            <p className={styles.processText}>
              Budget, areas, timing, and anything that is going to be a problem.
            </p>
          </li>
          <li className={styles.processItem}>
            <h3 className={styles.processTitle}>We coordinate the next step</h3>
            <p className={styles.processText}>
              Visits, introductions, and the practical arrangements around them.
            </p>
          </li>
          <li className={styles.processItem}>
            <h3 className={styles.processTitle}>We tell you where it stands</h3>
            <p className={styles.processText}>
              What actually happened, and what we think should change if it is not moving.
            </p>
          </li>
        </ol>
      </Section>

      {/* 6. Areas. Nothing is published until it passes the evidence gate. */}
      <Section labelledBy="areas-heading">
        <SectionHeader
          titleId="areas-heading"
          eyebrow="Bengaluru areas"
          title="Which area are you considering?"
        />
        {publishedLocalities.length > 0 ? (
          <>
            <LinkCardGrid>
              {publishedLocalities.map((locality) => (
                <LinkCard
                  key={locality.slug}
                  href={`/areas/${locality.slug}`}
                  title={locality.canonicalName}
                >
                  {locality.summary}
                </LinkCard>
              ))}
            </LinkCardGrid>
            <ActionRow>
              <SecondaryLink href="/areas">All areas</SecondaryLink>
            </ActionRow>
          </>
        ) : (
          <EmptyState title="Our area guides are not ready yet">
            <EmptyStateText>
              We would rather have no area pages than ones full of commute times and ward numbers we
              have not checked. The guides go up as each one is researched and reviewed.
            </EmptyStateText>
            <EmptyStateText>
              In the meantime, name the area on a call and we will tell you what we know about it —
              and say so when we do not know.
            </EmptyStateText>
            {/* No second call button here: the phone is in the hero and the closing
                band, and a fourth call action would break Requirement 8.7. */}
            <ActionRow>
              <SecondaryLink href="/areas">More about our area coverage</SecondaryLink>
            </ActionRow>
          </EmptyState>
        )}
      </Section>

      {/* 7. Seller and landlord callout. */}
      <Section tone="raised" labelledBy="owners-heading">
        <SectionHeader
          titleId="owners-heading"
          eyebrow="Owners and landlords"
          title="Selling, or putting a property on rent?"
          lead="Five things get a useful first conversation going. No documents, and not your full address."
        />
        <Callout title="What to have ready">
          <CalloutText>
            The type of property, the area it is in, whether you own it or represent the owner, when
            you would like to move, and a number we can reach you on. A price you have in mind is
            useful but not required.
          </CalloutText>
          <CalloutText>
            What we will not do is tell you a date your property will sell by. Nobody can promise
            that, and a date without a buyer behind it is just a number.
          </CalloutText>
        </Callout>
        <ActionRow>
          <PrimaryLink href="/sell">I want to sell</PrimaryLink>
          <SecondaryLink href="/rent-out">I want to rent out</SecondaryLink>
        </ActionRow>
      </Section>

      {/* 8. Owner introduction. Name and role only. */}
      <Section labelledBy="owner-heading">
        <div className={styles.ownerBlock}>
          <div>
            <span
              className={styles.heroEyebrow}
              style={{ marginBottom: 'var(--space-3)', display: 'block' }}
            >
              Who runs this
            </span>
            <h2 id="owner-heading" className={styles.ownerName}>
              {OWNER_PROFILE.name}
            </h2>
            <p className={styles.ownerRole}>{OWNER_PROFILE.role}</p>
          </div>
          <p style={{ fontSize: 'var(--font-size-body-large)', lineHeight: 'var(--line-height-body-large)' }}>
            {OWNER_INTRODUCTION}
          </p>
          <ActionRow>
            <SecondaryLink href={OWNER_PROFILE.route}>About {OWNER_PROFILE.name}</SecondaryLink>
          </ActionRow>
        </div>
      </Section>

      {/*
        9. Reviews.
        Omitted entirely while there are no approved, permissioned reviews. No
        placeholder names, no empty stars, no count.
      */}
      {reviews.hasApprovedReviews ? (
        <Section tone="raised" labelledBy="reviews-heading">
          <SectionHeader
            titleId="reviews-heading"
            eyebrow="What customers say"
            title={
              reviews.count === 1
                ? 'One review from a customer'
                : `${reviews.count} reviews from customers`
            }
          />
          <CardGrid columns={2}>
            {reviews.reviews.map((review) => (
              <Card key={review.reviewId} title={review.allowedAttribution}>
                {review.originalText}
              </Card>
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {/* 10. Guides, linked by intent. */}
      {guides.length > 0 ? (
        <Section tone="raised" labelledBy="guides-heading">
          <SectionHeader
            titleId="guides-heading"
            eyebrow="Straight answers"
            title="Things people ask us"
          />
          <LinkCardGrid>
            {guides.map((guide) => (
              <LinkCard key={guide.guideId} href={guideLink(guide).href} title={guideLink(guide).text}>
                {guide.directAnswer.length > 150
                  ? `${guide.directAnswer.slice(0, 147)}…`
                  : guide.directAnswer}
              </LinkCard>
            ))}
          </LinkCardGrid>
          <ActionRow>
            <SecondaryLink href="/guides">All guides</SecondaryLink>
          </ActionRow>
        </Section>
      ) : null}

      {/* 11. Contact band. */}
      <ContactBand
        title="Tell us what you need"
        text={`Call ${PRIMARY_PHONE} and speak to someone about your property requirement, or start from the page that matches what you want to do.`}
        enquiryHref="/contact"
        enquiryLabel="Other ways to reach us"
      />
    </>
  );
}
