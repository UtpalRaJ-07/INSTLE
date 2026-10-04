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
    title: 'Tell us what you need',
    description:
      'Share your preferred property type, area, budget and timeline, or call 9353096264 to speak with our team.',
  },
  {
    number: '02',
    title: 'Discuss the details with our team',
    description:
      'Our brokerage team reviews your criteria, discusses what you are looking for, and clarifies your preferences.',
  },
  {
    number: '03',
    title: 'Talk about the next steps',
    description:
      'We coordinate property walkthroughs, share honest area facts, and guide you through paperwork and closing.',
  },
];

export const ProcessSteps: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="process-title">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Our Process</span>
        <h2 id="process-title" className={styles.title}>
          How We Help
        </h2>
        <p className={styles.subtitle}>
          A straightforward brokerage process to understand your requirement and discuss realistic next steps.
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
