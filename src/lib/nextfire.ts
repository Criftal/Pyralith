import type { Claim, Finding, Investigation } from '../types';
import { binOf, GRAVITY_BINS, PARTIAL_G_KEYS, ROW_AXES, type Band } from './bins';
import { pickClaims } from './claims';
import { buildCells, cellKey, type Cell } from './grid';
import { DEFAULT_PARAMS, findingConditions, relevance, type MissionConditions, type ScoreParams } from './score';

/**
 * "Where should NASA light the next fire?"
 * score = cellRelevance(cell centre → mission) × 1 / (1 + tier-weighted evidence in the cell)
 * cellRelevance is the same relevance function, restricted to gravity and the selected second axis.
 */

export type NextAxis = 'o2' | 'pressure';

export interface Candidate {
  key: string;
  axis: NextAxis;
  g: Band;
  r: Band;
  cell: Cell | undefined;
  count: number;
  evidence: number; // tier-weighted
  rel: number;
  score: number;
}

export function cellScore(rel: number, evidence: number): number {
  return rel / (1 + Math.max(0, evidence));
}

function axisMission(m: MissionConditions, axis: NextAxis): MissionConditions {
  return { gravity: m.gravity, o2: axis === 'o2' ? m.o2 : null, pressure: axis === 'pressure' ? m.pressure : null, flow: null };
}

export function cellCentre(g: Band, r: Band, axis: NextAxis): MissionConditions {
  return { gravity: g.centre, o2: axis === 'o2' ? r.centre : null, pressure: axis === 'pressure' ? r.centre : null, flow: null };
}

