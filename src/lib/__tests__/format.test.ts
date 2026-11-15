import { describe, expect, it } from 'vitest';
import { citedDisplay, citedShort, formatNumber, formatPct, formatRange, formatValue, sourceLabel } from '../format';
import type { CitedValue } from '../../types';

describe('formatValue', () => {
  it('renders null, undefined and NaN as an em dash, never 0', () => {
    expect(formatValue(null, 'kPa')).toBe('—');
    expect(formatValue(undefined, '%')).toBe('—');
    expect(formatValue(Number.NaN, 'g')).toBe('—');
    expect(formatValue(null)).not.toContain('0');
  });

  it('renders a real zero as 0 with its unit', () => {
    expect(formatValue(0, 'g')).toBe('0 g');
  });

  it('formats units', () => {
    expect(formatValue(0.17, 'g')).toBe('0.17 g');
    expect(formatValue(34, '%')).toBe('34%');
    expect(formatValue(56.5, 'kPa')).toBe('56.5 kPa');
    expect(formatValue(20, 'cm/s')).toBe('20 cm/s');
  });

  it('never collapses a tiny non-zero value to 0', () => {
    expect(formatNumber(0.0001)).not.toBe('0');
    expect(formatValue(0.004, 'g')).toBe('0.004 g');
  });
});

describe('formatRange', () => {
  it('handles null and degenerate ranges', () => {
    expect(formatRange(null, '%')).toBe('—');
    expect(formatRange([21, 21], '%')).toBe('21%');
    expect(formatRange([15, 30], '%')).toBe('15–30%');
    expect(formatRange([50, 101.3], 'kPa')).toBe('50–101.3 kPa');
  });
});

describe('formatPct', () => {
  it('distinguishes unknown, zero and small shares', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(0.004)).toBe('<1%');
    expect(formatPct(0.256)).toBe('26%');
  });
});

describe('cited values', () => {
  const cv = (over: Partial<CitedValue>): CitedValue => ({
    value: 30,
    unit: '%',
    display: '30%',
    qualifier: 'at_least',
    source_id: 'WEB:x',
    page: 1,
    quote: 'q',
    note: null,
    ...over,
  });
  it('prefixes qualifiers once', () => {
    expect(citedShort(cv({}))).toBe('≥30% O₂');
    expect(citedDisplay(cv({}))).toBe('≥30%');
    expect(citedDisplay(cv({ display: '≥30% O2' }))).toBe('≥30% O2');
    expect(citedShort(cv({ value: null }))).toBe('—');
  });
});

describe('sourceLabel', () => {
  it('labels NTRS and PSI ids', () => {
    expect(sourceLabel('NTRS:20040084156')).toBe('NTRS 20040084156');
    expect(sourceLabel('PSI:PSI-25')).toBe('PSI-25');
    expect(sourceLabel('WEB:brief')).toBe('brief');
  });
});
