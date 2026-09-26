'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
    assetType: '',
    localities: [],
    budgetBand: '',
    horizon: '',
    name: '',
    phone: '',
    contactPreference: 'Phone Call',
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [referenceId, setReferenceId] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

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
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = 'Please provide your full name (minimum 2 characters).';
    }
    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    const isIndian10Digit = /^[6-9]\d{9}$/.test(cleanPhone);
    const isStandardValid = cleanPhone.length >= 10 && cleanPhone.length <= 15;

    if (!cleanPhone || (!isIndian10Digit && !isStandardValid)) {
      errs.phone = 'Please provide a valid 10-digit telephone number.';
    }
    if (formData.consent !== true) {
      errs.consent = 'Consent under DPDP privacy principles is required to process your requirement.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.assetType) {
      setErrors({ assetType: 'Please select an asset typology or choose "Open to Guidance".' });
      return;
    }
    if (currentStep === 4) {
      if (!validateStep4()) return;
      setCurrentStep(5); // Review step
    } else {
      setErrors({});
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep4()) {
      setCurrentStep(4);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'buy',
          assetType: formData.assetType || 'Open to Guidance',
          localities: formData.localities.length > 0 ? formData.localities : ['Open to Guidance'],
          budgetBand: formData.budgetBand || 'Open to Discussion',
          timeline: formData.horizon || 'Flexible',
          name: formData.name.trim(),
          phone: cleanPhone,
          contactPreference: formData.contactPreference,
          consent: formData.consent === true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit enquiry.');
      }

      setReferenceId(data.leadId);
      setSubmitted(true);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the intake queue. Please call our desk directly at 9353096264.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.intakeWrapper} aria-labelledby="intake-title">
      <div className={styles.container}>
        {/* Left Side: Architectural Atmosphere Card */}
        <div className={styles.sidebarColumn}>
          <div className={styles.sidebarFrame}>
            <Image
              src="/media/concept1-courtyard-detail.jpg"
              alt="Conceptual architectural rendering: courtyard study exploring natural light and stone elements. Non-inventory design illustration."
              width={800}
              height={600}
              className={styles.sidebarImage}
            />
            <div className={styles.sidebarPlate}>
              <span className={styles.plateTag}>CONCEPTUAL STUDY · NON-INVENTORY</span>
              <p className={styles.plateQuote}>
                “Every acquisition begins with a quiet parameter definition—not an indiscriminate market broadcast.”
              </p>
            </div>
          </div>

          <div className={styles.directPhoneCard}>
            <span className={styles.phoneCardLabel}>Prefer direct conversation?</span>
            <p className={styles.phoneCardDesc}>
              Skip digital intake and discuss your mandate directly with our brokerage desk.
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
              <span className={styles.dossierBadge}>BUYER INTAKE</span>
              <span className={styles.stepCounter}>STEP {currentStep} OF 5</span>
            </div>
            <h1 id="intake-title" className={styles.formHeading}>
              Share Your Purchase Requirement
            </h1>
            <p className={styles.formSub}>
              Share your spatial and capital parameters. Our team evaluates off-market opportunities directly.
            </p>
          </div>

          {/* Progress Bar */}
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label="Form progress"
          >
            <div className={styles.progressBar} style={{ width: `${(currentStep / 5) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmationBox} role="alert">
              <span className={styles.confirmBadge}>INTAKE ACKNOWLEDGED</span>
              <h2 className={styles.confirmTitle}>Requirement Registered Successfully</h2>
              <p className={styles.confirmDesc}>
                Your purchase parameters have been logged in our advisory intake queue.
              </p>
              <div className={styles.referenceBlock}>
                <span className={styles.refLabel}>Advisory Reference Number:</span>
                <strong className={styles.refValue}>{referenceId}</strong>
              </div>
              <div className={styles.reviewSummary}>
                <p><strong>Client:</strong> {formData.name} ({formData.phone})</p>
                <p><strong>Typology:</strong> {formData.assetType || 'Open to Guidance'}</p>
                <p><strong>Target Localities:</strong> {formData.localities.length ? formData.localities.join(', ') : 'Open to Guidance'}</p>
                <p><strong>Capital Band:</strong> {formData.budgetBand || 'Open to Discussion'}</p>
                <p><strong>Timeline:</strong> {formData.horizon || 'Flexible'}</p>
              </div>
              <p className={styles.followupNote}>
                Our team reviews submissions directly. For immediate priority consultation, call our desk directly at <a href={PRIMARY_PHONE_TEL} className={styles.inlinePhone}>{PRIMARY_PHONE}</a>.
              </p>
              <button
                type="button"
                className={styles.resetButton}
                onClick={() => {
                  setSubmitted(false);
                  setCurrentStep(1);
                  setFormData({
                    assetType: '',
                    localities: [],
                    budgetBand: '',
                    horizon: '',
                    name: '',
                    phone: '',
                    contactPreference: 'Phone Call',
                    consent: false,
                  });
                }}
              >
                Submit Another Requirement
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {apiError && (
                <div className={styles.apiErrorBox} role="alert">
                  <span>{apiError}</span>
                  <a href={PRIMARY_PHONE_TEL} className={styles.errorPhoneBtn}>
                    ☎ Call {PRIMARY_PHONE}
                  </a>
                </div>
              )}

              {/* STEP 1: ASSET TYPOLOGY */}
              {currentStep === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. Select Property Typology</legend>
                  <p className={styles.stepPrompt}>What type of Bengaluru property are you looking to acquire?</p>
                  {errors.assetType && <span className={styles.errorMsg} role="alert">{errors.assetType}</span>}
                  <div className={styles.optionsGrid}>
                    {[
                      'Independent House / Villa',
                      'Gated Community Villa',
                      'Prime Penthouse / Duplex',
                      'Luxury Apartment',
                      'Residential Plot / Land Parcel',
                      'Open to Guidance / Exploring',
                    ].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`${styles.optionCard} ${formData.assetType === type ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, assetType: type });
                          setErrors({});
                        }}
                      >
                        <span className={styles.optionRadio}>{formData.assetType === type ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{type}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* STEP 2: MICRO-MARKETS */}
              {currentStep === 2 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>02. Prime Bengaluru Micro-Markets</legend>
                  <p className={styles.stepPrompt}>Select preferred areas (multiple selections supported, or leave open):</p>
                  <div className={styles.optionsGrid}>
                    {[
                      'Indiranagar / Old Airport Road',
                      'Koramangala & Surrounding Blocks',
                      'Sadashivanagar / Palace Orchards',
                      'North Bengaluru / Hebbal Corridor',
                      'Whitefield / East Bengaluru',
                      'Open to Recommendations',
                    ].map((loc) => {
                      const isSelected = formData.localities.includes(loc);
                      return (
                        <button
                          key={loc}
                          type="button"
                          className={`${styles.optionCard} ${isSelected ? styles.selectedOption : ''}`}
                          onClick={() => toggleLocality(loc)}
                        >
                          <span className={styles.optionRadio}>{isSelected ? '☑' : '☐'}</span>
                          <span className={styles.optionLabel}>{loc}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* STEP 3: CAPITAL ALLOCATION */}
              {currentStep === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. Indicative Capital Allocation</legend>
                  <p className={styles.stepPrompt}>Select an estimated budget range (optional / guidance available):</p>
                  <div className={styles.optionsGrid}>
                    {[
                      'Under ₹2.5 Crore',
                      '₹2.5 Crore – ₹5 Crore',
                      '₹5 Crore – ₹10 Crore',
                      '₹10 Crore – ₹20 Crore',
                      '₹20 Crore+',
                      'Open to Discussion / Guidance Needed',
                    ].map((band) => (
                      <button
                        key={band}
                        type="button"
                        className={`${styles.optionCard} ${formData.budgetBand === band ? styles.selectedOption : ''}`}
                        onClick={() => setFormData({ ...formData, budgetBand: band })}
                      >
                        <span className={styles.optionRadio}>{formData.budgetBand === band ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{band}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* STEP 4: TIMELINE & CONTACT DETAILS */}
              {currentStep === 4 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>04. Timeline &amp; Contact Information</legend>
                  <p className={styles.stepPrompt}>How should our brokerage team reach you to discuss matching opportunities?</p>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="c1-horizon" className={styles.label}>
                      Acquisition Timeline
                    </label>
                    <select
                      id="c1-horizon"
                      className={styles.select}
                      value={formData.horizon}
                      onChange={(e) => setFormData({ ...formData, horizon: e.target.value })}
                    >
                      <option value="">Select timeframe (or leave flexible)</option>
                      <option value="Immediate (0–30 days)">Immediate (0–30 days)</option>
                      <option value="1–3 Months">1–3 Months</option>
                      <option value="3–6 Months">3–6 Months</option>
                      <option value="Flexible / Exploring">Flexible / Exploring</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="c1-name" className={styles.label}>
                      Full Name *
                    </label>
                    <input
                      id="c1-name"
                      type="text"
                      className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                      placeholder="e.g. Vikram Malhotra"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    {errors.name && <span className={styles.errorMsg} role="alert">{errors.name}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="c1-phone" className={styles.label}>
                      Telephone Number *
                    </label>
                    <input
                      id="c1-phone"
                      type="tel"
                      className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                      placeholder="e.g. 9845012345"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                    {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                    <span className={styles.fieldHelp}>Used solely for direct advisory follow-up. Zero telemarketing or lead resale.</span>
                  </div>

                  <div className={styles.consentGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                      />
                      <span>
                        I consent to {CANONICAL_BRAND} storing and processing these details under Indian privacy principles solely for advisory communication.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errorMsg} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 5: REVIEW SUMMARY */}
              {currentStep === 5 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>05. Review &amp; Register Brief</legend>
                  <p className={styles.stepPrompt}>Please verify your parameters prior to transmitting to our intake queue.</p>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Typology</span>
                      <span className={styles.sumVal}>{formData.assetType || 'Open to Guidance'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Target Localities</span>
                      <span className={styles.sumVal}>
                        {formData.localities.length ? formData.localities.join(', ') : 'Open to Guidance'}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Capital Band</span>
                      <span className={styles.sumVal}>{formData.budgetBand || 'Open to Discussion'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Timeline</span>
                      <span className={styles.sumVal}>{formData.horizon || 'Flexible'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Client Contact</span>
                      <span className={styles.sumVal}>{formData.name} ({formData.phone})</span>
                    </div>
                  </div>

                  <p className={styles.submitNotice}>
                    Submitting logs this brief into our advisory queue for desk review. You can also connect directly by calling {PRIMARY_PHONE}.
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Registering Brief...' : 'Transmit Requirement →'}
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
