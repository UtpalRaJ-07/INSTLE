'use client';

import React from 'react';
import styles from './Concept1Methodology.module.css';

const STAGES = [
  {
    num: '01',
    title: 'Requirement Intake & Parameter Definition',
    desc: 'We conduct a structured dialogue to understand specific asset typologies, geographical preferences, spatial priorities, and budget guidelines before undertaking market research.',
  },
  {
    num: '02',
    title: 'Direct Sourcing & Preliminary Review',
    desc: 'Our team evaluates direct owner representations and matching opportunities, cross-referencing published municipal zoning and preliminary property parameters prior to presentation.',
  },
  {
    num: '03',
    title: 'Accompanied Property Walkthroughs',
    desc: 'Coordinated on-site visits with a brokerage team member, evaluating neighborhood access, daylight, layout suitability, and immediate residential surroundings.',
  },
  {
    num: '04',
    title: 'Transaction Guidance & Settlement',
    desc: 'From negotiation through documentation coordination with your appointed legal counsel, we facilitate an orderly, transparent transaction closing.',
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
