'use client';

import React from 'react';
import styles from './Concept1Methodology.module.css';

const STAGES = [
  {
    num: '01',
    title: 'Tell us what you need',
    desc: 'Share what kind of flat, house, villa or plot you are looking for, or details of the property you want to sell or rent out.',
  },
  {
    num: '02',
    title: 'Discuss the details with our team',
    desc: 'Our brokerage team discusses your budget, preferred area and timeline with you directly. You can also call us at 9353096264.',
  },
  {
    num: '03',
    title: 'Talk about the next steps',
    desc: 'We assist you with suitable options, property visits, transparent discussions with owners, and paperwork guidance.',
  },
];

export function Concept1Methodology() {
  return (
    <section className={styles.section} id="methodology" aria-labelledby="c1-methodology-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.kicker}>OUR PROCESS</span>
          <h2 id="c1-methodology-title" className={styles.title}>
            How we help
          </h2>
          <p className={styles.lead}>
            A straightforward process to help you find, sell or rent property in Bengaluru without confusion.
          </p>
        </div>

        <div className={styles.stageGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
