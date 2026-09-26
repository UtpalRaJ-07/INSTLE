export interface LocalityRecord {
  slug: string;
  name: string;
  quadrant: string;
  character: string;
  bbmpZone: string;
  transitOperational: string;
  transitPlanned: string;
  typicalResidentialTypology: string;
  advisoryFocus: string;
  sources: { title: string; ref: string }[];
  reviewDate: string;
}

export const VERIFIED_LOCALITIES: LocalityRecord[] = [
  {
    slug: 'indiranagar',
    name: 'Indiranagar & Old Airport Road',
    quadrant: 'East Urban Enclave',
    character:
      'Mature residential neighborhood planned in the late 1960s with wide canopy trees, low-rise plots, and adjacent commercial dining corridors on 100ft and 12ft main roads.',
    bbmpZone: 'East Zone (Ward 80 / Hoysala Nagar)',
    transitOperational: 'Namma Metro Purple Line (Indiranagar and CMH Road stations operational)',
    transitPlanned: 'Adjacent arterial corridor upgrades towards Domlur interchange',
    typicalResidentialTypology:
      'Standalone bespoke townhomes, private redevelopment penthouses, and low-density residential floors.',
    advisoryFocus:
      'We evaluate independent plot titles, heritage setbacks, and quiet interior pockets off commercial thoroughfares.',
    sources: [
      { title: 'BBMP East Zone Cadastral Ward Map', ref: 'bbmp.gov.in/maps' },
      { title: 'BMRCL Purple Line Operations Registry', ref: 'bmrc.co.in' },
    ],
    reviewDate: 'September 2026',
  },
  {
    slug: 'koramangala',
    name: 'Koramangala & HSR Layout',
    quadrant: 'South-East Residential Hub',
    character:
      'Established executive residential sector with prominent park-facing plots in 3rd, 4th, and 5th Blocks, balancing residential tranquility with proximity to the Outer Ring Road enterprise corridor.',
    bbmpZone: 'South Zone (Wards 151 & 174)',
    transitOperational: 'Direct road access to Hosur Road, Inner Ring Road, and Silk Board junction',
    transitPlanned: 'Silk Board Multi-Level Transit Interchange & Yellow Line connectivity',
    typicalResidentialTypology:
      'Gated independent villas, corporate executive residences, and low-density residential floors.',
    advisoryFocus:
      'We guide buyers on block-specific acoustic privacy, drainage elevation, and clear-title layout documentation.',
    sources: [
      { title: 'BDA Koramangala Layout Master Plan', ref: 'bdabangalore.org' },
      { title: 'BBMP South Zone Engineering Ward Map', ref: 'bbmp.gov.in/gisviewer' },
    ],
    reviewDate: 'September 2026',
  },
  {
    slug: 'sadashivanagar',
    name: 'Sadashivanagar & Palace Orchards',
    quadrant: 'Central Heritage Belt',
    character:
      'Premier historical residential enclave developed from the erstwhile royal orchards, noted for massive tree cover, ultra-low vehicular throughput, and architectural discretion.',
    bbmpZone: 'West Zone (Ward 35 / Aramane Nagar)',
    transitOperational: 'Immediate access to Sankey Tank, Bellary Road, and Central Business District (15 min)',
    transitPlanned: 'Surrounding civic garden protection precinct enhancements',
    typicalResidentialTypology:
      'Expansive private estates, multi-generational family residences, and boutique low-rise condominiums.',
    advisoryFocus:
      'Discreet representation for legacy properties, heritage zoning clearances, and high-capital private acquisitions.',
    sources: [
      { title: 'BBMP Heritage & Urban Design Precinct Guidelines', ref: 'bbmp.gov.in' },
      { title: 'Karnataka State Archives Cadastral Records', ref: 'karnataka.gov.in' },
    ],
    reviewDate: 'September 2026',
  },
  {
    slug: 'north-bengaluru',
    name: 'Hebbal & Bellary Road Corridor',
    quadrant: 'North Strategic Growth Axis',
    character:
      'High-velocity northern corridor extending from Hebbal flyover through Jakkur and Yelahanka towards Kempegowda International Airport, featuring major lake precincts and gated master-planned communities.',
    bbmpZone: 'Yelahanka & North Zones',
    transitOperational: 'Operational 6-lane elevated NH 44 Airport Expressway',
    transitPlanned: 'BMRCL Blue Line Metro Phase 2B (Airport Link) currently under construction',
    typicalResidentialTypology:
      'Large-footprint luxury lakeview apartments, golf residences, and gated private villa communities.',
    advisoryFocus:
      'Distinguishing between immediately accessible master-planned properties and long-dated speculative developments.',
    sources: [
      { title: 'BMRCL Phase 2B Detailed Project Alignment', ref: 'bmrc.co.in' },
      { title: 'BDA Revised Master Plan 2031 (North Sector)', ref: 'bdabangalore.org' },
    ],
    reviewDate: 'September 2026',
  },
];
