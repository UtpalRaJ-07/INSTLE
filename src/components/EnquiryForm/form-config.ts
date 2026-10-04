/**
 * Per-intent form configuration.
 *
 * One form component, five journeys. Fields appear only when they are relevant:
 * a landlord is asked about furnishing and availability, a buyer is asked about
 * budget, and nobody is asked villa questions about an office.
 *
 * Every option list here maps to an enum validated on the server in
 * src/lib/enquiry-schema.ts, so the client cannot widen the accepted values.
 */

import type { CustomerIntent } from '@/config/constants';
import { getSelectableAssetTypes } from '@/config/service-matrix';
import {
  BUDGET_BANDS,
  CONFIGURATIONS,
  CONTACT_PREFERENCES,
  FURNISHING_OPTIONS,
  OWNERSHIP_ROLES,
  RENT_BANDS,
  TIMELINES,
} from '@/lib/enquiry-schema';

export interface Option {
  value: string;
  label: string;
}

const BUDGET_LABELS: Record<(typeof BUDGET_BANDS)[number], string> = {
  'under-50-lakh': 'Under ₹50 lakh',
  '50-lakh-to-1-crore': '₹50 lakh to ₹1 crore',
  '1-to-2-5-crore': '₹1 crore to ₹2.5 crore',
  '2-5-to-5-crore': '₹2.5 crore to ₹5 crore',
  'above-5-crore': 'Above ₹5 crore',
  'prefer-to-discuss': 'Prefer to discuss',
};

const RENT_LABELS: Record<(typeof RENT_BANDS)[number], string> = {
  'under-15000': 'Under ₹15,000 a month',
  '15000-to-30000': '₹15,000 to ₹30,000 a month',
  '30000-to-60000': '₹30,000 to ₹60,000 a month',
  '60000-to-1-lakh': '₹60,000 to ₹1 lakh a month',
  'above-1-lakh': 'Above ₹1 lakh a month',
  'prefer-to-discuss': 'Prefer to discuss',
};

const TIMELINE_LABELS: Record<(typeof TIMELINES)[number], string> = {
  'within-30-days': 'Within 30 days',
  '1-to-3-months': '1 to 3 months',
  '3-to-6-months': '3 to 6 months',
  later: 'Later than 6 months',
  'not-decided': 'Not decided yet',
};

const FURNISHING_LABELS: Record<(typeof FURNISHING_OPTIONS)[number], string> = {
  unfurnished: 'Unfurnished',
  'semi-furnished': 'Semi-furnished',
  'fully-furnished': 'Fully furnished',
  'no-preference': 'No preference',
};

const OWNERSHIP_LABELS: Record<(typeof OWNERSHIP_ROLES)[number], string> = {
  owner: 'I own the property',
  'co-owner': 'I am one of the owners',
  'authorised-representative': 'I represent the owner',
  other: 'Something else — I will explain',
};

const CONTACT_PREFERENCE_LABELS: Record<(typeof CONTACT_PREFERENCES)[number], string> = {
  'phone-call': 'Any time is fine',
  'phone-call-morning': 'Morning',
  'phone-call-evening': 'Evening',
};

