'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Concept2Matrix.module.css';

interface CorridorData {
  id: string;
  code: string;
  name: string;
  quadrant: string;
  transitInfrastructure: string;
  densityProfile: string;
  advisoryScope: string;
  dataRef: string;
}

const CORRIDORS: CorridorData[] = [
  {
    id: 'central-east',
    code: 'SEC-E01',
    name: 'Indiranagar & Old Airport Road',
    quadrant: 'EAST URBAN CORE',
    transitInfrastructure: 'Namma Metro Purple Line Operational (100% electrified)',
    densityProfile: 'Low-to-medium density mature plotted developments & boutique luxury floors',
    advisoryScope: 'Heritage redevelopment penthouses & private gated residences',
    dataRef: 'BBMP Ward 80 Cadastral & BDA Master Plan 2031',
  },
  {
    id: 'south-east-tech',
    code: 'SEC-SE02',
    name: 'Koramangala & HSR Sector Enclaves',
    quadrant: 'SOUTH-EAST TECH BELT',
    transitInfrastructure: 'Direct connectivity to ORR Expressway & Silk Board Interchange',
    densityProfile: 'High executive concentration, planned BDA grid layouts, low-rise residential',
    advisoryScope: 'Executive independent residences, founder villas & prime acquisitions',
    dataRef: 'BBMP South Engineering Records & BDA Layout Map',
  },
  {
    id: 'north-aerospace',
    code: 'SEC-N03',
    name: 'Hebbal, Bellary Road & Yelahanka',
    quadrant: 'NORTH STRATEGIC AXIS',
    transitInfrastructure: 'NH 44 Airport Expressway; BMRCL Blue Line Phase 2B under construction',
    densityProfile: 'Master-planned integrated luxury gated townships and golf estate residences',
    advisoryScope: 'Large-scale luxury acquisitions & strategic private holding',
    dataRef: 'BMRCL Phase 2B Alignment Schedule & BMRDA 2026',
  },
  {
    id: 'central-sanctuary',
    code: 'SEC-C04',
    name: 'Sadashivanagar & Palace Precinct',
    quadrant: 'NORTH-CENTRAL CORE',
    transitInfrastructure: 'Arterial access to Sankey Road, CV Raman Road & Windsor Square',
    densityProfile: 'Ultra-low density, institutional canopy, premier historical estate zone',
    advisoryScope: 'Legacy estate representation & bespoke architectural commissions',
    dataRef: 'BBMP West Heritage Atlas & Cadastral Registry',
  },
];

export function Concept2Matrix() {
  return (
    <section className={styles.section} id="corridors" aria-labelledby="c2-matrix-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.tag}>CORRIDOR INTELLIGENCE MATRIX</span>
            <span className={styles.gate}>PROTOTYPE CONTENT &mdash; NOT SOURCE-CHECKED</span>
          </div>
          <h2 id="c2-matrix-title" className={styles.heading}>
            BENGALURU CORRIDOR COVERAGE &amp; TRANSIT VECTORS.
          </h2>
          <p className={styles.lead}>
            High-granularity analysis of mature and developmental micro-markets. Prototype layout only; the statements shown have not passed the project claim gate and are not published.
          </p>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.matrixTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.thCode}>SECTOR</th>
                <th scope="col" className={styles.thName}>MICRO-MARKET</th>
                <th scope="col" className={styles.thTransit}>TRANSIT INFRASTRUCTURE</th>
                <th scope="col" className={styles.thDensity}>DENSITY &amp; PROFILE</th>
                <th scope="col" className={styles.thAction}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {CORRIDORS.map((c) => (
                <tr key={c.id} className={styles.tableRow}>
                  <td className={styles.tdCode}>
                    <span className={styles.codeBadge}>{c.code}</span>
                    <span className={styles.quadrantText}>{c.quadrant}</span>
                  </td>
                  <td className={styles.tdName}>
                    <strong className={styles.corridorName}>{c.name}</strong>
                    <span className={styles.dataRef}>{c.dataRef}</span>
                  </td>
                  <td className={styles.tdTransit}>
                    <span>{c.transitInfrastructure}</span>
                  </td>
                  <td className={styles.tdDensity}>
                    <span>{c.densityProfile}</span>
                  </td>
                  <td className={styles.tdAction}>
                    <Link
                      href={`/concept-2/intake?corridor=${c.id}`}
                      className={styles.targetLink}
                    >
                      ENGAGE SECTOR ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.captionNote}>
          <span className={styles.noteCode}>NOTE // </span>
          <span>
            Infrastructure project statuses distinguish between operational services (e.g. Purple Line) and planned works (e.g. Phase 2B). We do not market unconfirmed infrastructure timelines as completed transit.
          </span>
        </div>
      </div>
    </section>
  );
}
