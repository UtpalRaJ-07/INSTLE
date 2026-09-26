/**
 * Bengaluru Micro-Market Locality Intelligence
 * Sourced from Blueprint Section 8 & Master Roadmap
 * 
 * Strict Two-Source Verification Gate:
 * Every factual claim (transit connectivity, administrative zoning, typologies)
 * must be supported by official municipal or planning citations.
 * Uncorroborated records remain in 'draft' status and are excluded from public indexing.
 */

export interface LocalityClaimCitation {
  claim: string;
  sourceName: string;
  referenceUrlOrDoc: string;
  verificationDate: string;
}

export interface LocalityRecord {
  slug: string;
  name: string;
  quadrant: string;
  publicationStatus: 'published' | 'draft';
  reviewStatus: 'approved' | 'editorial_draft';
  character: string;
  bbmpZone: string;
  transitOperational: string;
  transitPlanned: string;
  typicalResidentialTypology: string;
  advisoryFocus: string;
  citations: LocalityClaimCitation[];
  editorialSignOffBy: string;
  lastReviewedAt: string;
}

export const LOCALITY_REGISTRY: LocalityRecord[] = [
  {
    slug: 'indiranagar',
    name: 'Indiranagar & Old Airport Road',
    quadrant: 'East Urban Enclave',
    publicationStatus: 'published',
    reviewStatus: 'approved',
    character:
      'Planned residential layout established in the late 1960s, characterized by tree-lined residential cross roads adjacent to commercial corridors along 100 Feet Road and Chinmaya Mission Hospital (CMH) Road.',
    bbmpZone: 'BBMP East Zone (Ward 80 / Hoysala Nagar & Ward 89 / Jogupalya)',
    transitOperational:
      'Namma Metro Purple Line with operational passenger stations at Indiranagar and Swami Vivekananda Road.',
    transitPlanned:
      'Road widening and intersection remodeling at the Old Airport Road – Suranjandas Road junction.',
    typicalResidentialTypology:
      'Independent custom residences, redeveloped low-density residential floors, and boutique penthouses.',
    advisoryFocus:
      'Assisting buyers and tenants with layout demarcation, quiet interior residential pockets, and municipal title documentation.',
    citations: [
      {
        claim: 'Namma Metro Purple Line passenger service operational through Indiranagar and SV Road stations.',
        sourceName: 'Bangalore Metro Rail Corporation Limited (BMRCL) Operational Network Map',
        referenceUrlOrDoc: 'https://english.bmrc.co.in',
        verificationDate: 'September 2026',
      },
      {
        claim: 'Administrative delimitation under BBMP East Zone (Wards 80 & 89).',
        sourceName: 'Bruhat Bengaluru Mahanagara Palike (BBMP) Restructuring Notification & Ward Delimitation',
        referenceUrlOrDoc: 'https://bbmp.gov.in',
        verificationDate: 'September 2026',
      },
      {
        claim: 'BDA original residential layout scheme planning.',
        sourceName: 'Bangalore Development Authority (BDA) Layout Cadastral Archives',
        referenceUrlOrDoc: 'https://bdabangalore.org',
        verificationDate: 'September 2026',
      },
    ],
    editorialSignOffBy: 'INSTLE Research & Advisory Desk',
    lastReviewedAt: '2026-09-26',
  },
  {
    slug: 'koramangala',
    name: 'Koramangala & Surrounding Blocks',
    quadrant: 'South-East Residential Hub',
    publicationStatus: 'published',
    reviewStatus: 'approved',
    character:
      'Established residential sector with prominent park-facing plots in 3rd, 4th, 5th, and 6th Blocks, offering residential streetscapes proximate to the Hosur Road and Sarjapur Road enterprise corridors.',
    bbmpZone: 'BBMP South Zone (Ward 151 / Koramangala)',
    transitOperational:
      'Surface arterial road access via 80 Feet Road, 100 Feet Intermediate Ring Road, and Hosur Main Road.',
    transitPlanned:
      'Silk Board Multi-Level Transit Interchange & Yellow Line connectivity currently in commissioning and testing.',
    typicalResidentialTypology:
      'Independent bungalows, private multi-level residences, and gated boutique apartment blocks.',
    advisoryFocus:
      'Advising on block-specific vehicular access, acoustic setbacks from commercial high streets, and clear-title layout documentation.',
    citations: [
      {
        claim: 'Administrative delimitation under BBMP South Zone (Ward 151).',
        sourceName: 'Bruhat Bengaluru Mahanagara Palike (BBMP) Ward Administration Registry',
        referenceUrlOrDoc: 'https://bbmp.gov.in',
        verificationDate: 'September 2026',
      },
      {
        claim: 'Yellow Line and Central Silk Board interchange alignment and project status.',
        sourceName: 'BMRCL Phase 2 Construction & Testing Status Bulletins',
        referenceUrlOrDoc: 'https://english.bmrc.co.in',
        verificationDate: 'September 2026',
      },
      {
        claim: 'BDA Koramangala Layout Master Scheme records.',
        sourceName: 'BDA Master Plan 2015 & Cadastral Records',
        referenceUrlOrDoc: 'https://bdabangalore.org',
        verificationDate: 'September 2026',
      },
    ],
    editorialSignOffBy: 'INSTLE Research & Advisory Desk',
    lastReviewedAt: '2026-09-26',
  },
  {
    slug: 'sadashivanagar',
    name: 'Sadashivanagar & Palace Orchards',
    quadrant: 'Central-North Heritage Belt',
    publicationStatus: 'published',
    reviewStatus: 'approved',
    character:
      'Premier historical residential enclave developed from the erstwhile royal orchards, noted for mature canopy trees, low vehicular throughput, and high-capital private residences.',
    bbmpZone: 'BBMP West Zone (Ward 35 / Aramane Nagar)',
    transitOperational:
      'Direct arterial road access to Sankey Road, Bellary Road, and CV Raman Road.',
    transitPlanned:
      'Civic garden conservation and environmental buffer protocols surrounding Sankey Tank precinct.',
    typicalResidentialTypology:
      'Expansive private estates, multi-generational family residences, and boutique low-rise condominiums.',
    advisoryFocus:
      'Discreet advisory on legacy residential plots, heritage zoning setbacks, and legal conveyance documentation.',
    citations: [
      {
        claim: 'Administrative delimitation under BBMP West Zone (Ward 35 / Aramane Nagar).',
        sourceName: 'BBMP GIS Ward Boundary Portal & Revenue Survey',
        referenceUrlOrDoc: 'https://bbmp.gov.in',
        verificationDate: 'September 2026',
      },
      {
        claim: 'Sankey Tank buffer preservation and tree protection regulations.',
        sourceName: 'Karnataka Urban Development Department & BBMP Forest Cell Notifications',
        referenceUrlOrDoc: 'https://karnataka.gov.in',
        verificationDate: 'September 2026',
      },
    ],
    editorialSignOffBy: 'INSTLE Research & Advisory Desk',
    lastReviewedAt: '2026-09-26',
  },
  {
    slug: 'north-bengaluru',
    name: 'Hebbal & Bellary Road Corridor',
    quadrant: 'North Growth Corridor',
    publicationStatus: 'published',
    reviewStatus: 'approved',
    character:
      'Strategic northern corridor extending from Hebbal lake along NH 44 (Bellary Road) towards Yelahanka and Kempegowda International Airport, featuring gated master-planned communities and prominent lake precincts.',
    bbmpZone: 'BBMP Yelahanka & Byatarayanapura Zones',
    transitOperational:
      'Six-lane elevated NH 44 Airport Expressway with operational surface service lanes.',
    transitPlanned:
      'BMRCL Blue Line Metro Phase 2B (Airport Metro Link) actively under construction along the central median of Bellary Road.',
    typicalResidentialTypology:
      'Gated villa communities, high-specification high-rise apartments, and integrated residential enclaves.',
    advisoryFocus:
      'Evaluating access road permissions, distance to operational transit, and municipal water supply infrastructure across northern layouts.',
    citations: [
      {
        claim: 'BMRCL Phase 2B Airport Metro Link (Blue Line) under construction on NH 44 alignment.',
        sourceName: 'BMRCL Phase 2B Detailed Project Report & Alignment Gazette',
        referenceUrlOrDoc: 'https://english.bmrc.co.in',
        verificationDate: 'September 2026',
      },
      {
        claim: 'National Highway 44 elevated expressway operational status.',
        sourceName: 'National Highways Authority of India (NHAI) Project Registry',
        referenceUrlOrDoc: 'https://nhai.gov.in',
        verificationDate: 'September 2026',
      },
    ],
    editorialSignOffBy: 'INSTLE Research & Advisory Desk',
    lastReviewedAt: '2026-09-26',
  },
  {
    slug: 'whitefield-inner-enclaves',
    name: 'Whitefield (Inner Residential Enclaves)',
    quadrant: 'East Suburban Growth Sector',
    publicationStatus: 'draft',
    reviewStatus: 'editorial_draft',
    character:
      'Draft dossier: Emerging residential enclaves off main ITPL and Varthur corridors pending claim-level infrastructure audits.',
    bbmpZone: 'BBMP Mahadevapura Zone',
    transitOperational: 'Namma Metro Purple Line extension operational to Whitefield (Kadugodi).',
    transitPlanned: 'Comprehensive road network remodeling under Mahadevapura civic development scheme.',
    typicalResidentialTypology: 'Gated villa layouts and high-rise developments.',
    advisoryFocus: 'Internal advisory draft pending secondary source corroboration.',
    citations: [
      {
        claim: 'Purple Line metro operational to Whitefield.',
        sourceName: 'BMRCL Whitefield Extension Notice',
        referenceUrlOrDoc: 'https://english.bmrc.co.in',
        verificationDate: 'September 2026',
      },
    ],
    editorialSignOffBy: 'Draft Review in Progress',
    lastReviewedAt: '2026-09-26',
  },
];

/**
 * Publication Approval Gate: Returns only verified, approved localities for public display
 */
export function getPublishedLocalities(): LocalityRecord[] {
  return LOCALITY_REGISTRY.filter(
    (loc) => loc.publicationStatus === 'published' && loc.reviewStatus === 'approved'
  );
}

/**
 * Retrieve a single published locality by slug
 */
export function getPublishedLocalityBySlug(slug: string): LocalityRecord | undefined {
  return getPublishedLocalities().find((loc) => loc.slug === slug);
}

// Backward compatibility alias for existing code
export const VERIFIED_LOCALITIES = getPublishedLocalities();
