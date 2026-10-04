'use client';

import React, { useState } from 'react';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './RentalIntake.module.css';

interface RentalFormData {
  propertyType: string;
  bedrooms: string;
  localities: string[];
  otherArea: string;
  monthlyBudget: string;
  furnishing: string;
  moveInTimeline: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
}

export function RentalIntake() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<RentalFormData>({
    propertyType: '',
    bedrooms: '',
    localities: [],
    otherArea: '',
    monthlyBudget: '',
    furnishing: '',
    moveInTimeline: '',
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

  const validateContactStep = () => {
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
        setErrors({ propertyType: 'Please choose what type of home you want to rent' });
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
      if (!validateContactStep()) return;
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
    if (!validateContactStep()) {
      setCurrentStep(4);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const cleanPhone = formData.phone.replace(/[^0-9]/g, '');

      let selectedAreas = [...formData.localities];
      if (formData.otherArea.trim()) {
        selectedAreas.push(formData.otherArea.trim());
      }
      if (selectedAreas.length === 0) {
        selectedAreas = ['Open to suggestions'];
      }

      const fullAsset = formData.bedrooms
        ? `${formData.propertyType} (${formData.bedrooms})`
        : formData.propertyType;

      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'rent',
          assetType: fullAsset || 'Flat / Apartment',
          localities: selectedAreas,
          budgetBand: formData.monthlyBudget || 'Open to discussion',
          timeline: formData.moveInTimeline || 'Flexible',
          furnishing: formData.furnishing || 'Flexible',
          name: formData.name.trim(),
          phone: cleanPhone,
          contactPreference: formData.email.trim() ? `Phone & Email (${formData.email.trim()})` : 'Phone Call',
          consent: formData.consent === true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send rental enquiry.');
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

  return (
    <div className={styles.intakeWrapper} aria-labelledby="rental-intake-title">
      <div className={styles.container}>
        <div className={styles.formBox}>
          <div className={styles.headerBlock}>
            <div className={styles.dossierMeta}>
              <span className={styles.dossierBadge}>RENT A HOME</span>
              <span className={styles.stepCounter}>STEP {currentStep} OF 5</span>
            </div>
            <h2 id="rental-intake-title" className={styles.formHeading}>
              Rent a home in Bengaluru
            </h2>
            <p className={styles.formSub}>
              Tell us where you want to stay, your monthly rent budget and when you plan to move. Our team will help you find suitable homes.
            </p>
          </div>

          {/* Progress Bar */}
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={5}
            aria-label="Rental enquiry progress"
          >
            <div className={styles.progressBar} style={{ width: `${(currentStep / 5) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmationBox} role="alert">
              <span className={styles.confirmBadge}>ENQUIRY SENT</span>
              <h3 className={styles.confirmTitle}>Your enquiry has been received</h3>
              <p className={styles.confirmDesc}>
                Thank you, {formData.name}. Our brokerage team has received your rental requirement and will contact you soon.
              </p>
              <div className={styles.referenceBlock}>
                <span className={styles.refLabel}>Enquiry Reference Number:</span>
                <strong className={styles.refValue}>{referenceId}</strong>
              </div>
              <div className={styles.reviewSummary}>
                <p>
                  <strong>Looking to rent:</strong> {formData.propertyType}
                  {formData.bedrooms ? ` (${formData.bedrooms})` : ''}
                </p>
                <p>
                  <strong>Preferred areas:</strong>{' '}
                  {formData.localities.length > 0 ? formData.localities.join(', ') : ''}
                  {formData.otherArea ? `${formData.localities.length > 0 ? ', ' : ''}${formData.otherArea}` : ''}
                  {formData.localities.length === 0 && !formData.otherArea ? 'Open to suggestions' : ''}
                </p>
                <p><strong>Monthly rent budget:</strong> {formData.monthlyBudget || 'Open to discussion'}</p>
                <p><strong>Furnishing:</strong> {formData.furnishing || 'Flexible'}</p>
                <p><strong>Move-in timing:</strong> {formData.moveInTimeline || 'Flexible'}</p>
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
                    localities: [],
                    otherArea: '',
                    monthlyBudget: '',
                    furnishing: '',
                    moveInTimeline: '',
                    name: '',
                    phone: '',
                    email: '',
                    consent: false,
                  });
                }}
              >
                Send another rental enquiry
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

              {/* STEP 1: PROPERTY TYPE & BEDROOMS */}
              {currentStep === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. What type of home are you looking to rent?</legend>
                  <p className={styles.stepPrompt}>Select property type:</p>
                  {errors.propertyType && <span className={styles.errorMsg} role="alert">{errors.propertyType}</span>}

                  <div className={styles.optionsGrid}>
                    {[
                      'Flat / Apartment',
                      'Independent House',
                      'Villa',
                      'Other',
                    ].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`${styles.optionCard} ${formData.propertyType === type ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, propertyType: type });
                          setErrors({});
                        }}
                      >
                        <span className={styles.optionRadio}>{formData.propertyType === type ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{type}</span>
                      </button>
                    ))}
                  </div>

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
                      'Indiranagar & Defence Colony',
                      'Koramangala & HSR Layout',
                      'Sadashivanagar & Palace Orchards',
                      'North Bengaluru / Hebbal Corridor',
                      'Outer Ring Road / Sarjapur Road',
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
                    <label htmlFor="rent-other-area" className={styles.label}>
                      Enter another area (optional):
                    </label>
                    <input
                      id="rent-other-area"
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Malleshwaram, JP Nagar, Bellandur"
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

              {/* STEP 3: MONTHLY RENT BUDGET */}
              {currentStep === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. What is your monthly rent budget?</legend>
                  <p className={styles.stepPrompt}>Select your expected monthly rent:</p>

                  <div className={styles.optionsGrid}>
                    {[
                      'Under ₹30,000 / month',
                      '₹30,000 – ₹50,000 / month',
                      '₹50,000 – ₹1 Lakh / month',
                      '₹1 Lakh – ₹2 Lakh / month',
                      '₹2 Lakh+ / month',
                      'Flexible / Not sure yet',
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

              {/* STEP 4: FURNISHING, TIMING & CONTACT */}
              {currentStep === 4 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>04. Furnishing, timing &amp; contact details</legend>

                  <div className={styles.chipGroup}>
                    <span className={styles.chipGroupLabel}>Furnishing preference</span>
                    <div className={styles.chipsRow}>
                      {[
                        'Fully Furnished',
                        'Semi-Furnished (with appliances)',
                        'Unfurnished',
                        'Flexible',
                      ].map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`${styles.chipBtn} ${formData.furnishing === f ? styles.chipSelected : ''}`}
                          onClick={() => setFormData({ ...formData, furnishing: f })}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.chipGroup}>
                    <span className={styles.chipGroupLabel}>When are you planning to move in?</span>
                    <div className={styles.chipsRow}>
                      {[
                        'Immediate (within 30 days)',
                        '1–2 Months',
                        'Later',
                        'Not sure yet',
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.chipBtn} ${formData.moveInTimeline === t ? styles.chipSelected : ''}`}
                          onClick={() => setFormData({ ...formData, moveInTimeline: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className={styles.stepPrompt} style={{ marginTop: '20px' }}>
                    How can we contact you?
                  </p>

                  <div className={styles.twoColRow}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="rent-name" className={styles.label}>
                        Your name *
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
                        Phone number *
                      </label>
                      <div className={styles.inputWithPrefix}>
                        <span className={styles.phonePrefix}>🇮🇳 +91</span>
                        <input
                          id="rent-phone"
                          type="tel"
                          className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                          placeholder="9845012345"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                        />
                      </div>
                      {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="rent-email" className={styles.label}>
                      Email (optional)
                    </label>
                    <input
                      id="rent-email"
                      type="email"
                      className={styles.input}
                      placeholder="e.g. ananya@example.com"
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
                        I agree to {CANONICAL_BRAND} storing and using my contact details to discuss my rental requirement. No marketing spam or data resale.
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
                      <span className={styles.sumKey}>What you want to rent</span>
                      <span className={styles.sumVal}>
                        {formData.propertyType || 'Open to suggestions'}
                        {formData.bedrooms ? ` (${formData.bedrooms})` : ''}
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
                      <span className={styles.sumKey}>Monthly rent budget</span>
                      <span className={styles.sumVal}>{formData.monthlyBudget || 'Open to discussion'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Furnishing &amp; timing</span>
                      <span className={styles.sumVal}>
                        {formData.furnishing || 'Flexible'} · {formData.moveInTimeline || 'Flexible'}
                      </span>
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
                    Sending this enquiry shares your rental requirement with our brokerage team. This does not commit you to any contract or lease agreement.
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
