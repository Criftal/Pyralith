/**
 * FIREBREAK data contract: the only interface between the Python pipeline and the UI.
 *
 * Producer: scripts/export.py -> public/data/*.json (served at /data/*.json)
 *   findings.json        Finding[]
 *   investigations.json  Investigation[]
 *   sources.json         Record<string, Source>   (key = source_id)
 *   missions.json        Mission[]
 *   claims.json          Claim[]
 *   meta.json            Meta
 *
 * Rules
 * - null means "the source does not state this". Never render null as 0, never coerce or guess it.
 * - Every Finding, Claim and CitedValue here passed scripts/verify_quotes.py: its quote appears verbatim
 *   (after whitespace/ligature normalisation) on page `page` of `source_id`, and every number in
 *   `reported` appears in that source. Records that fail are dropped, never hand-fixed.
 * - Canonical units: gravity in g (Earth = 1), O2 in % by volume, pressure in kPa, flow in cm/s.
 *   Conversions from the source's own units happen in scripts/normalize.py, never by hand.
 * - Source ids: "NTRS:<id>" | "PSI:<PSI-n>" | "WEB:<slug>". Pages are 1-based; web/PSI sources use page 1.
 */

export type Platform =
  | 'ISS'
  | 'Cygnus'
  | 'Shuttle'
  | 'sounding_rocket'
  | 'parabolic'
  | 'drop_tower'
  | '1g_lab'
  | 'model'
  | 'review';

export type FindingType =
  | 'flammability_limit'
  | 'spread_rate'
  | 'extinction'
  | 'ignition'
  | 'smoke_toxicity'
  | 'smoke_detection'
  | 'suppression'
  | 'test_method'
  | 'design_requirement';

export type Direction = 'more_flammable_than_1g' | 'less_flammable_than_1g' | 'neutral' | 'n/a';
export type SafetyArea = 'prevention' | 'detection' | 'suppression';
/** 1 long-duration flight · 2 short-duration flight (sounding rocket, parabolic, drop tower) · 3 1-g lab · 4 model/review */
export type Tier = 1 | 2 | 3 | 4;
export type HardwareGroup = 'ACME-CIR' | 'MDCA-CIR' | 'MSG-SPICE-duct' | 'other';
export type FuelPhase = 'solid' | 'liquid' | 'gas';

/** Test conditions exactly as the source words them, before unit conversion. */
export interface Reported {
  gravity: string | null; // "microgravity", "lunar gravity", "0.16 g", "normal gravity"
  o2: string | null; // "34% O2", "21 %"
  pressure: string | null; // "8.2 psia", "1 atm", "70 kPa"
  flow: string | null; // "20 cm/s", "quiescent"
}

export interface Finding {
  id: string; // "f_0001"
  source_id: string;
  experiment: string; // canonical short name: "BASS-II", "Saffire-II", "FLEX-2", "E-FIELD Flames", "FM2", "Test 1", "other"
  psi_id: string | null; // PSI investigation whose data this finding reports, if any
  platform: Platform;
  gravity_g: number | null; // actual gravity during the test (microgravity -> 0)
  analogue_of_g: number | null; // gravity level an analogue technique mimicked (e.g. E-FIELD), else null
  o2_percent: number | null;
  pressure_kpa: number | null;
  flow_cm_s: number | null;
  reported: Reported;
  material: string | null;
  finding: string; // <=30 words, AI-written plain-English paraphrase (the quote is the evidence)
  finding_type: FindingType;
  direction: Direction;
  safety_area: SafetyArea[]; // may be empty
  quote: string; // verbatim, <=40 words
  page: number;
  evidence_tier: Tier;
  verified: true; // only verified records are exported
}

export interface DataFile {
  name: string;
  format: string | null;
  url: string;
}

/** One PSI investigation. Attributes come from the PSI record (source_url); safety_area is FIREBREAK's classification. */
export interface Investigation {
  psi_id: string; // "PSI-25"
  name: string;
  acronym: string | null;
  doi: string | null;
  hardware_group: HardwareGroup;
  platform: string | null; // "ISS", "Cygnus", ...
  years: string | null; // "2012-2014"
  objectives: string | null; // verbatim from PSI
  fuel_phase: FuelPhase[];
  fuel: string | null;
  fuel_shape: string | null; // "rod", "sheet", "droplet", "burner", ...
  sample_size: string | null;
  o2_range_percent: [number, number] | null;
  pressure_range_kpa: [number, number] | null;
  flow_range_cm_s: [number, number] | null;
  gravity_g: number | null;
  variables: string[];
  within_investigation_differences: string | null;
  sensors: string[];
  measurement_types: string[];
  safety_area: SafetyArea[];
  data_files: DataFile[];
  publications: string[]; // "NTRS:<id>" | "DOI:<doi>"
  source_url: string;
}

export interface Source {
  id: string;
  kind: 'ntrs' | 'psi' | 'web';
  title: string;
  authors: string[];
  year: number | null;
  url: string; // landing page a human can open
  pdf_url: string | null;
  doc_type: string | null; // "Technical Memorandum", "Conference Paper", "Web page", ...
}

export type MissionId =
  | 'iss'
  | 'artemis_habitat'
  | 'pressurized_rover'
  | 'eva_suit'
  | 'mars_transit'
  | 'mars_habitat';

/** A mission-environment value with the verified quote it comes from. */
export interface CitedValue {
  value: number | null; // canonical unit; null if no source states it
  unit: 'g' | '%' | 'kPa' | 'cm/s';
  display: string; // as shown in the UI, e.g. "8.2 psia (56.5 kPa)"
  qualifier: 'stated' | 'about' | 'at_least' | 'at_most' | 'assumed';
  source_id: string;
  page: number;
  quote: string;
  note: string | null; // e.g. "Assumed same as the Exploration Atmosphere; no source gives a Mars value"
}

export interface Mission {
  id: MissionId;
  name: string;
  gravity: CitedValue;
  o2: CitedValue | null; // null: no source in the corpus states it (e.g. the Mars transit cabin)
  pressure: CitedValue | null;
  flow: CitedValue | null;
}

export type ClaimTopic =
  | 'test1'
  | 'u_shape'
  | 'lunar_flammability'
  | 'partial_g_gap'
  | 'exploration_atmosphere'
  | 'high_o2'
  | 'future_experiment'
  | 'platform'
  | 'incident'
  | 'context';

/** A cited statement used in UI copy (hook, warning cards, incident strip, next-fire reasons). */
export interface Claim {
  id: string; // "c_test1_not_conservative"
  topic: ClaimTopic;
  label: string | null; // short title, e.g. "Apollo 1 (1967)", "FM2"
  text: string; // our <=30-word paraphrase
  source_id: string;
  page: number;
  quote: string; // verbatim, <=40 words
  link: string | null; // page to open, e.g. the NASA incident page
}

export interface Meta {
  generated_at: string; // ISO timestamp
  verification: {
    candidates: number; // records submitted to the verifier
    verified: number;
    dropped_quote: number; // quote not found on the cited page
    dropped_numbers: number; // a reported condition number not found in the source
    dropped_schema: number; // malformed record
  };
  counts: {
    findings: number;
    investigations: number;
    sources: number;
    experiments: number;
    claims: number;
  };
}
