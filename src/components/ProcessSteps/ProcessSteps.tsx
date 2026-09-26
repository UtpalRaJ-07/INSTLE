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
    title: 'Telephone Consultation',
    description:
      'Call our team at 9353096264 to discuss your property parameters, preferred localities, and timeline.',
  },
  {
    number: '02',
    title: 'Clarify Priorities',
    description:
      'Discuss your priorities, local trade-offs, and requirement details directly with the brokerage team.',
  },
  {
    number: '03',
    title: 'Discuss Relevant Next Steps',
    description:
      'Review suitable pathways and discuss realistic next steps directly with the brokerage team.',
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
          A human-led brokerage process focused on understanding your requirement and discussing
          relevant next steps.
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
    </section>
  );
};
