import type { Investigation } from '../types';
import { formatRange, formatValue } from './format';

/** Deterministic side-by-side comparison of PSI investigation records (template text, not AI). */

export interface CompareRow {
  key: string;
  label: string;
  values: string[]; // one per investigation; "—" = not stated
  differs: boolean; // stated values differ between investigations
  mono: boolean;
}

interface Field {
  key: string;
  label: string;
  get: (i: Investigation) => string;
  mono?: boolean;
}

const DASH = '—';
const list = (xs: string[] | null | undefined): string => (xs && xs.length ? xs.join(', ') : DASH);
const str = (v: string | null | undefined): string => (v && v.trim() ? v.trim() : DASH);

const FIELDS: Field[] = [
  { key: 'hardware_group', label: 'Hardware group', get: (i) => i.hardware_group, mono: true },
  { key: 'platform', label: 'Platform', get: (i) => str(i.platform) },
  { key: 'years', label: 'Years', get: (i) => str(i.years), mono: true },
  { key: 'fuel_phase', label: 'Fuel phase', get: (i) => list(i.fuel_phase) },
  { key: 'fuel', label: 'Fuel', get: (i) => str(i.fuel) },
  { key: 'fuel_shape', label: 'Fuel shape', get: (i) => str(i.fuel_shape) },
  { key: 'sample_size', label: 'Sample size', get: (i) => str(i.sample_size) },
  { key: 'gravity', label: 'Gravity', get: (i) => formatValue(i.gravity_g, 'g'), mono: true },
  { key: 'o2', label: 'O₂ range', get: (i) => formatRange(i.o2_range_percent, '%'), mono: true },
  { key: 'pressure', label: 'Pressure range', get: (i) => formatRange(i.pressure_range_kpa, 'kPa'), mono: true },
  { key: 'flow', label: 'Flow range', get: (i) => formatRange(i.flow_range_cm_s, 'cm/s'), mono: true },
  { key: 'variables', label: 'Variables', get: (i) => list(i.variables) },
  { key: 'sensors', label: 'Sensors', get: (i) => list(i.sensors) },
  { key: 'measurement_types', label: 'Measurement types', get: (i) => list(i.measurement_types) },
  { key: 'safety_area', label: 'Safety area', get: (i) => list(i.safety_area) },
  { key: 'data_files', label: 'Data files', get: (i) => String(i.data_files?.length ?? 0), mono: true },
  { key: 'publications', label: 'Publications', get: (i) => String(i.publications?.length ?? 0), mono: true },
];

function makeRow(key: string, label: string, values: string[], mono: boolean): CompareRow {
  const known = values.filter((v) => v !== DASH);
  return { key, label, values, differs: new Set(known).size > 1, mono };
}

export function compareInvestigations(
  invs: Investigation[],
  relevanceOf: (i: Investigation) => number | null,
): { rows: CompareRow[]; summary: string } {
  const rows = FIELDS.map((f) => makeRow(f.key, f.label, invs.map(f.get), Boolean(f.mono)));
  rows.push(
    makeRow(
      'relevance',
      'Relevance to mission',
      invs.map((i) => {
        const r = relevanceOf(i);
        return r === null ? DASH : r.toFixed(2);
      }),
      true,
    ),
  );
  return { rows, summary: summarize(invs, rows) };
}

const clip = (v: string, n = 48): string => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function summarize(invs: Investigation[], rows: CompareRow[]): string {
  const names = invs.map((i) => i.acronym ?? i.psi_id);
  const who = joinNames(names);
  const comparable = rows.filter((r) => !['relevance', 'data_files', 'publications'].includes(r.key));
  const diffs = comparable.filter((r) => r.differs);
  const same = comparable.filter((r) => !r.differs && r.values.every((v) => v !== DASH));
  const unstated = comparable.filter((r) => r.values.some((v) => v === DASH));
  if (diffs.length === 0 && same.length === 0) return `The PSI records for ${who} do not state enough shared attributes to compare.`;
  const parts: string[] = [];
  if (diffs.length) {
    const shown = diffs
      .slice(0, 5)
      .map((r) => `${r.label.toLowerCase()} (${r.values.map((v, i) => `${names[i]}: ${clip(v)}`).join('; ')})`);
    parts.push(
      `${who} differ in ${diffs.length} of ${comparable.length} compared attributes: ${shown.join(', ')}${diffs.length > 5 ? `, and ${diffs.length - 5} more` : ''}.`,
    );
  } else {
    parts.push(`${who} match on every attribute that all of their PSI records state.`);
  }
  if (same.length) parts.push(`They share ${same.slice(0, 4).map((r) => `${r.label.toLowerCase()} (${clip(r.values[0], 32)})`).join(', ')}.`);
  if (unstated.length) {
    parts.push(`Not stated for at least one of them: ${unstated.slice(0, 5).map((r) => r.label.toLowerCase()).join(', ')}${unstated.length > 5 ? ', …' : ''}.`);
  }
  return parts.join(' ');
}
