import React from 'react';
import styles from './ProcessSteps.module.css';

interface Step {
  number: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'State Your Requirement',
    description:
      'Describe your property parameters, timeline, and preferred corridors through our requirement pathways or directly by telephone.',
  },
  {
    number: '02',
    title: 'Direct Consultation',
    description:
      'Speak directly with our brokerage team to clarify priorities, discuss local trade-offs, and align on realistic search criteria.',
  },
  {
    number: '03',
    title: 'Coordinated Next Steps',
    description:
      'Receive considered guidance, verified options, and viewing coordination handled directly by accountable brokers.',
  },
];

export const ProcessSteps: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="process-title">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Advisory Process</span>
        <h2 id="process-title" className={styles.title}>
          How the Advisory Model Operates
        </h2>
        <p className={styles.subtitle}>
          A transparent, human-led workflow designed to navigate Bengaluru real estate without
          unverified catalogues or automated pressure.
        </p>
      </div>

      <div className={styles.grid}>
        {STEPS.map((step) => (
          <div key={step.number} className={styles.stepCard}>
            <span className={styles.stepNumber} aria-hidden="true">
              {step.number}
            </span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDescription}>{step.description}</p>
          </div>
        ))}
      </div>

      <div className={styles.limitNotice}>
        <p>
          <strong>Process Boundary:</strong> INSTLE REAL ESTATE provides curated advisory and
          brokerage coordination. We do not publish speculative listings or promise immediate
          transaction outcomes.
        </p>
      </div>
    </section>
  );
};
