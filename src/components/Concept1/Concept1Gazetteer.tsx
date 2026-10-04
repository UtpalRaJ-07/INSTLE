'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Concept1Gazetteer.module.css';

interface LocalityItem {
  id: string;
  name: string;
  zone: string;
  character: string;
  connectivity: string;
  targetAssets: string;
  sourceRef: string;
}

const LOCALITIES: LocalityItem[] = [
  {
    id: 'indiranagar',
    name: 'Indiranagar',
    zone: 'East Bengaluru',
    character: 'Established residential neighbourhood with tree-lined streets, independent houses, villas and modern apartments near 100 Feet Road and 12th Main.',
    connectivity: 'Placeholder text for layout review. Not a source-checked statement.',
    targetAssets: 'Flats, independent houses and residential plots.',
    sourceRef: 'BBMP East Zone Ward 80 / Master Plan 2031',
  },
  {
    id: 'koramangala',
    name: 'Koramangala & HSR Layout',
    zone: 'South-East Bengaluru',
    character: 'Popular residential blocks (3rd & 4th Blocks) with neighbourhood parks and quick access to the Outer Ring Road tech corridor.',
    connectivity: 'Placeholder text for layout review. Not a source-checked statement.',
    targetAssets: 'Apartments, independent houses and villas.',
    sourceRef: 'BDA Layout Master Records / BBMP South',
  },
  {
    id: 'sadashivanagar',
    name: 'Sadashivanagar & Palace Orchards',
    zone: 'Central North Bengaluru',
    character: 'Quiet, green residential area near Sankey Tank with spacious independent houses and premium low-rise apartments.',
    connectivity: 'Placeholder text for layout review. Not a source-checked statement.',
    targetAssets: 'Independent houses, villas and premium apartments.',
    sourceRef: 'BBMP West Zone / Heritage Precinct Registry',
  },
  {
    id: 'north-bengaluru',
    name: 'Hebbal & Airport Corridor',
    zone: 'North Bengaluru',
    character: 'Growing residential corridor along Bellary Road connecting Hebbal to Kempegowda International Airport.',
    connectivity: 'Placeholder text for layout review. Not a source-checked statement.',
    targetAssets: 'Gated community flats, villas and residential layouts.',
    sourceRef: 'BMRDA Master Strategy & BMRCL Phase 2B Alignment',
  },
];

export function Concept1Gazetteer() {
  return (
    <section className={styles.section} id="localities" aria-labelledby="c1-gazetteer-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.metaRow}>
            <span className={styles.kicker}>EXPLORE BENGALURU AREAS</span>
            <span className={styles.gateBadge}>PROTOTYPE CONTENT &mdash; NOT SOURCE-CHECKED</span>
          </div>
          <h2 id="c1-gazetteer-title" className={styles.title}>
            Which area are you considering?
          </h2>
          <p className={styles.lead}>
            We help buyers, tenants and property owners understand established neighbourhoods and emerging residential corridors across Bengaluru.
          </p>
        </div>

        <div className={styles.gazetteerList}>
          {LOCALITIES.map((loc, idx) => (
            <article key={loc.id} className={styles.localityRow} aria-labelledby={`loc-${loc.id}`}>
              <div className={styles.rowOrder}>
                <span className={styles.indexNum}>0{idx + 1}</span>
                <span className={styles.zoneTag}>{loc.zone}</span>
              </div>

              <div className={styles.rowMain}>
                <h3 id={`loc-${loc.id}`} className={styles.locName}>
                  {loc.name}
                </h3>
                <p className={styles.locCharacter}>{loc.character}</p>

                <div className={styles.attributeGrid}>
                  <div className={styles.attr}>
                    <span className={styles.attrLabel}>CONNECTIVITY</span>
                    <span className={styles.attrVal}>{loc.connectivity}</span>
                  </div>
                  <div className={styles.attr}>
                    <span className={styles.attrLabel}>COMMON PROPERTY TYPES</span>
                    <span className={styles.attrVal}>{loc.targetAssets}</span>
                  </div>
                </div>
              </div>

              <div className={styles.rowAction}>
                <span className={styles.sourceMeta}>{loc.sourceRef}</span>
                <Link
                  href={`/areas/${loc.id}`}
                  className={styles.inquireLink}
                >
                  <span>View area details →</span>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.footerNote}>
          <p>
            * Prototype layout only. The locality statements shown here have not passed the project claim gate and are not published on the public site.
          </p>
        </div>
      </div>
    </section>
  );
}
