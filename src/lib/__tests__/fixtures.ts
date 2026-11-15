// TEST-ONLY factories. Never imported by app code; values are synthetic and exist only to exercise logic.
import type { Finding, Investigation } from '../../types';

export function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f_test',
    source_id: 'NTRS:0',
    experiment: 'TEST',
    psi_id: null,
    platform: 'ISS',
    gravity_g: null,
    analogue_of_g: null,
    o2_percent: null,
    pressure_kpa: null,
    flow_cm_s: null,
    reported: { gravity: null, o2: null, pressure: null, flow: null },
    material: null,
    finding: 'test',
    finding_type: 'spread_rate',
    direction: 'n/a',
    safety_area: [],
    quote: 'test',
    page: 1,
    evidence_tier: 1,
    verified: true,
    ...overrides,
  };
}

export function makeInvestigation(overrides: Partial<Investigation> = {}): Investigation {
  return {
    psi_id: 'PSI-0',
    name: 'Test investigation',
    acronym: 'TEST',
    doi: null,
    hardware_group: 'other',
    platform: null,
    years: null,
    objectives: null,
    fuel_phase: [],
    fuel: null,
    fuel_shape: null,
    sample_size: null,
    o2_range_percent: null,
    pressure_range_kpa: null,
    flow_range_cm_s: null,
    gravity_g: null,
    variables: [],
    within_investigation_differences: null,
    sensors: [],
    measurement_types: [],
    safety_area: [],
    data_files: [],
    publications: [],
    source_url: 'https://example.invalid',
    ...overrides,
  };
}
