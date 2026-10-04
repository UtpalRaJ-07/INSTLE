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
  propertyType: string;
  bedrooms: string;
  siteSize: string;
  otherSiteSize: string;
  localities: string[];
  otherArea: string;
  budgetBand: string;
  timeline: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
}

export function Concept1Intake() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<IntakeFormData>({
    propertyType: '',
    bedrooms: '',
    siteSize: '',
    otherSiteSize: '',
    localities: [],
    otherArea: '',
    budgetBand: '',
    timeline: '',
    name: '',
    phone: '',
    email: '',
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [referenceId, setReferenceId] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  const toggleLocality = (loc: string) => {
    setFormData((prev) => {
      if (loc === 'I am open to suggestions') {
        const alreadyHasOpen = prev.localities.includes('I am open to suggestions');
        return {
          ...prev,
          localities: alreadyHasOpen ? [] : ['I am open to suggestions'],
          otherArea: '',
        };
      }
      const filtered = prev.localities.filter((item) => item !== 'I am open to suggestions');
      const exists = filtered.includes(loc);
      if (exists) {
        return { ...prev, localities: filtered.filter((item) => item !== loc) };
      }
      return { ...prev, localities: [...filtered, loc] };
    });
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.localities;
      return copy;
    });
  };

  const validateStep4 = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = 'Enter your name';
    }
    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    const isIndian10Digit = /^[6-9]\d{9}$/.test(cleanPhone);
    const isStandardValid = cleanPhone.length >= 10 && cleanPhone.length <= 15;

    if (!cleanPhone || (!isIndian10Digit && !isStandardValid)) {
      errs.phone = 'Check your phone number';
    }
    if (formData.consent !== true) {
      errs.consent = 'Please check the box to agree to INSTLE REAL ESTATE contacting you.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.propertyType) {
        setErrors({ propertyType: 'Please choose what you would like to buy' });
        return;
      }
    }
    if (currentStep === 2) {
      const hasLocalities = formData.localities.length > 0;
      const hasOtherArea = formData.otherArea.trim().length > 0;
      if (!hasLocalities && !hasOtherArea) {
        setErrors({ localities: 'Please choose an area or select “Open to suggestions”' });
        return;
      }
    }
    if (currentStep === 4) {
      if (!validateStep4()) return;
      setErrors({});
      setCurrentStep(5); // Review step
      return;
    }
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, 5));
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
      
      // Combine localities and otherArea
      let selectedAreas = [...formData.localities];
      if (formData.otherArea.trim()) {
        selectedAreas.push(formData.otherArea.trim());
      }
      if (selectedAreas.length === 0) {
        selectedAreas = ['Open to suggestions'];
      }

      // Build readable asset description
      let fullAssetType = formData.propertyType;
      if (formData.propertyType === 'Site / Plot') {
        const sizeDetail = formData.siteSize === 'Other size' && formData.otherSiteSize.trim()
          ? formData.otherSiteSize.trim()
          : formData.siteSize;
        if (sizeDetail) {
          fullAssetType += ` (${sizeDetail})`;
        }
      } else if (formData.bedrooms) {
        fullAssetType += ` (${formData.bedrooms})`;
      }

      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'buy',
          assetType: fullAssetType || 'Open to suggestions',
          localities: selectedAreas,
          budgetBand: formData.budgetBand || 'Open to discussion',
          timeline: formData.timeline || 'Flexible',
          name: formData.name.trim(),
          phone: cleanPhone,
          contactPreference: formData.email.trim() ? `Phone & Email (${formData.email.trim()})` : 'Phone Call',
          consent: formData.consent === true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send enquiry.');
      }

      setReferenceId(data.leadId);
      setSubmitted(true);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Unable to send enquiry. Please call our team directly at 9353096264.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSiteSelected = formData.propertyType === 'Site / Plot';
  const isResidentialStructure =
    formData.propertyType === 'Flat / Apartment' ||
    formData.propertyType === 'Independent House' ||
    formData.propertyType === 'Villa';

  return (
    <div className={styles.intakeWrapper} aria-labelledby="intake-title">
      <div className={styles.container}>
        {/* Left Side: Editorial Touchpoint */}
        <div className={styles.sidebarColumn}>
          <div className={styles.sidebarFrame}>
            <Image
              src="/media/concept1-courtyard-detail.jpg"
              alt="Courtyard and natural light design study in Bengaluru. Architectural illustration, non-inventory."
              width={800}
              height={600}
              className={styles.sidebarImage}
            />
            <div className={styles.sidebarPlate}>
              <span className={styles.plateTag}>BENGALURU PROPERTY BROKERAGE</span>
              <p className={styles.plateQuote}>
                “Looking to buy a home or plot in Bengaluru? Tell us what you need and our team will guide you through the next steps.”
              </p>
            </div>
          </div>

          <div className={styles.directPhoneCard}>
            <span className={styles.phoneCardLabel}>Prefer to talk directly?</span>
            <p className={styles.phoneCardDesc}>
              Skip the online form and speak with our brokerage team directly about your property requirement.
            </p>
            <a href={PRIMARY_PHONE_TEL} className={styles.phoneCardLink}>
              ☎ Call {PRIMARY_PHONE}
            </a>
          </div>
        </div>

        {/* Right Side: Clean Buyer Enquiry Form */}
        <div className={styles.formColumn}>
          <div className={styles.headerBlock}>
            <div className={styles.dossierMeta}>
              <span className={styles.dossierBadge}>BUY PROPERTY</span>
              <span className={styles.stepCounter}>STEP {currentStep} OF 5</span>
            </div>
            <h1 id="intake-title" className={styles.formHeading}>
              Share your property requirement
            </h1>
            <p className={styles.formSub}>
              Tell us what you are looking for, your preferred area and your budget. Our team will review your details and speak with you.
            </p>
          </div>

          {/* Progress Bar */}
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label="Enquiry form progress"
          >
            <div className={styles.progressBar} style={{ width: `${(currentStep / 5) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmationBox} role="alert">
              <span className={styles.confirmBadge}>ENQUIRY SENT</span>
              <h2 className={styles.confirmTitle}>Your enquiry has been received</h2>
              <p className={styles.confirmDesc}>
                Thank you, {formData.name}. Our brokerage team has received your requirement and will contact you soon.
              </p>
              <div className={styles.referenceBlock}>
                <span className={styles.refLabel}>Enquiry Reference Number:</span>
                <strong className={styles.refValue}>{referenceId}</strong>
              </div>
              <div className={styles.reviewSummary}>
                <p>
                  <strong>Looking to buy:</strong> {formData.propertyType}
                  {formData.bedrooms ? ` (${formData.bedrooms})` : ''}
                  {formData.siteSize ? ` (${formData.siteSize})` : ''}
                </p>
                <p>
                  <strong>Preferred areas:</strong>{' '}
                  {formData.localities.length > 0 ? formData.localities.join(', ') : ''}
                  {formData.otherArea ? `${formData.localities.length > 0 ? ', ' : ''}${formData.otherArea}` : ''}
                  {formData.localities.length === 0 && !formData.otherArea ? 'Open to suggestions' : ''}
                </p>
                <p><strong>Budget:</strong> {formData.budgetBand || 'Open to discussion'}</p>
                <p><strong>Planning to buy:</strong> {formData.timeline || 'Not sure yet'}</p>
                <p><strong>Contact:</strong> {formData.name} (+91 {formData.phone})</p>
              </div>
              <p className={styles.followupNote}>
                Have an urgent question? Speak directly with our team at{' '}
                <a href={PRIMARY_PHONE_TEL} className={styles.inlinePhone}>
                  {PRIMARY_PHONE}
                </a>
                .
              </p>
              <button
                type="button"
                className={styles.resetButton}
                onClick={() => {
                  setSubmitted(false);
                  setCurrentStep(1);
                  setFormData({
                    propertyType: '',
                    bedrooms: '',
                    siteSize: '',
                    otherSiteSize: '',
                    localities: [],
                    otherArea: '',
                    budgetBand: '',
                    timeline: '',
                    name: '',
                    phone: '',
                    email: '',
                    consent: false,
                  });
                }}
              >
                Send another enquiry
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

              {/* STEP 1: PROPERTY TYPE & SIZE */}
              {currentStep === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. What would you like to buy?</legend>
                  <p className={styles.stepPrompt}>Select property type:</p>
                  {errors.propertyType && <span className={styles.errorMsg} role="alert">{errors.propertyType}</span>}

                  <div className={styles.optionsGrid}>
                    {[
                      'Flat / Apartment',
                      'Independent House',
                      'Villa',
                      'Site / Plot',
                      'Other',
                    ].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`${styles.optionCard} ${formData.propertyType === type ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            propertyType: type,
                            bedrooms: type === 'Site / Plot' ? '' : formData.bedrooms,
                            siteSize: type === 'Site / Plot' ? formData.siteSize : '',
                          });
                          setErrors({});
                        }}
                      >
                        <span className={styles.optionRadio}>{formData.propertyType === type ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{type}</span>
                      </button>
                    ))}
                  </div>

                  {/* Sub-question for Flats, Houses & Villas: Bedrooms/BHK */}
                  {isResidentialStructure && (
                    <div className={styles.chipGroup} style={{ marginTop: '24px' }}>
                      <span className={styles.chipGroupLabel}>Number of bedrooms / BHK:</span>
                      <div className={styles.chipsRow}>
                        {[
                          '1 BHK',
                          '2 BHK',
                          '3 BHK',
                          '4 BHK',
                          '5+ BHK',
                          'Flexible / Open to suggestions',
                        ].map((bhk) => (
                          <button
                            key={bhk}
                            type="button"
                            className={`${styles.chipBtn} ${formData.bedrooms === bhk ? styles.chipSelected : ''}`}
                            onClick={() => setFormData({ ...formData, bedrooms: bhk })}
                          >
                            {bhk}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-question for Site/Plot: Specific Dimensions & Areas */}
                  {isSiteSelected && (
                    <div className={styles.chipGroup} style={{ marginTop: '24px' }}>
                      <span className={styles.chipGroupLabel}>What site size are you looking for?</span>
                      <p className={styles.fieldHelp} style={{ marginBottom: '12px' }}>
                        Common Bengaluru plot dimensions in feet and area in square feet:
                      </p>
                      <div className={styles.chipsRow}>
                        {[
                          '20 × 30 ft — 600 sq ft',
                          '30 × 40 ft — 1,200 sq ft',
                          '40 × 60 ft — 2,400 sq ft',
                          'Other size',
                          'Not sure yet',
                        ].map((size) => (
                          <button
                            key={size}
                            type="button"
                            className={`${styles.chipBtn} ${formData.siteSize === size ? styles.chipSelected : ''}`}
                            onClick={() => setFormData({ ...formData, siteSize: size })}
                          >
                            {size}
                          </button>
                        ))}
                      </div>

                      {formData.siteSize === 'Other size' && (
                        <div style={{ marginTop: '12px' }}>
                          <label htmlFor="other-site-input" className={styles.label}>
                            Enter site dimensions or square feet:
                          </label>
                          <input
                            id="other-site-input"
                            type="text"
                            className={styles.input}
                            placeholder="e.g. 50 × 80 ft (4,000 sq ft)"
                            value={formData.otherSiteSize}
                            onChange={(e) => setFormData({ ...formData, otherSiteSize: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </fieldset>
              )}

              {/* STEP 2: PREFERRED AREAS */}
              {currentStep === 2 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>02. Which area do you prefer?</legend>
                  <p className={styles.stepPrompt}>
                    Choose one or more areas, or select “Open to suggestions”:
                  </p>
                  {errors.localities && <span className={styles.errorMsg} role="alert">{errors.localities}</span>}

                  <div className={styles.optionsGrid}>
                    {[
                      'Indiranagar',
                      'Koramangala',
                      'Sadashivanagar',
                      'North Bengaluru / Hebbal',
                      'Whitefield / East Bengaluru',
                      'I am open to suggestions',
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

                  <div className={styles.fieldGroup} style={{ marginTop: '20px' }}>
                    <label htmlFor="other-area-input" className={styles.label}>
                      Enter another area (optional):
                    </label>
                    <input
                      id="other-area-input"
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Jayanagar, Malleshwaram, Sarjapur Road"
                      value={formData.otherArea}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          otherArea: e.target.value,
                          localities: formData.localities.filter((l) => l !== 'I am open to suggestions'),
                        });
                        setErrors({});
                      }}
                    />
                  </div>
                </fieldset>
              )}

              {/* STEP 3: BUDGET */}
              {currentStep === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. What is your budget?</legend>
                  <p className={styles.stepPrompt}>
                    Select your expected budget (rupees in Lakhs or Crores):
                  </p>
                  <div className={styles.optionsGrid}>
                    {[
                      'Under ₹50 Lakh',
                      '₹50 Lakh – ₹1 Crore',
                      '₹1 Crore – ₹2.5 Crore',
                      '₹2.5 Crore – ₹5 Crore',
                      '₹5 Crore+',
                      'Flexible / Not sure yet',
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
                  <legend className={styles.legend}>04. When are you planning to buy?</legend>
                  
                  {/* Timeline Selection */}
                  <div className={styles.chipGroup}>
                    <span className={styles.chipGroupLabel}>When are you planning to buy?</span>
                    <div className={styles.chipsRow}>
                      {[
                        'Within 30 days',
                        '1–3 Months',
                        '3–6 Months',
                        'Later',
                        'Not sure yet',
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.chipBtn} ${formData.timeline === t ? styles.chipSelected : ''}`}
                          onClick={() => setFormData({ ...formData, timeline: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className={styles.stepPrompt} style={{ marginTop: '20px' }}>
                    How can we contact you?
                  </p>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="buyer-name" className={styles.label}>
                      Your name *
                    </label>
                    <input
                      id="buyer-name"
                      type="text"
                      className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                      placeholder="e.g. Suresh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    {errors.name && <span className={styles.errorMsg} role="alert">{errors.name}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="buyer-phone" className={styles.label}>
                      Phone number *
                    </label>
                    <div className={styles.inputWithPrefix}>
                      <span className={styles.phonePrefix}>🇮🇳 +91</span>
                      <input
                        id="buyer-phone"
                        type="tel"
                        className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                        placeholder="9845012345"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                    <span className={styles.fieldHelp}>Used by our team to speak with you about your requirement.</span>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="buyer-email" className={styles.label}>
                      Email (optional)
                    </label>
                    <input
                      id="buyer-email"
                      type="email"
                      className={styles.input}
                      placeholder="e.g. suresh@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className={styles.consentGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={styles.checkboxInput}
                        checked={formData.consent}
                        onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                      />
                      <span>
                        I agree to {CANONICAL_BRAND} storing and using my contact details to discuss my property requirement.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errorMsg} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 5: REVIEW DETAILS */}
              {currentStep === 5 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>05. Review your details</legend>
                  <p className={styles.stepPrompt}>Please check your details before sending your enquiry:</p>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>What you want to buy</span>
                      <span className={styles.sumVal}>
                        {formData.propertyType || 'Open to suggestions'}
                        {formData.bedrooms ? ` (${formData.bedrooms})` : ''}
                        {formData.siteSize ? ` (${formData.siteSize === 'Other size' && formData.otherSiteSize ? formData.otherSiteSize : formData.siteSize})` : ''}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Preferred area</span>
                      <span className={styles.sumVal}>
                        {formData.localities.length > 0 ? formData.localities.join(', ') : ''}
                        {formData.otherArea ? `${formData.localities.length > 0 ? ', ' : ''}${formData.otherArea}` : ''}
                        {formData.localities.length === 0 && !formData.otherArea ? 'Open to suggestions' : ''}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Budget</span>
                      <span className={styles.sumVal}>{formData.budgetBand || 'Open to discussion'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>When planning to buy</span>
                      <span className={styles.sumVal}>{formData.timeline || 'Not sure yet'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Contact details</span>
                      <span className={styles.sumVal}>
                        {formData.name} (+91 {formData.phone})
                        {formData.email ? ` · ${formData.email}` : ''}
                      </span>
                    </div>
                  </div>

                  <p className={styles.submitNotice}>
                    Sending this enquiry shares your requirement with our brokerage team so we can discuss suitable options with you. This does not commit you to any contract.
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
                    ← Edit
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    type="button"
                    className={styles.nextBtn}
                    onClick={handleNext}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Sending enquiry...' : 'Send enquiry →'}
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