function toOptions<T extends string>(values: readonly T[], labels: Record<T, string>): Option[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const BUDGET_OPTIONS = toOptions(BUDGET_BANDS, BUDGET_LABELS);
export const RENT_OPTIONS = toOptions(RENT_BANDS, RENT_LABELS);
export const FURNISHING_OPTIONS_LIST = toOptions(FURNISHING_OPTIONS, FURNISHING_LABELS);
export const OWNERSHIP_OPTIONS = toOptions(OWNERSHIP_ROLES, OWNERSHIP_LABELS);
export const CONTACT_PREFERENCE_OPTIONS = toOptions(CONTACT_PREFERENCES, CONTACT_PREFERENCE_LABELS);
export const CONFIGURATION_OPTIONS: Option[] = CONFIGURATIONS.map((value) => ({
  value,
  label: value,
}));

export interface IntentFormConfig {
  intent: CustomerIntent;
  /** Heading above the form. */
  heading: string;
  /** One sentence explaining what sending the form does. */
  intro: string;
  assetTypeLabel: string;
  assetTypeOptions: Option[];
  /** Whether the bedroom-configuration question is shown for residential homes. */
  showConfiguration: boolean;
  /** Which money question to ask, if any. */
  moneyQuestion: 'budget' | 'rent' | 'none';
  moneyLabel: string;
  moneyOptions: Option[];
  areaLabel: string;
  areaHelp: string;
  timelineLabel: string;
  timelineOptions: Option[];
  showFurnishing: boolean;
  showOwnershipRole: boolean;
  notesLabel: string;
  notesHelp: string;
  submitLabel: string;
  /** What the customer is told the form does and does not mean. */
  expectationNote: string;
}

function timelineOptions(intent: CustomerIntent): Option[] {
  const labels: Record<(typeof TIMELINES)[number], string> = { ...TIMELINE_LABELS };
  if (intent === 'rent' || intent === 'rent-out') {
    labels['within-30-days'] = 'Within 30 days';
    labels['1-to-3-months'] = '1 to 3 months';
    labels['3-to-6-months'] = '3 to 6 months';
    labels.later = 'Later than 6 months';
    labels['not-decided'] = 'Not decided yet';
  }
  return toOptions(TIMELINES, labels);
}

function assetOptions(intent: CustomerIntent): Option[] {
  return getSelectableAssetTypes(intent).map((asset) => ({
    value: asset.id,
    label: asset.hint ? `${asset.label} (${asset.hint})` : asset.label,
  }));
}

export function getFormConfig(intent: CustomerIntent): IntentFormConfig {
  const base = {
    intent,
    assetTypeOptions: assetOptions(intent),
    timelineOptions: timelineOptions(intent),
  };

  switch (intent) {
    case 'buy':
      return {
        ...base,
        heading: 'Tell us what you are looking for',
        intro: 'Six questions. None of them needs an exact answer.',
        assetTypeLabel: 'What would you like to buy?',
        showConfiguration: true,
        moneyQuestion: 'budget',
        moneyLabel: 'What budget do you have in mind?',
        moneyOptions: BUDGET_OPTIONS,
        areaLabel: 'Which areas are you considering?',
        areaHelp:
          'Type the areas you have in mind, separated by commas. Leave it blank if you would rather we suggested some.',
        timelineLabel: 'When would you like to buy?',
        showFurnishing: false,
        showOwnershipRole: false,
        notesLabel: 'Anything else we should know? (optional)',
        notesHelp: 'For example a school you want to be near, or a floor you would prefer.',
        submitLabel: 'Send my requirement',
        expectationNote:
          'Sending this starts a conversation. It does not reserve a property and it does not mean we currently have something matching your requirement.',
      };

    case 'sell':
      return {
        ...base,
        heading: 'Tell us about the property you want to sell',
        intro: 'Enough to have a useful first conversation. No documents at this stage.',
        assetTypeLabel: 'What are you selling?',
        showConfiguration: true,
        moneyQuestion: 'budget',
        moneyLabel: 'What price do you have in mind? (optional)',
        moneyOptions: BUDGET_OPTIONS,
        areaLabel: 'Which area is the property in?',
        areaHelp:
          'The locality or a nearby main road is enough. Please do not put the full address here.',
        timelineLabel: 'When would you like to sell?',
        showFurnishing: false,
        showOwnershipRole: true,
        notesLabel: 'Anything else we should know? (optional)',
        notesHelp: 'For example whether it is tenanted, or work that is pending.',
        submitLabel: 'Send my property details',
        expectationNote:
          'This is a request for a conversation, not a valuation. We do not promise a sale by any particular date or at any particular price.',
      };

    case 'rent':
      return {
        ...base,
        heading: 'Tell us what kind of home you need',
        intro: 'Where you want to stay, what you can spend, and when you need to move.',
        assetTypeLabel: 'What kind of home?',
        showConfiguration: true,
        moneyQuestion: 'rent',
        moneyLabel: 'What monthly rent works for you?',
        moneyOptions: RENT_OPTIONS,
        areaLabel: 'Which areas would suit you?',
        areaHelp:
          'Type the areas you have in mind, separated by commas. Leave it blank if you are open to suggestions.',
        timelineLabel: 'When do you need to move in?',
        showFurnishing: true,
        showOwnershipRole: false,
        notesLabel: 'Anything else we should know? (optional)',
        notesHelp: 'For example parking, a pet, or how many people will be staying.',
        submitLabel: 'Send my rental requirement',
        expectationNote:
          'Sending this starts a conversation. It does not hold a property for you and it does not mean a matching home is available right now.',
      };

    case 'rent-out':
      return {
        ...base,
        heading: 'Tell us about the property you want to rent out',
        intro: 'What it is, where it is, and when someone could move in.',
        assetTypeLabel: 'What are you renting out?',
        showConfiguration: true,
        moneyQuestion: 'rent',
        moneyLabel: 'What monthly rent do you expect? (optional)',
        moneyOptions: RENT_OPTIONS,
        areaLabel: 'Which area is the property in?',
        areaHelp:
          'The locality or a nearby main road is enough. Please do not put the full address here.',
        timelineLabel: 'When is it available?',
        showFurnishing: true,
        showOwnershipRole: true,
        notesLabel: 'Anything else we should know? (optional)',
        notesHelp: 'For example pending painting or repairs, or who holds the keys.',
        submitLabel: 'Send my property details',
        expectationNote:
          'This is a request for a conversation. We speak to prospective tenants about their requirement before arranging a visit; that is a filtering conversation, not a background check or a verification service.',
      };

    case 'commercial':
    default:
      return {
        ...base,
        heading: 'Tell us about your commercial requirement',
        intro:
          'Commercial work is something we are asked about often. Tell us what you need and we will say straight away whether we can help.',
        assetTypeLabel: 'What kind of property?',
        showConfiguration: false,
        moneyQuestion: 'none',
        moneyLabel: '',
        moneyOptions: [],
        areaLabel: 'Which area or corridor?',
        areaHelp: 'The locality or main road is enough.',
        timelineLabel: 'What is your timeline?',
        showFurnishing: false,
        showOwnershipRole: false,
        notesLabel: 'What do you need the space for, and roughly how much? (optional)',
        notesHelp: 'For example a 2,000 sq ft office, or a shop on a main road.',
        submitLabel: 'Send my requirement',
        expectationNote:
          'We have not yet confirmed which commercial services we can take on, so treat this as an enquiry rather than an engagement. We will tell you honestly if it is outside what we handle.',
      };
  }
}
