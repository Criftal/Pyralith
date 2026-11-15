import type { Finding, Mission } from '../types';
import { GRAVITY_BINS, ROW_AXES, binOf, type RowAxis } from './bins';

/** Gap Map cell colour weight per evidence tier. */
export const TIER_WEIGHT: Record<number, number> = { 1: 1, 2: 0.6, 3: 0.35, 4: 0.2 };

export interface Cell {
  key: string;
  col: string;
  row: string;
  findings: Finding[]; // real data at this gravity (counted)
  analogues: Finding[]; // findings whose analogue_of_g mimics this column's gravity (not counted)
  weight: number;
  psi: number;
  nonPsi: number;
}

export const cellKey = (col: string, row: string): string => `${col}|${row}`;

export function rowValue(f: Finding, axis: RowAxis): number | null {
  if (axis === 'o2') return f.o2_percent;
  if (axis === 'pressure') return f.pressure_kpa;
  return f.flow_cm_s;
}

export function missionRowValue(m: Mission, axis: RowAxis): number | null {
  if (axis === 'o2') return m.o2?.value ?? null;
  if (axis === 'pressure') return m.pressure?.value ?? null;
  return m.flow?.value ?? null;
}

export function buildCells(findings: Finding[], axis: RowAxis): Map<string, Cell> {
  const bands = ROW_AXES[axis].bands;
  const cells = new Map<string, Cell>();
  const get = (col: string, row: string): Cell => {
    const key = cellKey(col, row);
    let c = cells.get(key);
    if (!c) {
      c = { key, col, row, findings: [], analogues: [], weight: 0, psi: 0, nonPsi: 0 };
      cells.set(key, c);
    }
    return c;
  };
  for (const f of findings) {
    const row = binOf(rowValue(f, axis), bands);
    const c = get(binOf(f.gravity_g, GRAVITY_BINS), row);
    c.findings.push(f);
    c.weight += TIER_WEIGHT[f.evidence_tier] ?? 0;
    if (f.psi_id) c.psi += 1;
    else c.nonPsi += 1;
    if (f.analogue_of_g !== null && f.analogue_of_g !== undefined) {
      get(binOf(f.analogue_of_g, GRAVITY_BINS), row).analogues.push(f);
    }
  }
  return cells;
}
