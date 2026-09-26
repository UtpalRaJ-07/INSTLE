'use client';

import React from 'react';
import styles from './Concept1Methodology.module.css';

const STAGES = [
  {
    num: '01',
    title: 'Requirement Intake & Boundary Analysis',
    desc: 'We conduct a structured dialogue to understand specific asset typologies, geographical trade-offs, spatial priorities, and capital constraints before undertaking market work.',
  },
  {
    num: '02',
    title: 'Discreet Sourcing & Preliminary Diligence',
    desc: 'Our team queries private owner networks, off-market channels, and institutional mandates. We filter out conflicting titles and encumbered properties prior to presentation.',
  },
  {
    num: '03',
    title: 'Accompanied Private Inspections',
    desc: 'Targeted on-site property walkthroughs with your dedicated advisory partner. We evaluate micro-neighborhood acoustic levels, solar orientation, and structural build quality.',
  },
  {
    num: '04',
    title: 'Transaction Stewardship & Settlement',
    desc: 'From counter-party negotiation through documentation coordination with your legal counsel, we ensure a transparent, orderly closing process.',
  },
];

export function Concept1Methodology() {
  return (
    <section className={styles.section} id="methodology" aria-labelledby="c1-methodology-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.kicker}>OPERATING METHODOLOGY</span>
          <h2 id="c1-methodology-title" className={styles.title}>
            The Four-Stage Advisory Framework
          </h2>
          <p className={styles.lead}>
            A structured human brokerage lifecycle engineered for accountability, transparency, and minimal noise.
          </p>
        </div>

        <div className={styles.stageGrid}>
          {STAGES.map((stage) => (
            <div key={stage.num} className={styles.stageCard}>
              <div className={styles.stageNum}>{stage.num}</div>
              <h3 className={styles.stageTitle}>{stage.title}</h3>
              <p className={styles.stageDesc}>{stage.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
