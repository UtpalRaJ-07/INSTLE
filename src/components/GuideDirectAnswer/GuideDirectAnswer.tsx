import React from 'react';
import styles from './GuideDirectAnswer.module.css';

/**
 * A published guide's direct answer. Requirements 5.3 and 5.11.
 *
 * The guide page places this as the first child of its `PageIntro`, which renders
 * it immediately after the `<h1>` and before the action row and every section, so
 * the answer is the first text block after the `<h1>` and precedes the first
 * section heading. Word count is the gate's concern (`evaluateGuide` holds it to
 * 20 to 60 words); position is this component's.
 *
 * `data-direct-answer` is inert. Nothing styles it (the class does that) and no
 * script reads it; it exists so a test can find the block in the rendered markup
 * by what it is rather than by a class name that changes with the stylesheet.
 *
 * Ordinary paragraph text: not hidden, not a live region, no role override. A
 * server component with no client JavaScript.
 */
export function GuideDirectAnswer({ text }: { text: string }) {
  return (
    <p className={styles.directAnswer} data-direct-answer="">
      {text}
    </p>
  );
}