export function rankCells(findings: Finding[], mission: MissionConditions, axis: NextAxis, params: ScoreParams = DEFAULT_PARAMS): Candidate[] {
  const cells = buildCells(findings, axis);
  const m = axisMission(mission, axis);
  const out: Candidate[] = [];
  for (const g of GRAVITY_BINS) {
    for (const r of ROW_AXES[axis].bands) {
      const key = cellKey(g.key, r.key);
      const cell = cells.get(key);
      const evidence = cell?.weight ?? 0;
      const rel = relevance(cellCentre(g, r, axis), m, params).value;
      out.push({ key, axis, g, r, cell, count: cell?.findings.length ?? 0, evidence, rel, score: cellScore(rel, evidence) });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.evidence - b.evidence || a.key.localeCompare(b.key));
}

/** The findings closest to a cell centre. Findings that do not state gravity are not used as "nearest" evidence. */
export function nearestFindings(findings: Finding[], c: Candidate, params: ScoreParams = DEFAULT_PARAMS, n = 2): Array<{ f: Finding; rel: number }> {
  const target = cellCentre(c.g, c.r, c.axis);
  return findings
    .filter((f) => f.gravity_g !== null)
    .map((f) => ({ f, rel: relevance(findingConditions(f), target, params).value }))
    .sort((a, b) => b.rel - a.rel || a.f.evidence_tier - b.f.evidence_tier || a.f.id.localeCompare(b.f.id))
    .slice(0, n);
}

const isPartial = (g: Band) => (PARTIAL_G_KEYS as readonly string[]).includes(g.key);

/** Cited reasons the cell matters, chosen by topic. */
export function whyClaims(claims: Claim[], c: Candidate, offset = 0): Claim[] {
  const picked: Claim[] = [];
  const exclude = new Set<string>();
  const add = (cs: Claim[]) => {
    for (const x of cs) {
      if (!exclude.has(x.id)) {
        picked.push(x);
        exclude.add(x.id);
      }
    }
  };
  if (isPartial(c.g)) {
    const ids = c.g.key === 'lunar' ? ['c_lunar_nearly_most', 'c_u_min_lunar', 'c_partial_g_worse', 'c_a_goldilocks', 'c_u_moon_mechanism'] : ['c_partial_g_worse', 'c_a_not_most_flammable', 'c_u_quench', 'c_u_blowoff'];
    add(pickClaims(claims, { ids, topics: ['lunar_flammability', 'u_shape'], n: 2, offset, exclude }));
  }
  if (c.axis === 'o2' && c.r.min >= 30) {
    add(pickClaims(claims, { ids: ['c_gap_above_30', 'c_moon_atm_band', 'c_a_34_lunar', 'c_ea_fire'], topics: ['high_o2', 'exploration_atmosphere'], n: 1, offset, exclude }));
  }
  if (c.axis === 'pressure' && c.r.max <= 80) {
    add(pickClaims(claims, { ids: ['c_a_constant_ppo2', 'c_eclss_flammability', 'c_ea_fire'], topics: ['exploration_atmosphere'], n: 1, offset, exclude }));
  }
  if (c.g.key === '1g') {
    add(pickClaims(claims, { ids: ['c_test1_not_worst', 'c_a_not_most_flammable', 'c_test1_1g'], topics: ['test1'], n: 1, offset, exclude }));
  }
  if (c.g.key === 'ug' && picked.length === 0) {
    add(pickClaims(claims, { ids: ['c_burn_0g_not_1g', 'c_a_not_most_flammable'], topics: ['test1'], n: 1, offset, exclude }));
  }
  return picked.slice(0, 3);
}

/** Cited platforms that could reach the cell. */
export function platformClaims(claims: Claim[], c: Candidate): Claim[] {
  if (c.g.key === 'lunar') {
    return pickClaims(claims, {
      ids: ['c_fm2', 'c_platform_rocket', 'c_platform_short', 'c_a_parabolic', 'c_a_zgf'],
      topics: ['platform', 'future_experiment'],
      match: /FM2|LUCI|rocket|parabolic|aircraft|drop|centrifuge|CLPS|lander/i,
      n: 3,
    });
  }
  if (c.g.key === 'mars') {
    return pickClaims(claims, {
      ids: ['c_a_kc135', 'c_c_platform_partial_g_parabolic', 'c_platform_short'],
      topics: ['platform'],
      match: /0\.38|Mars|Martian|parabolic|aircraft/i,
      n: 3,
    });
  }
  if (c.g.key === 'partial') {
    return pickClaims(claims, { ids: ['c_c_platform_partial_g_parabolic', 'c_a_parabolic', 'c_a_zgf'], topics: ['platform'], match: /parabolic|aircraft|centrifuge|0\.5/i, n: 3 });
  }
  if (c.g.key === '1g') {
    return pickClaims(claims, { ids: ['c_a_test1_passfail', 'c_a_iss_prebreathe'], topics: ['test1', 'high_o2'], match: /Test 1|tested/i, n: 2 });
  }
  // microgravity
  const highO2 = c.axis === 'o2' && c.r.min >= 23;
  const lowP = c.axis === 'pressure' && c.r.max <= 80;
  if (highO2 || lowP) {
    return pickClaims(claims, {
      ids: ['c_psi20_crew_atmospheres', 'c_cfig_85', 'c_c_platform_cygnus_atmosphere'],
      topics: ['platform', 'high_o2', 'exploration_atmosphere'],
      match: /ACME|CIR|CFI|Cygnus|Saffire|ISS/i,
      n: 3,
    });
  }
  return pickClaims(claims, { ids: ['c_c_platform_cygnus_orbit', 'c_c_platform_cygnus_atmosphere'], topics: ['platform'], match: /Cygnus|Saffire|ISS/i, n: 2 });
}

function overlaps(range: [number, number] | null | undefined, b: Band): boolean {
  if (!range) return false;
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const aboveMin = b.minIncl ? hi >= b.min : hi > b.min;
  const belowMax = b.maxIncl ? lo <= b.max : lo < b.max;
  return aboveMin && belowMax;
}

/** PSI investigations whose recorded range already reaches this cell (same gravity bin, overlapping axis range). */
export function reachingInvestigations(investigations: Investigation[], c: Candidate): Investigation[] {
  return investigations.filter((inv) => {
    if (inv.gravity_g === null || binOf(inv.gravity_g, GRAVITY_BINS) !== c.g.key) return false;
    return overlaps(c.axis === 'o2' ? inv.o2_range_percent : inv.pressure_range_kpa, c.r);
  });
}
