import type { CitedValue, Source } from '../types';

export type Unit = 'g' | '%' | 'kPa' | 'cm/s';

/** Collapse runs of whitespace (PDF extraction leaves stray double spaces and line breaks). */
export function tidy(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** Compact, honest number formatting: integers stay integers, tiny non-zero values never collapse to "0". */
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const abs = Math.abs(n);
  if (abs > 0 && abs < 0.01) return String(Number(n.toPrecision(2)));
  const digits = abs < 1 ? 3 : abs < 10 ? 2 : 1;
  return String(Number(n.toFixed(digits)));
}

/** null / undefined / NaN render as an em dash, never as 0. */
export function formatValue(v: number | null | undefined, unit?: Unit): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = formatNumber(v);
  switch (unit) {
    case 'g':
      return `${s} g`;
    case '%':
      return `${s}%`;
    case 'kPa':
      return `${s} kPa`;
    case 'cm/s':
      return `${s} cm/s`;
    default:
      return s;
  }
}

export function formatRange(r: [number, number] | null | undefined, unit?: Unit): string {
  if (!r || r.length !== 2 || r.some((x) => x === null || x === undefined || Number.isNaN(x))) return '—';
  const [a, b] = r;
  if (a === b) return formatValue(a, unit);
  const sa = formatNumber(a);
  const sb = formatNumber(b);
  if (unit === '%') return `${sa}–${sb}%`;
  return unit ? `${sa}–${sb} ${unit}` : `${sa}–${sb}`;
}

export function formatPct(fraction: number | null): string {
  if (fraction === null || Number.isNaN(fraction)) return '—';
  const p = fraction * 100;
  if (p > 0 && p < 1) return '<1%';
  return `${Math.round(p)}%`;
}

const QUALIFIER_SYMBOL: Record<CitedValue['qualifier'], string> = {
  stated: '',
  about: '≈',
  at_least: '≥',
  at_most: '≤',
  assumed: '',
};

export function qualifierSymbol(q: CitedValue['qualifier']): string {
  return QUALIFIER_SYMBOL[q] ?? '';
}

/** Short value for the top bar, e.g. "≥30% O₂". */
export function citedShort(v: CitedValue): string {
  const base = formatValue(v.value, v.unit);
  if (base === '—') return '—';
  return `${qualifierSymbol(v.qualifier)}${base}${v.unit === '%' ? ' O₂' : ''}`;
}

/** Full display string with the qualifier prefixed unless the display already carries it. */
export function citedDisplay(v: CitedValue): string {
  const sym = qualifierSymbol(v.qualifier);
  const d = (v.display ?? '').trim();
  if (!d) return citedShort(v);
  if (!sym || /^(≈|≥|≤|~|about|at least|at most|up to)/i.test(d)) return d;
  return `${sym}${d}`;
}

export function sourceLabel(id: string, sources?: Record<string, Source>): string {
  const [kind, rest] = splitSourceId(id);
  if (kind === 'NTRS') return `NTRS ${rest}`;
  if (kind === 'PSI') return rest;
  const s = sources?.[id];
  if (s?.title) return s.title.length > 30 ? `${s.title.slice(0, 28).trimEnd()}…` : s.title;
  return rest || id;
}

function splitSourceId(id: string): [string, string] {
  const i = id.indexOf(':');
  return i === -1 ? ['', id] : [id.slice(0, i), id.slice(i + 1)];
}

export function pdfPageUrl(source: Source | undefined, page: number): string | null {
  if (!source?.pdf_url) return null;
  return `${source.pdf_url}#page=${page}`;
}

export function authorsShort(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) return '';
  if (authors.length <= 2) return authors.join(' & ');
  return `${authors[0]} et al.`;
}
