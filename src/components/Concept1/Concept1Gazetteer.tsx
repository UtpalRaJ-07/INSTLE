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
    name: 'Indiranagar & Old Airport Road',
    zone: 'East Urban Enclave',
    character: 'Historic residential layouts with dense raintree canopy, generous low-rise plots, and vibrant cultural perimeter.',
    connectivity: 'Namma Metro Purple Line operational; 15 min to Central Business District.',
    targetAssets: 'Bespoke townhomes, private bungalows & heritage redevelopment penthouses.',
    sourceRef: 'BBMP East Zone Ward 80 / Master Plan 2031',
  },
  {
    id: 'koramangala',
    name: 'Koramangala & HSR Layout',
    zone: 'South-East Growth Belt',
    character: 'Prominent innovation and executive residential hub with quiet residential blocks (3rd & 4th Blocks) and established civic greenery.',
    connectivity: 'Proximity to Outer Ring Road tech corridor; Silk Board junction transit interchange.',
    targetAssets: 'Contemporary gated luxury residences & independent executive villas.',
    sourceRef: 'BDA Layout Master Records / BBMP South',
  },
  {
    id: 'sadashivanagar',
    name: 'Sadashivanagar & Palace Orchards',
    zone: 'Central Heritage Belt',
    character: 'Premier sanctuary enclave characterized by expansive leafy avenues, institutional prestige, and high architectural restraint.',
    connectivity: 'Direct access to Sankey Tank, Central Bengaluru, and Hebbal flyover gateway.',
    targetAssets: 'High-capital independent estates & ultra-low-density residential floors.',
    sourceRef: 'BBMP West Zone / Heritage Precinct Registry',
  },
  {
    id: 'north-bengaluru',
    name: 'Hebbal & Bellary Road Corridor',
    zone: 'North Strategic Corridor',
    character: 'Rapidly transforming master-planned residential belt linking central Bengaluru to Kempegowda International Airport.',
    connectivity: 'Operational Bellary Road expressway; Blue Line Metro construction under Phase 2B.',
    targetAssets: 'Large-footprint luxury apartments, lakeview condominiums & gated golf communities.',
    sourceRef: 'BMRDA Master Strategy & BMRCL Phase 2B Alignment',
  },
];

export function Concept1Gazetteer() {
  return (
    <section className={styles.section} id="localities" aria-labelledby="c1-gazetteer-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.metaRow}>
            <span className={styles.kicker}>MICRO-MARKET GAZETTEER</span>
            <span className={styles.gateBadge}>TWO-SOURCE CLAIM GATE VERIFIED</span>
          </div>
          <h2 id="c1-gazetteer-title" className={styles.title}>
            Bengaluru micro-market intelligence. Context before commitment.
          </h2>
          <p className={styles.lead}>
            Locality guidance grounded in verified physical geography, operational transit infrastructure, and architectural typology—distinguishing between established enclaves and planned developmental corridors.
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
                    <span className={styles.attrLabel}>TRANSIT &amp; CONNECTIVITY</span>
                    <span className={styles.attrVal}>{loc.connectivity}</span>
                  </div>
                  <div className={styles.attr}>
                    <span className={styles.attrLabel}>TYPICAL PROPERTY PROFILE</span>
                    <span className={styles.attrVal}>{loc.targetAssets}</span>
                  </div>
                </div>
              </div>

              <div className={styles.rowAction}>
                <span className={styles.sourceMeta}>{loc.sourceRef}</span>
                <Link
                  href={`/concept-1/intake?locality=${loc.id}`}
                  className={styles.inquireLink}
                >
                  <span>Consult on this micro-market →</span>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.footerNote}>
          <p>
            * Note on Urban Boundaries: Public infrastructure timelines (such as Namma Metro Phase 2B) reflect current BMRCL structural schedules. Unverified market speculation is excluded from our advisory datasets.
          </p>
        </div>
      </div>
    </section>
  );
}
