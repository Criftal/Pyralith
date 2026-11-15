import type { Finding, Investigation, Source } from '../types';
import { tidy } from './format';

/**
 * Model-ready exports. Rules: null (not stated in the source) becomes an EMPTY CSV cell and stays null in JSON;
 * it is never written as 0. Numbers are written raw in canonical units (g, % O2, kPa, cm/s).
 */

export type CellValue = string | number | boolean | null | undefined | readonly string[];

export function csvCell(v: CellValue): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return csvCell(v.join(';'));
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, CellValue>>): string {
  const lines = [columns.map(csvCell).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return `${lines.join('\n')}\n`;
}

const round4 = (n: number | null): number | null => (n === null || !Number.isFinite(n) ? null : Number(n.toFixed(4)));

export const FINDING_COLUMNS = [
  'id',
  'source_id',
  'source_title',
  'source_url',
  'page',
  'experiment',
  'psi_id',
  'platform',
  'evidence_tier',
  'gravity_g',
  'analogue_of_g',
  'o2_percent',
  'pressure_kpa',
  'flow_cm_s',
  'reported_gravity',
  'reported_o2',
  'reported_pressure',
  'reported_flow',
  'material',
  'finding_type',
  'direction',
  'safety_area',
  'finding',
  'quote',
  'quote_verified',
  'relevance_to_mission',
] as const;

export type FindingRow = Record<(typeof FINDING_COLUMNS)[number], CellValue>;

export function findingRow(f: Finding, sources: Record<string, Source>, relevanceToMission: number | null): FindingRow {
  const src = sources[f.source_id];
  return {
    id: f.id,
    source_id: f.source_id,
    source_title: src?.title ?? null,
    source_url: src?.url ?? null,
    page: f.page,
    experiment: f.experiment,
    psi_id: f.psi_id,
    platform: f.platform,
    evidence_tier: f.evidence_tier,
    gravity_g: f.gravity_g,
    analogue_of_g: f.analogue_of_g,
    o2_percent: f.o2_percent,
    pressure_kpa: f.pressure_kpa,
    flow_cm_s: f.flow_cm_s,
    reported_gravity: f.reported?.gravity ?? null,
    reported_o2: f.reported?.o2 ?? null,
    reported_pressure: f.reported?.pressure ?? null,
    reported_flow: f.reported?.flow ?? null,
    material: f.material,
    finding_type: f.finding_type,
    direction: f.direction,
    safety_area: f.safety_area ?? [],
    finding: tidy(f.finding),
    quote: tidy(f.quote),
    quote_verified: true,
    relevance_to_mission: round4(relevanceToMission),
  };
}

export const INVESTIGATION_COLUMNS = [
  'psi_id',
  'name',
  'acronym',
  'doi',
  'hardware_group',
  'platform',
  'years',
  'fuel_phase',
  'fuel',
  'fuel_shape',
  'sample_size',
  'gravity_g',
  'o2_min_percent',
  'o2_max_percent',
  'pressure_min_kpa',
  'pressure_max_kpa',
  'flow_min_cm_s',
  'flow_max_cm_s',
  'variables',
  'sensors',
  'measurement_types',
  'safety_area',
  'data_files',
  'experiment_tables',
  'publications',
  'source_url',
  'relevance_to_mission',
] as const;

export type InvestigationRow = Record<(typeof INVESTIGATION_COLUMNS)[number], CellValue>;

const lo = (r: [number, number] | null | undefined): number | null => (r ? Math.min(r[0], r[1]) : null);
const hi = (r: [number, number] | null | undefined): number | null => (r ? Math.max(r[0], r[1]) : null);

/** Data files that are PSI experiment tables (one row per test run). */
export function experimentTables(inv: Investigation) {
  return (inv.data_files ?? []).filter((f) => /experiment(al)?[ _-]?table/i.test(f.name));
}

export function investigationRow(inv: Investigation, relevanceToMission: number | null): InvestigationRow {
  return {
    psi_id: inv.psi_id,
    name: inv.name,
    acronym: inv.acronym,
    doi: inv.doi,
    hardware_group: inv.hardware_group,
    platform: inv.platform,
    years: inv.years,
    fuel_phase: inv.fuel_phase ?? [],
    fuel: inv.fuel,
    fuel_shape: inv.fuel_shape,
    sample_size: inv.sample_size,
    gravity_g: inv.gravity_g,
    o2_min_percent: lo(inv.o2_range_percent),
    o2_max_percent: hi(inv.o2_range_percent),
    pressure_min_kpa: lo(inv.pressure_range_kpa),
    pressure_max_kpa: hi(inv.pressure_range_kpa),
    flow_min_cm_s: lo(inv.flow_range_cm_s),
    flow_max_cm_s: hi(inv.flow_range_cm_s),
    variables: inv.variables ?? [],
    sensors: inv.sensors ?? [],
    measurement_types: inv.measurement_types ?? [],
    safety_area: inv.safety_area ?? [],
    data_files: (inv.data_files ?? []).length,
    experiment_tables: experimentTables(inv).map((f) => f.name),
    publications: inv.publications ?? [],
    source_url: inv.source_url,
    relevance_to_mission: round4(relevanceToMission),
  };
}

export interface DictEntry {
  file: 'findings' | 'investigations';
  column: string;
  unit: string;
  definition: string;
}

const NULL_NOTE = 'null = not stated in source; empty cell in CSV.';

export const DATA_DICTIONARY: DictEntry[] = [
  { file: 'findings', column: 'id', unit: '—', definition: 'FIREBREAK record id.' },
  { file: 'findings', column: 'source_id', unit: '—', definition: 'Source document: NTRS:<id>, PSI:<PSI-n> or WEB:<slug>.' },
  { file: 'findings', column: 'source_title', unit: '—', definition: 'Title of the source document.' },
  { file: 'findings', column: 'source_url', unit: '—', definition: 'Landing page of the source document.' },
  { file: 'findings', column: 'page', unit: 'page', definition: 'Page of the source where the quote was verified (1-based; web and PSI pages use 1).' },
  { file: 'findings', column: 'experiment', unit: '—', definition: 'Experiment or test the finding comes from ("other" when none applies).' },
  { file: 'findings', column: 'psi_id', unit: '—', definition: `PSI investigation whose data the finding reports. ${NULL_NOTE}` },
  { file: 'findings', column: 'platform', unit: '—', definition: 'Test platform: ISS, Cygnus, Shuttle, sounding_rocket, parabolic, drop_tower, 1g_lab, model, review.' },
  { file: 'findings', column: 'evidence_tier', unit: '1–4', definition: '1 long-duration flight · 2 short-duration flight · 3 1-g lab · 4 model/review.' },
  { file: 'findings', column: 'gravity_g', unit: 'g (Earth = 1)', definition: `Actual gravity level of the test; microgravity is recorded as 0. ${NULL_NOTE}` },
  { file: 'findings', column: 'analogue_of_g', unit: 'g (Earth = 1)', definition: `Gravity level an analogue technique mimicked (e.g. an electric field or a 1-g low-stretch rig). ${NULL_NOTE}` },
  { file: 'findings', column: 'o2_percent', unit: '% O2 by volume', definition: `Oxygen concentration of the test atmosphere. ${NULL_NOTE}` },
  { file: 'findings', column: 'pressure_kpa', unit: 'kPa (absolute)', definition: `Total pressure of the test atmosphere. ${NULL_NOTE}` },
  { file: 'findings', column: 'flow_cm_s', unit: 'cm/s', definition: `Imposed or characteristic flow speed. ${NULL_NOTE}` },
  { file: 'findings', column: 'reported_gravity', unit: 'as reported', definition: `Gravity exactly as the source words it, before unit conversion. ${NULL_NOTE}` },
  { file: 'findings', column: 'reported_o2', unit: 'as reported', definition: `Oxygen level exactly as the source words it. ${NULL_NOTE}` },
  { file: 'findings', column: 'reported_pressure', unit: 'as reported', definition: `Pressure exactly as the source words it (e.g. psia, atm). ${NULL_NOTE}` },
  { file: 'findings', column: 'reported_flow', unit: 'as reported', definition: `Flow exactly as the source words it. ${NULL_NOTE}` },
  { file: 'findings', column: 'material', unit: '—', definition: `Material or fuel tested, as named in the source. ${NULL_NOTE}` },
  { file: 'findings', column: 'finding_type', unit: '—', definition: 'flammability_limit, spread_rate, extinction, ignition, smoke_toxicity, smoke_detection, suppression, test_method or design_requirement.' },
  { file: 'findings', column: 'direction', unit: '—', definition: 'more_flammable_than_1g, less_flammable_than_1g, neutral, or n/a.' },
  { file: 'findings', column: 'safety_area', unit: '—', definition: 'prevention / detection / suppression (FIREBREAK classification), semicolon-separated; empty if none.' },
  { file: 'findings', column: 'finding', unit: '—', definition: 'AI-written plain-English summary (≤30 words). The quote is the evidence.' },
  { file: 'findings', column: 'quote', unit: '—', definition: 'Verbatim quote (≤40 words) from the cited page; whitespace collapsed.' },
  { file: 'findings', column: 'quote_verified', unit: 'boolean', definition: 'Always true: only records whose quote was machine-verified on the cited page are exported.' },
  { file: 'findings', column: 'relevance_to_mission', unit: '0–1', definition: 'Ranking heuristic at download time: exp(−½ Σ (gap/scale)²) × penalty^(unstated dimensions) against the selected mission and current weights. Not physics.' },
  { file: 'investigations', column: 'psi_id', unit: '—', definition: 'PSI investigation id.' },
  { file: 'investigations', column: 'name', unit: '—', definition: 'Investigation name from the PSI record.' },
  { file: 'investigations', column: 'acronym', unit: '—', definition: `Short name. ${NULL_NOTE}` },
  { file: 'investigations', column: 'doi', unit: '—', definition: `Dataset DOI. ${NULL_NOTE}` },
  { file: 'investigations', column: 'hardware_group', unit: '—', definition: 'ACME-CIR, MDCA-CIR, MSG-SPICE-duct or other.' },
  { file: 'investigations', column: 'platform', unit: '—', definition: `Flight platform (ISS, Cygnus, …). ${NULL_NOTE}` },
  { file: 'investigations', column: 'years', unit: 'year range', definition: `Operating years. ${NULL_NOTE}` },
  { file: 'investigations', column: 'fuel_phase', unit: '—', definition: 'solid / liquid / gas, semicolon-separated.' },
  { file: 'investigations', column: 'fuel', unit: '—', definition: `Fuel(s). ${NULL_NOTE}` },
  { file: 'investigations', column: 'fuel_shape', unit: '—', definition: `Fuel geometry (rod, sheet, droplet, burner, …). ${NULL_NOTE}` },
  { file: 'investigations', column: 'sample_size', unit: 'as reported', definition: `Sample size as stated by PSI. ${NULL_NOTE}` },
  { file: 'investigations', column: 'gravity_g', unit: 'g (Earth = 1)', definition: `Gravity level of the investigation (microgravity = 0). ${NULL_NOTE}` },
  { file: 'investigations', column: 'o2_min_percent', unit: '% O2 by volume', definition: `Lowest oxygen concentration in the PSI record. ${NULL_NOTE}` },
  { file: 'investigations', column: 'o2_max_percent', unit: '% O2 by volume', definition: `Highest oxygen concentration in the PSI record. ${NULL_NOTE}` },
  { file: 'investigations', column: 'pressure_min_kpa', unit: 'kPa (absolute)', definition: `Lowest total pressure. ${NULL_NOTE}` },
  { file: 'investigations', column: 'pressure_max_kpa', unit: 'kPa (absolute)', definition: `Highest total pressure. ${NULL_NOTE}` },
  { file: 'investigations', column: 'flow_min_cm_s', unit: 'cm/s', definition: `Lowest flow speed. ${NULL_NOTE}` },
  { file: 'investigations', column: 'flow_max_cm_s', unit: 'cm/s', definition: `Highest flow speed. ${NULL_NOTE}` },
  { file: 'investigations', column: 'variables', unit: '—', definition: 'Variables varied in the investigation, semicolon-separated.' },
  { file: 'investigations', column: 'sensors', unit: '—', definition: 'Sensors / diagnostics, semicolon-separated.' },
  { file: 'investigations', column: 'measurement_types', unit: '—', definition: 'Measurement types, semicolon-separated.' },
  { file: 'investigations', column: 'safety_area', unit: '—', definition: 'prevention / detection / suppression (FIREBREAK classification), semicolon-separated.' },
  { file: 'investigations', column: 'data_files', unit: 'count', definition: 'Number of data files and folders listed on the PSI record.' },
  { file: 'investigations', column: 'experiment_tables', unit: '—', definition: 'Names of the PSI experiment-table files (one row per test run), semicolon-separated.' },
  { file: 'investigations', column: 'publications', unit: '—', definition: 'Linked publications: NTRS:<id> or DOI:<doi>, semicolon-separated.' },
  { file: 'investigations', column: 'source_url', unit: '—', definition: 'PSI record URL.' },
  { file: 'investigations', column: 'relevance_to_mission', unit: '0–1', definition: 'Same heuristic as for findings, using the distance from the mission to each stated range (0 inside the range).' },
];

export function dictionaryCsv(): string {
  return toCsv(
    ['file', 'column', 'unit', 'definition'],
    DATA_DICTIONARY.map((d) => ({ file: `${d.file}.csv`, column: d.column, unit: d.unit, definition: d.definition })),
  );
}

export function dictionaryMarkdown(): string {
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const out = [
    '# FIREBREAK data dictionary',
    '',
    'Canonical units: gravity in g (Earth = 1), oxygen in % by volume, pressure in kPa (absolute), flow in cm/s.',
    '',
    '**null = not stated in source; empty cell in CSV.** Missing values are never written as 0.',
    '',
  ];
  for (const file of ['findings', 'investigations'] as const) {
    out.push(`## ${file}.csv`, '', '| column | unit | definition |', '|---|---|---|');
    for (const d of DATA_DICTIONARY.filter((x) => x.file === file)) out.push(`| \`${d.column}\` | ${esc(d.unit)} | ${esc(d.definition)} |`);
    out.push('');
  }
  out.push('Research exploration prototype, not for flight safety decisions.', '');
  return out.join('\n');
}

/** Trigger a client-side download of `text` as `filename`. */
export function download(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
