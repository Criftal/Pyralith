import type { Finding, FindingType, Investigation, Mission, Tier } from '../types';

/**
 * Transparent ranking heuristics. These are editorial weights for sorting evidence, not a physical model of
 * flammability, and the UI says so wherever a score is shown.
 *
 * relevance = exp(-0.5 * Σ_d w_d (gap_d / scale_d)^2) × unknownPenalty^(#dimensions the item does not state)
 *   over dimensions where the mission value is known; gap is |x − m| for a point and the distance from m to
 *   [min, max] for a range (0 inside the range).
 * decisionValue = relevance × tierWeight[tier] × actionability[finding_type] × (1 + bonus if more flammable than 1 g)
 */

export const DIMS = ['gravity', 'o2', 'pressure', 'flow'] as const;
export type Dim = (typeof DIMS)[number];

export const DIM_LABEL: Record<Dim, string> = { gravity: 'gravity', o2: 'O₂', pressure: 'pressure', flow: 'flow' };
export const DIM_UNIT: Record<Dim, 'g' | '%' | 'kPa' | 'cm/s'> = { gravity: 'g', o2: '%', pressure: 'kPa', flow: 'cm/s' };

export type DimValue = number | [number, number] | null;
export type Conditions = Record<Dim, DimValue>;
export type MissionConditions = Record<Dim, number | null>;

export interface ScoreParams {
  scales: Record<Dim, number>;
  weights: Record<Dim, number>;
  unknownPenalty: number;
  tierWeight: Record<Tier, number>;
  actionability: Record<FindingType, number>;
  bonus: number;
}

export const DEFAULT_PARAMS: ScoreParams = {
  scales: { gravity: 0.5, o2: 10, pressure: 30, flow: 10 },
  weights: { gravity: 1, o2: 1, pressure: 1, flow: 1 },
  unknownPenalty: 0.8,
  tierWeight: { 1: 1, 2: 0.6, 3: 0.35, 4: 0.2 },
  actionability: {
    flammability_limit: 1,
    test_method: 1,
    design_requirement: 0.9,
    suppression: 0.9,
    ignition: 0.8,
    extinction: 0.8,
    smoke_detection: 0.8,
    smoke_toxicity: 0.8,
    spread_rate: 0.7,
  },
  bonus: 0.5,
};

/** Distance from mission value m to a point or range; null when the item does not state the value. */
export function gapTo(x: DimValue, m: number): number | null {
  if (x === null || x === undefined) return null;
  if (Array.isArray(x)) {
    const lo = Math.min(x[0], x[1]);
    const hi = Math.max(x[0], x[1]);
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    if (m < lo) return lo - m;
    if (m > hi) return m - hi;
    return 0;
  }
  if (Number.isNaN(x)) return null;
  return Math.abs(x - m);
}

export interface DimTerm {
  dim: Dim;
  mission: number | null;
  item: DimValue;
  status: 'scored' | 'unknown' | 'skipped'; // skipped: mission value unknown or weight 0
  gap: number | null;
  z: number | null;
  scale: number;
  weight: number;
  contribution: number | null; // w * z^2
}

export interface RelevanceResult {
  value: number;
  terms: DimTerm[];
  sumWeightedZ2: number;
  expTerm: number;
  unknownCount: number;
  penaltyFactor: number;
}

export function relevance(item: Conditions, mission: MissionConditions, params: ScoreParams = DEFAULT_PARAMS): RelevanceResult {
  const terms: DimTerm[] = [];
  let sum = 0;
  let unknown = 0;
  for (const dim of DIMS) {
    const m = mission[dim];
    const w = params.weights[dim];
    const x = item[dim];
    if (m === null || m === undefined || Number.isNaN(m) || !(w > 0)) {
      terms.push({ dim, mission: m ?? null, item: x, status: 'skipped', gap: null, z: null, scale: params.scales[dim], weight: w, contribution: null });
      continue;
    }
    const g = gapTo(x, m);
    if (g === null) {
      unknown += 1;
      terms.push({ dim, mission: m, item: x, status: 'unknown', gap: null, z: null, scale: params.scales[dim], weight: w, contribution: null });
      continue;
    }
    const z = g / params.scales[dim];
    const c = w * z * z;
    sum += c;
    terms.push({ dim, mission: m, item: x, status: 'scored', gap: g, z, scale: params.scales[dim], weight: w, contribution: c });
  }
  const expTerm = Math.exp(-0.5 * sum);
  const penaltyFactor = Math.pow(params.unknownPenalty, unknown);
  return { value: expTerm * penaltyFactor, terms, sumWeightedZ2: sum, expTerm, unknownCount: unknown, penaltyFactor };
}

export interface DecisionResult {
  value: number;
  relevance: RelevanceResult;
  tierWeight: number;
  actionability: number;
  directionFactor: number;
}

export function decisionValue(f: Finding, mission: MissionConditions, params: ScoreParams = DEFAULT_PARAMS): DecisionResult {
  const rel = relevance(findingConditions(f), mission, params);
  const tierWeight = params.tierWeight[f.evidence_tier] ?? 0;
  const actionability = params.actionability[f.finding_type] ?? 0;
  const directionFactor = f.direction === 'more_flammable_than_1g' ? 1 + params.bonus : 1;
  return { value: rel.value * tierWeight * actionability * directionFactor, relevance: rel, tierWeight, actionability, directionFactor };
}

export function findingConditions(f: Finding): Conditions {
  return { gravity: f.gravity_g, o2: f.o2_percent, pressure: f.pressure_kpa, flow: f.flow_cm_s };
}

export function investigationConditions(inv: Investigation): Conditions {
  return {
    gravity: inv.gravity_g,
    o2: inv.o2_range_percent ?? null,
    pressure: inv.pressure_range_kpa ?? null,
    flow: inv.flow_range_cm_s ?? null,
  };
}

export function missionConditions(m: Mission | null | undefined): MissionConditions {
  return {
    gravity: m?.gravity?.value ?? null,
    o2: m?.o2?.value ?? null,
    pressure: m?.pressure?.value ?? null,
    flow: m?.flow?.value ?? null,
  };
}

/** One-line human-readable breakdown for tooltips. */
export function describeRelevance(r: RelevanceResult): string {
  const parts = r.terms.map((t) => {
    if (t.status === 'skipped') return `${DIM_LABEL[t.dim]}: not scored`;
    if (t.status === 'unknown') return `${DIM_LABEL[t.dim]}: not stated (×penalty)`;
    return `${DIM_LABEL[t.dim]}: gap ${round(t.gap)} → z ${round(t.z)}`;
  });
  return `relevance ${round(r.value)} = exp(−½·${round(r.sumWeightedZ2)}) × ${round(r.penaltyFactor)} · ${parts.join(' · ')}`;
}

function round(n: number | null): string {
  if (n === null) return '—';
  return String(Number(n.toFixed(3)));
}
