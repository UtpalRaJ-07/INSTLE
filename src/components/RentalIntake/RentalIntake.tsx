'use client';

import React, { useState } from 'react';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './RentalIntake.module.css';

interface RentalFormData {
  assetType: string;
  localities: string[];
  monthlyBudget: string;
  furnishing: string;
  leaseDuration: string;
  moveInTimeline: string;
  name: string;
  phone: string;
  contactPreference: string;
  consent: boolean;
}

export function RentalIntake() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<RentalFormData>({
    assetType: '',
    localities: [],
    monthlyBudget: '',
    furnishing: '',
    leaseDuration: '',
    moveInTimeline: '',
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

  const validateContactStep = () => {
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
      setErrors({ assetType: 'Please select a residence typology or choose "Open to Guidance".' });
      return;
    }
    if (currentStep === 4) {
      if (!validateContactStep()) return;
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
    if (!validateContactStep()) {
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
          intent: 'rent',
          assetType: formData.assetType || 'Open to Guidance',
          localities: formData.localities.length > 0 ? formData.localities : ['Open to Guidance'],
          budgetBand: formData.monthlyBudget || 'Open to Discussion',
          timeline: formData.moveInTimeline || 'Flexible',
          furnishing: formData.furnishing || 'Flexible',
          leaseDuration: formData.leaseDuration || 'Standard 11-12 Months',
          name: formData.name.trim(),
          phone: cleanPhone,
          contactPreference: formData.contactPreference,
          consent: formData.consent === true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit rental enquiry.');
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
    <div className={styles.intakeWrapper} aria-labelledby="rental-intake-title">
      <div className={styles.container}>
        <div className={styles.formBox}>
          <div className={styles.headerBlock}>
            <div className={styles.dossierMeta}>
              <span className={styles.dossierBadge}>TENANCY INTAKE</span>
              <span className={styles.stepCounter}>STEP {currentStep} OF 5</span>
            </div>
            <h2 id="rental-intake-title" className={styles.formHeading}>
              Share Your Rental Requirement
            </h2>
            <p className={styles.formSub}>
              Looking for a high-specification residence in Bengaluru? Specify your leasing preferences for direct advisory coordination.
            </p>
          </div>

          {/* Progress Bar */}
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label="Tenancy intake progress"
          >
            <div className={styles.progressBar} style={{ width: `${(currentStep / 5) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmationBox} role="alert">
              <span className={styles.confirmBadge}>TENANCY REQUIREMENT LOGGED</span>
              <h3 className={styles.confirmTitle}>Rental Brief Registered Successfully</h3>
              <p className={styles.confirmDesc}>
                Your residential leasing parameters have been queued for brokerage review.
              </p>
              <div className={styles.referenceBlock}>
                <span className={styles.refLabel}>Advisory Reference Number:</span>
                <strong className={styles.refValue}>{referenceId}</strong>
              </div>
              <div className={styles.reviewSummary}>
                <p><strong>Tenant Name:</strong> {formData.name} ({formData.phone})</p>
                <p><strong>Typology:</strong> {formData.assetType || 'Open to Guidance'}</p>
                <p><strong>Target Enclaves:</strong> {formData.localities.length ? formData.localities.join(', ') : 'Open to Guidance'}</p>
                <p><strong>Monthly Rent Budget:</strong> {formData.monthlyBudget || 'Open to Discussion'}</p>
                <p><strong>Furnishing:</strong> {formData.furnishing || 'Flexible'}</p>
                <p><strong>Lease Duration:</strong> {formData.leaseDuration || 'Standard'}</p>
                <p><strong>Move-in Target:</strong> {formData.moveInTimeline || 'Flexible'}</p>
              </div>
              <p className={styles.followupNote}>
                Our team reviews rental briefs against direct landlord mandates. For immediate assistance, call our desk directly at <a href={PRIMARY_PHONE_TEL} className={styles.inlinePhone}>{PRIMARY_PHONE}</a>.
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
                    monthlyBudget: '',
                    furnishing: '',
                    leaseDuration: '',
                    moveInTimeline: '',
                    name: '',
                    phone: '',
                    contactPreference: 'Phone Call',
                    consent: false,
                  });
                }}
              >
                Submit Another Rental Requirement
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

              {/* STEP 1: RESIDENCE TYPOLOGY */}
              {currentStep === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. Preferred Residence Typology</legend>
                  <p className={styles.stepPrompt}>What typology of residential property do you wish to lease?</p>
                  {errors.assetType && <span className={styles.errorMsg} role="alert">{errors.assetType}</span>}
                  <div className={styles.optionsGrid}>
                    {[
                      'Gated Community Apartment',
                      'Gated Enclave Villa',
                      'Boutique Penthouse / Duplex',
                      'Independent Bungalow / House',
                      'Serviced / Corporate Residence',
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
                  <legend className={styles.legend}>02. Desired Bengaluru Enclaves</legend>
                  <p className={styles.stepPrompt}>Select preferred areas (multiple choices supported, or leave open):</p>
                  <div className={styles.optionsGrid}>
                    {[
                      'Indiranagar & Defence Colony',
                      'Koramangala (Blocks 3, 4, 5)',
                      'Sadashivanagar / Palace Orchards',
                      'North Bengaluru / Hebbal Corridor',
                      'Outer Ring Road / Sarjapur Belt',
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

              {/* STEP 3: MONTHLY RENTAL BUDGET */}
              {currentStep === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. Monthly Rental Budget Band</legend>
                  <p className={styles.stepPrompt}>Select your anticipated monthly rental expenditure:</p>
                  <div className={styles.optionsGrid}>
                    {[
                      '₹40,000 – ₹75,000 / month',
                      '₹75,000 – ₹1,50,000 / month',
                      '₹1,50,000 – ₹3,00,000 / month',
                      '₹3,00,000 – ₹5,00,000 / month',
                      '₹5,00,000+ / month',
                      'Open to Discussion / Guidance Needed',
                    ].map((band) => (
                      <button
                        key={band}
                        type="button"
                        className={`${styles.optionCard} ${formData.monthlyBudget === band ? styles.selectedOption : ''}`}
                        onClick={() => setFormData({ ...formData, monthlyBudget: band })}
                      >
                        <span className={styles.optionRadio}>{formData.monthlyBudget === band ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{band}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* STEP 4: TENANCY PARAMETERS & CONTACT */}
              {currentStep === 4 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>04. Lease Specifications &amp; Contact</legend>
                  <p className={styles.stepPrompt}>Specify your furnishing preference, lease horizon, and telephone contact:</p>

                  <div className={styles.twoColRow}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="rent-furnishing" className={styles.label}>
                        Furnishing Requirement
                      </label>
                      <select
                        id="rent-furnishing"
                        className={styles.select}
                        value={formData.furnishing}
                        onChange={(e) => setFormData({ ...formData, furnishing: e.target.value })}
                      >
                        <option value="">Select furnishing (or flexible)</option>
                        <option value="Fully Furnished">Fully Furnished</option>
                        <option value="Semi-Furnished (with appliances)">Semi-Furnished (with appliances)</option>
                        <option value="Unfurnished">Unfurnished</option>
                        <option value="Flexible">Flexible</option>
                      </select>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="rent-duration" className={styles.label}>
                        Expected Lease Duration
                      </label>
                      <select
                        id="rent-duration"
                        className={styles.select}
                        value={formData.leaseDuration}
                        onChange={(e) => setFormData({ ...formData, leaseDuration: e.target.value })}
                      >
                        <option value="">Select duration</option>
                        <option value="11–12 Months">11–12 Months</option>
                        <option value="2–3 Years">2–3 Years</option>
                        <option value="Long-term (3+ Years)">Long-term (3+ Years)</option>
                        <option value="Flexible">Flexible</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="rent-timeline" className={styles.label}>
                      Target Move-In Window
                    </label>
                    <select
                      id="rent-timeline"
                      className={styles.select}
                      value={formData.moveInTimeline}
                      onChange={(e) => setFormData({ ...formData, moveInTimeline: e.target.value })}
                    >
                      <option value="">Select move-in target</option>
                      <option value="Immediate (0–30 days)">Immediate (0–30 days)</option>
                      <option value="30–60 Days">30–60 Days</option>
                      <option value="60+ Days">60+ Days</option>
                      <option value="Flexible / Exploring">Flexible / Exploring</option>
                    </select>
                  </div>

                  <div className={styles.twoColRow}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="rent-name" className={styles.label}>
                        Full Name *
                      </label>
                      <input
                        id="rent-name"
                        type="text"
                        className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                        placeholder="e.g. Ananya Rao"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                      {errors.name && <span className={styles.errorMsg} role="alert">{errors.name}</span>}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="rent-phone" className={styles.label}>
                        Telephone Number *
                      </label>
                      <input
                        id="rent-phone"
                        type="tel"
                        className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                        placeholder="e.g. 9845012345"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                      {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                    </div>
                  </div>

                  <div className={styles.consentGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                      />
                      <span>
                        I consent to {CANONICAL_BRAND} storing and processing these details under Indian privacy principles solely for tenancy advisory.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errorMsg} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 5: REVIEW SUMMARY */}
              {currentStep === 5 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>05. Review &amp; Register Tenancy Brief</legend>
                  <p className={styles.stepPrompt}>Please verify your parameters prior to transmitting to our intake queue.</p>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Typology</span>
                      <span className={styles.sumVal}>{formData.assetType || 'Open to Guidance'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Target Enclaves</span>
                      <span className={styles.sumVal}>
                        {formData.localities.length ? formData.localities.join(', ') : 'Open to Guidance'}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Monthly Budget</span>
                      <span className={styles.sumVal}>{formData.monthlyBudget || 'Open to Discussion'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Furnishing &amp; Lease</span>
                      <span className={styles.sumVal}>
                        {formData.furnishing || 'Flexible'} · {formData.leaseDuration || 'Standard'}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Move-in Target</span>
                      <span className={styles.sumVal}>{formData.moveInTimeline || 'Flexible'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Tenant Contact</span>
                      <span className={styles.sumVal}>{formData.name} ({formData.phone})</span>
                    </div>
                  </div>

                  <p className={styles.submitNotice}>
                    Submitting logs this brief into our advisory queue. You can also connect directly by calling {PRIMARY_PHONE}.
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
                    {isSubmitting ? 'Registering Brief...' : 'Transmit Tenancy Brief →'}
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
