'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './Concept2Intake.module.css';

interface ConsoleState {
  assetClass: string;
  corridors: string[];
  capitalBand: string;
  executionHorizon: string;
  clientName: string;
  clientPhone: string;
  dpdpConsent: boolean;
}

export function Concept2Intake() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [consoleData, setConsoleData] = useState<ConsoleState>({
    assetClass: 'Independent Luxury Villa',
    corridors: ['Indiranagar / East Urban Core'],
    capitalBand: '₹5.0 Cr – ₹10.0 Cr',
    executionHorizon: '30 – 90 Days',
    clientName: '',
    clientPhone: '',
    dpdpConsent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTransmitted, setIsTransmitted] = useState<boolean>(false);

  const toggleCorridor = (corridor: string) => {
    setConsoleData((prev) => {
      const exists = prev.corridors.includes(corridor);
      if (exists) {
        return { ...prev, corridors: prev.corridors.filter((c) => c !== corridor) };
      }
      return { ...prev, corridors: [...prev.corridors, corridor] };
    });
  };

  const validateContact = () => {
    const errs: Record<string, string> = {};
    if (!consoleData.clientName.trim()) {
      errs.name = 'Client name is required.';
    }
    const clean = consoleData.clientPhone.replace(/[^0-9+]/g, '');
    if (!clean || clean.length < 10) {
      errs.phone = 'Valid telephone contact required for human brokerage follow-up.';
    }
    if (!consoleData.dpdpConsent) {
      errs.consent = 'DPDP consent acknowledgment required.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 4) {
      if (!validateContact()) return;
      setActiveStep(5);
    } else {
      setActiveStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateContact()) {
      setActiveStep(4);
      return;
    }
    setIsTransmitted(true);
  };

  return (
    <div className={styles.wrapper} aria-labelledby="console-title">
      <div className={styles.container}>
        {/* Main Console Workspace */}
        <div className={styles.workspace}>
          <div className={styles.header}>
            <div className={styles.headerMeta}>
              <span className={styles.consoleTag}>ADVISORY CONSOLE // REQ-CAPTURE</span>
              <span className={styles.stepTag}>PHASE 0{activeStep} / 05</span>
            </div>
            <h1 id="console-title" className={styles.heading}>
              Acquisition &amp; Tenancy Intake Console
            </h1>
            <p className={styles.subtext}>
              Configure your spatial and financial parameters. Our human advisory team structures off-market opportunities and initiates direct title verification.
            </p>
          </div>

          {/* Stepper Navigation */}
          <div className={styles.stepper} role="tablist">
            {[
              { num: 1, label: 'Asset Matrix' },
              { num: 2, label: 'Corridors' },
              { num: 3, label: 'Capital' },
              { num: 4, label: 'Contact' },
              { num: 5, label: 'Review' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                role="tab"
                aria-selected={activeStep === s.num}
                className={`${styles.stepBtn} ${activeStep === s.num ? styles.stepBtnActive : ''} ${activeStep > s.num ? styles.stepBtnComplete : ''}`}
                onClick={() => {
                  if (s.num <= activeStep || (activeStep === 4 && validateContact())) {
                    setActiveStep(s.num);
                  }
                }}
              >
                <span className={styles.stepIndex}>0{s.num}</span>
                <span className={styles.stepLabel}>{s.label}</span>
              </button>
            ))}
          </div>

          {isTransmitted ? (
            <div className={styles.successPanel} role="alert">
              <div className={styles.successMeta}>
                <span className={styles.livePulse} aria-hidden="true" />
                <span>LOCAL CONSOLE SIMULATION COMPLETE</span>
              </div>
              <h2 className={styles.successTitle}>Requirement Profile Registered</h2>
              <p className={styles.successDesc}>
                Demonstration confirmation for {CANONICAL_BRAND}. In production, this payload is securely enqueued to the assigned brokerage queue with persistent idempotency and audit logs.
              </p>
              <div className={styles.profileDump}>
                <p><strong>Client:</strong> {consoleData.clientName} ({consoleData.clientPhone})</p>
                <p><strong>Asset:</strong> {consoleData.assetClass}</p>
                <p><strong>Target Corridors:</strong> {consoleData.corridors.join(', ')}</p>
                <p><strong>Capital Band:</strong> {consoleData.capitalBand}</p>
                <p><strong>Timeline:</strong> {consoleData.executionHorizon}</p>
              </div>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setIsTransmitted(false);
                  setActiveStep(1);
                }}
              >
                Restart Console Session
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* STEP 1: PROPERTY MATRIX */}
              {activeStep === 1 && (
                <fieldset className={styles.fieldBlock}>
                  <legend className={styles.legend}>01 // ASSET CLASSIFICATION</legend>
                  <p className={styles.fieldPrompt}>Select the target property typology for this acquisition brief:</p>
                  <div className={styles.buttonMatrix}>
                    {[
                      { title: 'Independent Luxury Villa', desc: 'Bespoke residences & private gated enclaves' },
                      { title: 'Prime Penthouse / Apartment', desc: 'High-specification high-rise residential floors' },
                      { title: 'Residential Land / Plot', desc: 'Clear-title parcels in master-planned layouts' },
                      { title: 'Open to Advisory Guidance', desc: 'Consult on optimal asset class for capital goal' },
                    ].map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        className={`${styles.matrixCard} ${consoleData.assetClass === item.title ? styles.matrixActive : ''}`}
                        onClick={() => setConsoleData({ ...consoleData, assetClass: item.title })}
                        aria-pressed={consoleData.assetClass === item.title}
                      >
                        <div className={styles.matrixCardTop}>
                          <span className={styles.matrixIndicator}>{consoleData.assetClass === item.title ? '●' : '○'}</span>
                          <strong className={styles.matrixTitle}>{item.title}</strong>
                        </div>
                        <span className={styles.matrixDesc}>{item.desc}</span>
                      </button>
                    ))}

                    {/* Conditional Commercial Tile (Disabled per Blueprint D-14) */}
                    <div className={styles.disabledTile}>
                      <div className={styles.matrixCardTop}>
                        <span className={styles.matrixIndicator}>✕</span>
                        <strong className={styles.matrixTitle}>Commercial Real Estate</strong>
                      </div>
                      <span className={styles.matrixDesc}>
                        Commercial advisory held conditional per blueprint D-14 pending dedicated staff capability.
                      </span>
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 2: CORRIDOR TARGETING */}
              {activeStep === 2 && (
                <fieldset className={styles.fieldBlock}>
                  <legend className={styles.legend}>02 // CORRIDOR &amp; GEOGRAPHY TARGETING</legend>
                  <p className={styles.fieldPrompt}>Select target urban corridors across the Bengaluru metropolitan region:</p>
                  <div className={styles.chipGrid}>
                    {[
                      { name: 'Indiranagar / East Urban Core', tag: 'PURPLE LINE METRO' },
                      { name: 'Koramangala / South-East Belt', tag: 'OUTER RING ROAD' },
                      { name: 'Sadashivanagar / Central Heritage', tag: 'ESTABLISHED SANCTUARY' },
                      { name: 'Hebbal / Bellary Road Corridor', tag: 'AIRPORT TRANSIT AXIS' },
                      { name: 'Whitefield / East Enterprise Belt', tag: 'METRO CONNECTED' },
                      { name: 'Open to Geographic Recommendation', tag: 'BROKERAGE GUIDANCE' },
                    ].map((cor) => {
                      const isSel = consoleData.corridors.includes(cor.name);
                      return (
                        <button
                          key={cor.name}
                          type="button"
                          className={`${styles.chipBtn} ${isSel ? styles.chipActive : ''}`}
                          onClick={() => toggleCorridor(cor.name)}
                          aria-pressed={isSel}
                        >
                          <span className={styles.chipName}>{cor.name}</span>
                          <span className={styles.chipTag}>{cor.tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* STEP 3: CAPITAL & TIMELINE */}
              {activeStep === 3 && (
                <fieldset className={styles.fieldBlock}>
                  <legend className={styles.legend}>03 // CAPITAL ALLOCATION &amp; HORIZON</legend>
                  
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>CAPITAL DEPLOYMENT RANGE</label>
                    <div className={styles.bracketGrid}>
                      {[
                        '₹2.5 Cr – ₹5.0 Cr',
                        '₹5.0 Cr – ₹10.0 Cr',
                        '₹10.0 Cr – ₹20.0 Cr',
                        '₹20.0 Cr+',
                        'Flexible / In Consultation',
                      ].map((band) => (
                        <button
                          key={band}
                          type="button"
                          className={`${styles.bracketBtn} ${consoleData.capitalBand === band ? styles.bracketActive : ''}`}
                          onClick={() => setConsoleData({ ...consoleData, capitalBand: band })}
                        >
                          {band}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.paramGroup} style={{ marginTop: '28px' }}>
                    <label className={styles.paramLabel}>TARGET EXECUTION HORIZON</label>
                    <div className={styles.bracketGrid}>
                      {[
                        'Immediate (< 30 Days)',
                        '30 – 90 Days',
                        '90 – 180 Days',
                        'Strategic Exploration',
                      ].map((hor) => (
                        <button
                          key={hor}
                          type="button"
                          className={`${styles.bracketBtn} ${consoleData.executionHorizon === hor ? styles.bracketActive : ''}`}
                          onClick={() => setConsoleData({ ...consoleData, executionHorizon: hor })}
                        >
                          {hor}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 4: VERIFICATION & CONTACT */}
              {activeStep === 4 && (
                <fieldset className={styles.fieldBlock}>
                  <legend className={styles.legend}>04 // CLIENT IDENTIFICATION &amp; TELEPHONE</legend>
                  <p className={styles.fieldPrompt}>
                    Enquiries route directly to an accountable broker. We do not transmit details to third-party telemarketers.
                  </p>

                  <div className={styles.formRow}>
                    <div className={styles.fieldWrap}>
                      <label htmlFor="c2-client-name" className={styles.fieldLabel}>
                        FULL LEGAL NAME / REPRESENTATIVE *
                      </label>
                      <input
                        id="c2-client-name"
                        type="text"
                        className={`${styles.textInput} ${errors.name ? styles.inputInvalid : ''}`}
                        value={consoleData.clientName}
                        onChange={(e) => setConsoleData({ ...consoleData, clientName: e.target.value })}
                        placeholder="e.g. Anand Basavaraj"
                        required
                      />
                      {errors.name && <span className={styles.errText} role="alert">{errors.name}</span>}
                    </div>

                    <div className={styles.fieldWrap}>
                      <label htmlFor="c2-client-phone" className={styles.fieldLabel}>
                        CONTACT TELEPHONE NUMBER *
                      </label>
                      <input
                        id="c2-client-phone"
                        type="tel"
                        className={`${styles.textInput} ${errors.phone ? styles.inputInvalid : ''}`}
                        value={consoleData.clientPhone}
                        onChange={(e) => setConsoleData({ ...consoleData, clientPhone: e.target.value })}
                        placeholder="e.g. +91 9845012345"
                        required
                      />
                      {errors.phone && <span className={styles.errText} role="alert">{errors.phone}</span>}
                    </div>
                  </div>

                  <div className={styles.consentWrap}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={consoleData.dpdpConsent}
                        onChange={(e) => setConsoleData({ ...consoleData, dpdpConsent: e.target.checked })}
                        className={styles.checkInput}
                        required
                      />
                      <span>
                        I consent to {CANONICAL_BRAND} contacting me via voice call or private message regarding this requirement per India DPDP Act 2023. Zero PII transmission to advertising networks.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errText} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 5: REVIEW CONSOLE */}
              {activeStep === 5 && (
                <div className={styles.fieldBlock}>
                  <legend className={styles.legend}>05 // AUDIT &amp; DISPATCH SUMMARY</legend>
                  <p className={styles.fieldPrompt}>
                    Verify the parameter profile before transmitting to the brokerage assignment queue.
                  </p>

                  <div className={styles.auditCard}>
                    <div className={styles.auditRow}>
                      <span className={styles.auditKey}>ASSET TYPOLOGY:</span>
                      <span className={styles.auditVal}>{consoleData.assetClass}</span>
                    </div>
                    <div className={styles.auditRow}>
                      <span className={styles.auditKey}>TARGET CORRIDORS:</span>
                      <span className={styles.auditVal}>{consoleData.corridors.join(', ')}</span>
                    </div>
                    <div className={styles.auditRow}>
                      <span className={styles.auditKey}>CAPITAL ALLOCATION:</span>
                      <span className={styles.auditVal}>{consoleData.capitalBand}</span>
                    </div>
                    <div className={styles.auditRow}>
                      <span className={styles.auditKey}>HORIZON:</span>
                      <span className={styles.auditVal}>{consoleData.executionHorizon}</span>
                    </div>
                    <div className={styles.auditRow}>
                      <span className={styles.auditKey}>CLIENT CONTACT:</span>
                      <span className={styles.auditVal}>{consoleData.clientName} ({consoleData.clientPhone})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Console Action Bar */}
              <div className={styles.actionBar}>
                {activeStep > 1 && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleBack}
                  >
                    ← PREVIOUS PHASE
                  </button>
                )}

                {activeStep < 5 ? (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleNext}
                  >
                    ADVANCE TO PHASE 0{activeStep + 1} →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.btnSubmit}
                  >
                    DISPATCH MANDATE TO ADVISORY DESK ↗
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Real-time Dynamic Parameter Sidebar */}
        <aside className={styles.sidebar} aria-label="Current Advisory Profile">
          <div className={styles.profilePanel}>
            <div className={styles.panelHeader}>
              <span className={styles.profileTag}>LIVE PARAMETER PROFILE</span>
              <span className={styles.profileLive} aria-hidden="true" />
            </div>

            <div className={styles.profileSpecs}>
              <div className={styles.specRow}>
                <span className={styles.specKey}>ASSET:</span>
                <span className={styles.specValue}>{consoleData.assetClass}</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>CORRIDORS:</span>
                <span className={styles.specValue}>{consoleData.corridors.length} SELECTED</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>CAPITAL:</span>
                <span className={styles.specValue}>{consoleData.capitalBand}</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specKey}>TIMELINE:</span>
                <span className={styles.specValue}>{consoleData.executionHorizon}</span>
              </div>
            </div>

            <div className={styles.mediaEmbed}>
              <Image
                src="/media/concept2-gallery-console.jpg"
                alt="Minimalist architectural consultation gallery in Bengaluru"
                width={600}
                height={450}
                className={styles.embedImg}
              />
              <span className={styles.embedCaption}>CONSULTATION ARCHITECTURE · BENGALURU</span>
            </div>

            <div className={styles.hotlineBox}>
              <span className={styles.hotlineLabel}>PREFER IMMEDIATE TELEPHONE DIALOGUE?</span>
              <a href={PRIMARY_PHONE_TEL} className={styles.hotlineLink}>
                ☎ {PRIMARY_PHONE}
              </a>
              <span className={styles.hotlineSub}>Direct voice connection with senior brokerage team</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
