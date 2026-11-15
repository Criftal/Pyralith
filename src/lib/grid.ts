import type { Finding, Mission } from '../types';
import { GRAVITY_BINS, ROW_AXES, UNSTATED, binOf, type RowAxis } from './bins';

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

/** Clean mono readout for a Gap Map cell, e.g. "Lunar · 0.05–0.27 g × 30–40% O₂ · 0 verified findings". */
export function cellReadout(col: string | null, row: string | null, axis: RowAxis, cell: Cell | undefined): string {
  const g = GRAVITY_BINS.find((b) => b.key === col);
  const colPart = col === UNSTATED || !g ? 'Unstated gravity' : `${g.label} · ${g.sub}`;
  const r = ROW_AXES[axis].bands.find((b) => b.key === row);
  const notStated = axis === 'o2' ? 'O₂ not stated' : axis === 'pressure' ? 'pressure not stated' : 'flow not stated';
  const rowPart = row === UNSTATED || !r ? notStated : axis === 'o2' ? `${r.label} O₂` : r.label;
  const n = cell?.findings.length ?? 0;
  const a = cell?.analogues.length ?? 0;
  return `${colPart} × ${rowPart} · ${n} verified finding${n === 1 ? '' : 's'}${a > 0 ? ` · ${a} analogue` : ''}`;
}
