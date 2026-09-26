import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
  DOMAIN_STATUS,
} from '@/config/constants';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: `[INTERNAL PREVIEW] Design Review & Selection Lab — ${CANONICAL_BRAND}`,
  description:
    'Internal design review: Side-by-side rendered visual concept analysis, media ledger, and architectural recommendation for INSTLE REAL ESTATE.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConceptReviewPage() {
  return (
    <div className={styles.reviewWrapper}>
      <header className={styles.reviewHeader}>
        <div className={styles.container}>
          <div className={styles.tagLine}>
            <span className={styles.badge}>SECTION 2 DESIGN RESET</span>
            <span className={styles.dateBadge}>SEPTEMBER 2026</span>
          </div>
          <h1 className={styles.mainTitle}>
            INSTLE REAL ESTATE: VISUAL CONCEPTS REVIEW &amp; SELECTION
          </h1>
          <p className={styles.mainDesc}>
            Comparative architectural audit of two genuinely different rendered visual systems for {CANONICAL_BRAND}. Both concepts reject property-portal listing grids in favor of service-led requirement capture, direct telephone access ({PRIMARY_PHONE}), and authentic Bengaluru architectural atmosphere.
          </p>

          <div className={styles.quickJumpBar}>
            <Link href="/concept-1" className={styles.jumpBtnC1}>
              <span>Experience Concept 1: Garden City Modernism →</span>
            </Link>
            <Link href="/concept-2" className={styles.jumpBtnC2}>
              <span>Experience Concept 2: Metropolitan Monolith →</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className={styles.reviewMain} tabIndex={-1}>
        <div className={styles.container}>
          {/* Side-by-Side Visual Overview */}
          <section className={styles.matrixSection} aria-labelledby="section-comparison">
            <h2 id="section-comparison" className={styles.sectionHeading}>
              01. Side-by-Side Architectural Systems Comparison
            </h2>

            <div className={styles.sideBySideGrid}>
              {/* CONCEPT 1 CARD */}
              <article className={styles.conceptCard1}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardBadgeC1}>CONCEPT 01</div>
                  <h3 className={styles.cardTitleC1}>Architectural Dossier &amp; Garden City Modernism</h3>
                  <p className={styles.cardArchetype}>The Private Monograph &amp; Heritage Architectural Sanctuary</p>
                </div>

                <div className={styles.cardMedia}>
                  <Image
                    src="/media/concept1-garden-modernism.jpg"
                    alt="Concept 1: Garden City Modernism architectural preview"
                    width={800}
                    height={450}
                    className={styles.previewImage}
                  />
                  <span className={styles.mediaTag}>Atmosphere: Exposed Concrete, Sadahalli Granite &amp; Raintree Canopy</span>
                </div>

                <div className={styles.specList}>
                  <div className={styles.specItem}>
                    <strong>Typographic Hierarchy:</strong>
                    <span>Cormorant Garamond (Editorial Serif Display) paired with Plus Jakarta Sans (Humanist Precision Body). High-contrast tracking on all-caps brand lockup.</span>
                  </div>
                  <div className={styles.specItem}>
                    <strong>Palette &amp; Atmosphere:</strong>
                    <span>Warm Paper (#F9F7F2), Deep Cubbon Forest (#1E3A31), Sadahalli Stone (#E2DCD2), and Burnished Architectural Brass (#B68A4C).</span>
                  </div>
                  <div className={styles.specItem}>
                    <strong>Compositional Rhythm:</strong>
                    <span>Asymmetrical editorial grid with generous whitespace, Roman numeral dossiers (01/02/03), coordinates (12°58′N 77°35′E), and structured gazetteer listings.</span>
                  </div>
                  <div className={styles.specItem}>
                    <strong>Intake Paradigm:</strong>
                    <span>“The Acquisition Brief” — tactile multi-step dossier with progressive disclosure, courtyard architectural plate, and clear DPDP Act 2023 consent framing.</span>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <Link href="/concept-1" className={styles.btnPrimaryC1}>
                    View Concept 1 Homepage →
                  </Link>
                  <Link href="/concept-1/intake" className={styles.btnSecondaryC1}>
                    Test C1 Acquisition Brief →
                  </Link>
                </div>
              </article>

              {/* CONCEPT 2 CARD */}
              <article className={styles.conceptCard2}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardBadgeC2}>CONCEPT 02</div>
                  <h3 className={styles.cardTitleC2}>Bengaluru Metropolitan Monolith</h3>
                  <p className={styles.cardArchetype}>High-Precision Brokerage &amp; Technical Console</p>
                </div>

                <div className={styles.cardMedia}>
                  <Image
                    src="/media/concept2-metropolitan-monolith.jpg"
                    alt="Concept 2: Metropolitan Monolith architectural preview"
                    width={800}
                    height={450}
                    className={styles.previewImage}
                  />
                  <span className={styles.mediaTag}>Atmosphere: Monolithic Charcoal Granite &amp; Precision Glass Reveal</span>
                </div>

                <div className={styles.specList}>
                  <div className={styles.specItem}>
                    <strong>Typographic Hierarchy:</strong>
                    <span>Space Grotesk (Sculptural Display) paired with JetBrains Mono (Technical HUD &amp; Coordinates) and Plus Jakarta Sans. Monolithic geometric cuts.</span>
                  </div>
                  <div className={styles.specItem}>
                    <strong>Palette &amp; Atmosphere:</strong>
                    <span>Deep Obsidian (#0B0E14), High-Density Carbon (#121824), Precision Azure (#2563EB), and Electric Slate (#38BDF8). High-contrast dark gallery.</span>
                  </div>
                  <div className={styles.specItem}>
                    <strong>Compositional Rhythm:</strong>
                    <span>Full-bleed modular grid with hairline gridlines, technical status badges, coordinate headers, and structured tabular corridor matrices.</span>
                  </div>
                  <div className={styles.specItem}>
                    <strong>Intake Paradigm:</strong>
                    <span>“Requirements Console” — real-time dynamic parameter sidebar that recalculates client criteria live as buttons are selected. Fast, executive, interactive.</span>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <Link href="/concept-2" className={styles.btnPrimaryC2}>
                    View Concept 2 Homepage →
                  </Link>
                  <Link href="/concept-2/intake" className={styles.btnSecondaryC2}>
                    Test C2 Requirements Console →
                  </Link>
                </div>
              </article>
            </div>
          </section>

          {/* Architectural Recommendation Section */}
          <section className={styles.recommendationSection} aria-labelledby="section-recommendation">
            <div className={styles.recommendHeader}>
              <span className={styles.recommendBadge}>STRATEGIC EVALUATION &amp; VERDICT</span>
              <h2 id="section-recommendation" className={styles.recommendTitle}>
                Recommended Direction: Concept 1 (Garden City Modernism)
              </h2>
            </div>

            <div className={styles.recommendBody}>
              <p className={styles.recommendLead}>
                We formally recommend <strong>Concept 1: Architectural Dossier &amp; Garden City Modernism</strong> as the canonical visual identity for INSTLE REAL ESTATE in Bengaluru.
              </p>

              <div className={styles.rationaleGrid}>
                <div className={styles.rationaleCard}>
                  <span className={styles.ratNum}>01</span>
                  <h4 className={styles.ratTitle}>Defensible Local Distinction</h4>
                  <p className={styles.ratText}>
                    Bengaluru real estate websites typically fall into two traps: low-end portal listing scrapers, or generic international dark-mode tech templates. Concept 1 grounds the brand in the genuine architectural legacy of Bengaluru: lush raintree canopies, exposed cast-concrete, and warm Sadahalli granite. It establishes immediate emotional credibility with high-net-worth buyers and property owners.
                  </p>
                </div>

                <div className={styles.rationaleCard}>
                  <span className={styles.ratNum}>02</span>
                  <h4 className={styles.ratTitle}>Elevated Advisory Posture</h4>
                  <p className={styles.ratText}>
                    Because INSTLE is a service-led brokerage and NOT a property listing portal, the monograph/dossier aesthetic reinforces confidentiality, discretion, and depth. Clients feel they are commissioning a bespoke advisory service rather than querying a software database.
                  </p>
                </div>

                <div className={styles.rationaleCard}>
                  <span className={styles.ratNum}>03</span>
                  <h4 className={styles.ratTitle}>Superior Mobile Warmth &amp; Ergonomics</h4>
                  <p className={styles.ratText}>
                    On mobile devices, Concept 1’s warm ivory background, organic margins, and high-contrast editorial serif headers provide exceptional reading comfort in Indian ambient sunlight, avoiding the visual fatigue associated with dense dark-mode interfaces.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Media & Rights Attribution Ledger */}
          <section className={styles.ledgerSection} aria-labelledby="section-ledger">
            <h2 id="section-ledger" className={styles.sectionHeading}>
              02. Media Rights &amp; Attribution Register
            </h2>
            <div className={styles.tableScroll}>
              <table className={styles.ledgerTable}>
                <thead>
                  <tr>
                    <th>ASSET IDENTIFIER</th>
                    <th>CONCEPT</th>
                    <th>SUBJECT MATTER</th>
                    <th>PRODUCTION CONTEXT</th>
                    <th>USAGE PERMISSION / STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>concept1-garden-modernism.jpg</code></td>
                    <td>Concept 1</td>
                    <td>Contemporary residential sanctuary with raintree canopy &amp; pool in Bengaluru</td>
                    <td>Commissioned conceptual architectural study</td>
                    <td>Editorial Prototype (Rights Logged)</td>
                  </tr>
                  <tr>
                    <td><code>concept1-courtyard-detail.jpg</code></td>
                    <td>Concept 1</td>
                    <td>Minimalist interior light court with Sadahalli stone floor &amp; bamboo foliage</td>
                    <td>Commissioned interior architectural study</td>
                    <td>Editorial Prototype (Rights Logged)</td>
                  </tr>
                  <tr>
                    <td><code>concept2-metropolitan-monolith.jpg</code></td>
                    <td>Concept 2</td>
                    <td>Monolithic dark granite facade with illuminated glass balconies at dusk</td>
                    <td>Commissioned urban architectural study</td>
                    <td>Editorial Prototype (Rights Logged)</td>
                  </tr>
                  <tr>
                    <td><code>concept2-gallery-console.jpg</code></td>
                    <td>Concept 2</td>
                    <td>Minimalist advisory conference gallery with stone counter &amp; cove lighting</td>
                    <td>Commissioned advisory interior study</td>
                    <td>Editorial Prototype (Rights Logged)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.ledgerNotice}>
              * Compliance notice per AGENTS.md Section 3: All media assets are classified as conceptual architectural studies. No asset is represented as an existing public inventory property or verified listing.
            </p>
          </section>
        </div>
      </main>

      <footer className={styles.reviewFooter}>
        <div className={styles.container}>
          <div className={styles.footerFlex}>
            <span>{CANONICAL_BRAND} · BENGALURU ADVISORY SELECTION</span>
            <span>DIRECT PHONE: <a href={PRIMARY_PHONE_TEL}>{PRIMARY_PHONE}</a></span>
            <span>DOMAIN: {DOMAIN_STATUS}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
