'use client';

import React from 'react';
import styles from './Concept2Methodology.module.css';

const PIPELINE_STEPS = [
  {
    step: '01',
    phase: 'PARAMETER INGESTION',
    title: 'Precision Requirement Definition',
    details: 'Structured capture of physical, acoustic, legal, and capital constraints. We identify non-negotiable criteria to avoid speculative viewings.',
  },
  {
    step: '02',
    phase: 'FIELD SOURCING',
    title: 'Discreet Sourcing Protocol',
    details: 'Targeted outreach through proprietary owner channels and private legal registers. Elimination of multi-broker encumbered inventory.',
  },
  {
    step: '03',
    phase: 'DUE DILIGENCE',
    title: 'Technical & Physical Audit',
    details: 'On-site technical inspection, verification of municipal sanctions, layout approvals, and title flow coordination with legal advisors.',
  },
  {
    step: '04',
    phase: 'CLOSING EXECUTION',
    title: 'Fiduciary Settlement',
    details: 'Contract structuring, counterparty negotiation, and seamless transaction settlement with absolute confidentiality.',
  },
];

export function Concept2Methodology() {
  return (
    <section className={styles.section} id="methodology" aria-labelledby="c2-methodology-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.kicker}>OPERATIONAL PROTOCOL</span>
          <h2 id="c2-methodology-title" className={styles.title}>
            THE FOUR-STAGE BROKERAGE PIPELINE.
          </h2>
          <p className={styles.lead}>
            An advisory model that replaces unfocused site visits with a structured discussion first.
          </p>
        </div>

        <div className={styles.pipeline}>
          {PIPELINE_STEPS.map((p) => (
            <div key={p.step} className={styles.stepCard}>
              <div className={styles.stepTop}>
                <span className={styles.stepNum}>{p.step}</span>
                <span className={styles.phaseLabel}>{p.phase}</span>
              </div>
              <h3 className={styles.stepTitle}>{p.title}</h3>
              <p className={styles.stepDetails}>{p.details}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
