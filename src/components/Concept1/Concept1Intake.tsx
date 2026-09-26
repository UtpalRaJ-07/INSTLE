'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './Concept1Intake.module.css';

interface IntakeFormData {
  assetType: string;
  localities: string[];
  budgetBand: string;
  horizon: string;
  name: string;
  phone: string;
  contactPreference: string;
  consent: boolean;
}

export function Concept1Intake() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<IntakeFormData>({
    assetType: 'Independent Villa / Bungalow',
    localities: ['Indiranagar / Old Airport Road'],
    budgetBand: '₹5 Cr – ₹10 Cr',
    horizon: '3 – 6 Months',
    name: '',
    phone: '',
    contactPreference: 'Phone Call',
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggleLocality = (loc: string) => {
    setFormData((prev) => {
      const exists = prev.localities.includes(loc);
      if (exists) {
        return { ...prev, localities: prev.localities.filter((item) => item !== loc) };
      }
      return { ...prev, localities: [...prev.localities, loc] };
    });
  };

  const validateStep4 = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) {
      errs.name = 'Please provide your full name.';
    }
    const cleanPhone = formData.phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.phone = 'Please provide a valid 10-digit telephone number.';
    }
    if (!formData.consent) {
      errs.consent = 'Consent under DPDP notice is required to initiate consultation.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 4) {
      if (!validateStep4()) return;
      setCurrentStep(5); // Review step
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep4()) {
      setCurrentStep(4);
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className={styles.intakeWrapper} aria-labelledby="intake-title">
      <div className={styles.container}>
        {/* Left Side: Architectural Atmosphere Card */}
        <div className={styles.sidebarColumn}>
          <div className={styles.sidebarFrame}>
            <Image
              src="/media/concept1-courtyard-detail.jpg"
              alt="Architectural study of a calm stone and teak courtyard in Bengaluru"
              width={800}
              height={600}
              className={styles.sidebarImage}
            />
            <div className={styles.sidebarPlate}>
              <span className={styles.plateTag}>CONCEPTUAL DOSSIER · BENGALURU</span>
              <p className={styles.plateQuote}>
                “Every acquisition begins with a quiet parameter definition—not an indiscriminate market broadcast.”
              </p>
            </div>
          </div>

          <div className={styles.directPhoneCard}>
            <span className={styles.phoneCardLabel}>Prefer direct conversation?</span>
            <p className={styles.phoneCardDesc}>
              Skip digital intake and discuss your mandate directly with our advisory desk.
            </p>
            <a href={PRIMARY_PHONE_TEL} className={styles.phoneCardLink}>
              ☎ {PRIMARY_PHONE}
            </a>
          </div>
        </div>

        {/* Right Side: The Stepped Dossier Form */}
        <div className={styles.formColumn}>
          <div className={styles.headerBlock}>
            <div className={styles.dossierMeta}>
              <span className={styles.dossierBadge}>ACQUISITION BRIEF</span>
              <span className={styles.stepCounter}>STEP {currentStep} OF 5</span>
            </div>
            <h1 id="intake-title" className={styles.formHeading}>
              Commission a Bengaluru Property Brief
            </h1>
            <p className={styles.formSub}>
              Share your property parameters. We evaluate off-market opportunities and coordinate accompanied reviews.
            </p>
          </div>

          {/* Progress Bar */}
          <div className={styles.progressTrack} role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={5}>
            <div className={styles.progressBar} style={{ width: `${(currentStep / 5) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmationBox} role="alert">
              <span className={styles.confirmBadge}>LOCAL PREVIEW RECEIPT</span>
              <h2 className={styles.confirmTitle}>Acquisition Brief Formatted Successfully</h2>
              <p className={styles.confirmDesc}>
                This is a local design demonstration of {CANONICAL_BRAND}’s stepped intake. In production, this record routes into an accountable lead queue with durable persistence.
              </p>
              <div className={styles.reviewSummary}>
                <p><strong>Client:</strong> {formData.name} ({formData.phone})</p>
                <p><strong>Asset:</strong> {formData.assetType}</p>
                <p><strong>Localities:</strong> {formData.localities.join(', ')}</p>
                <p><strong>Capital Range:</strong> {formData.budgetBand}</p>
                <p><strong>Horizon:</strong> {formData.horizon}</p>
              </div>
              <button
                type="button"
                className={styles.resetButton}
                onClick={() => {
                  setSubmitted(false);
                  setCurrentStep(1);
                }}
              >
                Reset Intake Preview
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* STEP 1: ASSET TYPOLOGY */}
              {currentStep === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. Select Property Classification</legend>
                  <p className={styles.stepPrompt}>What type of Bengaluru asset are you looking to acquire or lease?</p>
                  <div className={styles.optionsGrid}>
                    {[
                      'Independent Villa / Bungalow',
                      'Prime Penthouse / Luxury Apartment',
                      'Residential Plot / Land Parcel',
                      'Relocation / Open to Guidance',
                    ].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`${styles.selectCard} ${formData.assetType === type ? styles.selected : ''}`}
                        onClick={() => setFormData({ ...formData, assetType: type })}
                        aria-pressed={formData.assetType === type}
                      >
                        <span className={styles.cardRadio} aria-hidden="true">
                          {formData.assetType === type ? '●' : '○'}
                        </span>
                        <span className={styles.cardLabel}>{type}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* STEP 2: MICRO-MARKET GEOGRAPHY */}
              {currentStep === 2 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>02. Target Micro-Markets</legend>
                  <p className={styles.stepPrompt}>Select preferred areas or opt for advisory guidance.</p>
                  <div className={styles.optionsGrid}>
                    {[
                      'Indiranagar / Old Airport Road',
                      'Koramangala / HSR Layout',
                      'Sadashivanagar / Central Heritage',
                      'Hebbal / Bellary Road Corridor',
                      'Whitefield / Outer Ring Road',
                      'Open to Advisory Recommendation',
                    ].map((loc) => {
                      const isSel = formData.localities.includes(loc);
                      return (
                        <button
                          key={loc}
                          type="button"
                          className={`${styles.selectCard} ${isSel ? styles.selected : ''}`}
                          onClick={() => toggleLocality(loc)}
                          aria-pressed={isSel}
                        >
                          <span className={styles.cardRadio} aria-hidden="true">
                            {isSel ? '✓' : '+'}
                          </span>
                          <span className={styles.cardLabel}>{loc}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* STEP 3: CAPITAL & TIMELINE */}
              {currentStep === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. Investment Horizon &amp; Budget Band</legend>
                  
                  <div className={styles.subGroup}>
                    <label className={styles.fieldLabel}>Estimated Capital Deployment Band</label>
                    <div className={styles.pillGrid}>
                      {[
                        '₹2.5 Cr – ₹5 Cr',
                        '₹5 Cr – ₹10 Cr',
                        '₹10 Cr – ₹20 Cr',
                        '₹20 Cr+',
                        'Discuss in Consultation',
                      ].map((band) => (
                        <button
                          key={band}
                          type="button"
                          className={`${styles.pillBtn} ${formData.budgetBand === band ? styles.pillSelected : ''}`}
                          onClick={() => setFormData({ ...formData, budgetBand: band })}
                        >
                          {band}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.subGroup} style={{ marginTop: '24px' }}>
                    <label className={styles.fieldLabel}>Acquisition Timeline</label>
                    <div className={styles.pillGrid}>
                      {[
                        'Immediate (< 60 Days)',
                        '3 – 6 Months',
                        '6 – 12 Months',
                        'Long-term Horizon',
                      ].map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`${styles.pillBtn} ${formData.horizon === h ? styles.pillSelected : ''}`}
                          onClick={() => setFormData({ ...formData, horizon: h })}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 4: CONTACT & DPDP NOTICE */}
              {currentStep === 4 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>04. Consultation Contact Details</legend>
                  <p className={styles.stepPrompt}>How should our brokerage team reach you to review the brief?</p>

                  <div className={styles.inputGroup}>
                    <label htmlFor="c1-name" className={styles.inputLabel}>
                      Full Name <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="c1-name"
                      type="text"
                      className={`${styles.textInput} ${errors.name ? styles.inputError : ''}`}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Ramesh Basavaraj"
                      autoComplete="name"
                      required
                    />
                    {errors.name && <span className={styles.errorMsg} role="alert">{errors.name}</span>}
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="c1-phone" className={styles.inputLabel}>
                      Telephone Number <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="c1-phone"
                      type="tel"
                      className={`${styles.textInput} ${errors.phone ? styles.inputError : ''}`}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9845012345"
                      autoComplete="tel"
                      required
                    />
                    {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                  </div>

                  <div className={styles.consentGroup}>
                    <label className={styles.consentLabel}>
                      <input
                        type="checkbox"
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                        className={styles.checkbox}
                        required
                      />
                      <span>
                        I consent to {CANONICAL_BRAND} contacting me regarding this requirement in accordance with DPDP Act 2023 principles. No automated broadcasts or unrequested marketing.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errorMsg} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 5: REVIEW SUMMARY */}
              {currentStep === 5 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>05. Review &amp; Confirm Brief</legend>
                  <p className={styles.stepPrompt}>Please verify your parameters prior to transmitting to advisory queue.</p>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Asset Class</span>
                      <span className={styles.sumVal}>{formData.assetType}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Target Localities</span>
                      <span className={styles.sumVal}>{formData.localities.join(', ')}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Capital Allocation</span>
                      <span className={styles.sumVal}>{formData.budgetBand}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Timeline</span>
                      <span className={styles.sumVal}>{formData.horizon}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Client Contact</span>
                      <span className={styles.sumVal}>{formData.name} ({formData.phone})</span>
                    </div>
                  </div>

                  <p className={styles.submitNotice}>
                    Submitting will dispatch this brief to our senior brokerage team. You can also contact us immediately at {PRIMARY_PHONE}.
                  </p>
                </div>
              )}

              {/* Form Navigation Controls */}
              <div className={styles.navRow}>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={handleBack}
                  >
                    ← Back
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    type="button"
                    className={styles.nextBtn}
                    onClick={handleNext}
                  >
                    Next Stage →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.submitBtn}
                  >
                    Transmit Acquisition Brief →
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
