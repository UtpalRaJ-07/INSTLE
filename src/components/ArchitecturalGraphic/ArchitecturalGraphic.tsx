import React from 'react';
import styles from './ArchitecturalGraphic.module.css';

export interface ArchitecturalGraphicProps {
  className?: string;
}

/**
 * ArchitecturalGraphic: An intentional visual composition serving as an architectural
 * image fallback per blueprint specifications (lines 157, 220).
 * Avoids unverified photography while providing a distinct, premium editorial texture.
 */
export const ArchitecturalGraphic: React.FC<ArchitecturalGraphicProps> = ({ className = '' }) => {
  return (
    <div className={`${styles.graphicContainer} ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 540 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
      >
        {/* Background Paper Tone */}
        <rect width="540" height="400" fill="var(--color-background-elevated)" />

        {/* Architectural Structural Grid */}
        <g stroke="var(--color-stone)" strokeWidth="1" strokeOpacity="0.6">
          <line x1="40" y1="40" x2="500" y2="40" />
          <line x1="40" y1="120" x2="500" y2="120" />
          <line x1="40" y1="200" x2="500" y2="200" />
          <line x1="40" y1="280" x2="500" y2="280" />
          <line x1="40" y1="360" x2="500" y2="360" />

          <line x1="120" y1="40" x2="120" y2="360" />
          <line x1="220" y1="40" x2="220" y2="360" />
          <line x1="320" y1="40" x2="320" y2="360" />
          <line x1="420" y1="40" x2="420" y2="360" />
        </g>

        {/* Abstract Architectural Forms (Human scale, mid-rise geometry) */}
        <rect
          x="80"
          y="160"
          width="120"
          height="200"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <rect
          x="220"
          y="100"
          width="140"
          height="260"
          fill="var(--color-forest)"
          fillOpacity="0.9"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
        <rect
          x="380"
          y="180"
          width="100"
          height="180"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />

        {/* Architectural Fenestration & Rhythms */}
        <g fill="var(--color-paper)" fillOpacity="0.8">
          <rect x="240" y="130" width="24" height="36" />
          <rect x="280" y="130" width="24" height="36" />
          <rect x="320" y="130" width="24" height="36" />

          <rect x="240" y="180" width="24" height="36" />
          <rect x="280" y="180" width="24" height="36" />
          <rect x="320" y="180" width="24" height="36" />

          <rect x="240" y="230" width="24" height="36" />
          <rect x="280" y="230" width="24" height="36" />
          <rect x="320" y="230" width="24" height="36" />
        </g>

        {/* Accent Vermilion Detail Line */}
        <line
          x1="60"
          y1="360"
          x2="480"
          y2="360"
          stroke="var(--color-accent)"
          strokeWidth="3"
        />

        {/* Architectural Elevation Label */}
        <text
          x="44"
          y="384"
          fontFamily="var(--font-sans)"
          fontSize="9"
          letterSpacing="0.2em"
          fill="var(--color-text-muted)"
          style={{ textTransform: 'uppercase' }}
        >
          INSTLE REAL ESTATE — BENGALURU URBAN STUDY
        </text>
      </svg>
    </div>
  );
};
