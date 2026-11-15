import type MiniSearch from 'minisearch';
import type { Claim, Finding } from '../types';
import { binOf, GRAVITY_BINS, O2_BANDS, bandLabel } from './bins';
import { retrieve, type SearchDoc } from './search';
import { normalizeMaterial } from './stats';

/**
 * Keyless red team: deterministic counter-evidence for a target finding. Every item is a verified record;
 * the "reason" line is generated from record fields (material, experiment, direction, conditions), not by AI.
 */

export interface CounterItem {
  id: string;
  kind: 'finding' | 'claim';
  reason: string;
  score: number;
}

const GENERIC = new Set(
  'fabric fabrics film films rod rods sheet sheets sample samples thin thick black white clear material materials spacecraft fuel fuels solid solids cylinder cylinders slab slabs modelled modeled composite various mm cm diameter two sided'.split(' '),
);

export function materialTokens(m: string | null): Set<string> {
  const s = normalizeMaterial(m);
  if (!s) return new Set();
  return new Set(
    s
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !GENERIC.has(t) && !/^\d+$/.test(t)),
  );
}

function experimentFamily(e: string): string | null {
  const s = (e ?? '').trim().toLowerCase();
  if (!s || s === 'other') return null;
  return s.split(/[\s\-/(]+/)[0] || null;
}

const DIRECTION_TEXT: Record<Finding['direction'], string> = {
  more_flammable_than_1g: 'more flammable than at 1 g',
  less_flammable_than_1g: 'less flammable than at 1 g',
  neutral: 'no clear difference from 1 g',
  'n/a': 'no stated direction',
};

const G_LABEL = (g: number | null) => {
  const k = binOf(g, GRAVITY_BINS);
  return GRAVITY_BINS.find((b) => b.key === k)?.label ?? 'unstated g';
};

const CAVEAT = /caveat|counterexample|may not|might not|not always|depend|varies|vary|material-dependent|not all|unknown|uncertain|sparse|limited|small|cannot|not conservative|however|only some|some materials/i;
/** Wording that pushes back directly rather than just qualifying. */
const STRONG = /counterexample|not more flammable|less flammable|did not|does not|no evidence|contrary/i;

export function counterEvidence(
  target: Finding,
  findings: Finding[],
  claims: Claim[],
  index?: MiniSearch<SearchDoc>,
  n = 10,
): CounterItem[] {
  const out = new Map<string, CounterItem>();
  const tMat = normalizeMaterial(target.material);
  const tTok = materialTokens(target.material);
  const tExp = (target.experiment ?? '').trim().toLowerCase();
  const tFam = experimentFamily(target.experiment);
  const tG = binOf(target.gravity_g, GRAVITY_BINS);
  const tO2 = binOf(target.o2_percent, O2_BANDS);
  const directional = target.direction === 'more_flammable_than_1g' || target.direction === 'less_flammable_than_1g';

  for (const f of findings) {
    if (f.id === target.id) continue;
    // Relation to the target: shared material or experiment is required.
    let rel = 0;
    let relText = '';
    const fMat = normalizeMaterial(f.material);
    if (tMat && fMat && tMat === fMat) {
      rel = 3;
      relText = 'same material';
    } else if (tTok.size && [...materialTokens(f.material)].some((t) => tTok.has(t))) {
      rel = 2;
      relText = 'similar material';
    }
    const fExp = (f.experiment ?? '').trim().toLowerCase();
    if (tExp && tExp !== 'other' && fExp === tExp) {
      rel += 2;
      relText = relText ? `${relText}, same experiment` : 'same experiment';
    } else if (tFam && experimentFamily(f.experiment) === tFam) {
      rel += 1;
      relText = relText ? `${relText}, same experiment family` : 'same experiment family';
    }
    if (rel === 0) continue;

    // What makes it counter-evidence: a different direction, or different conditions.
    let counter = 0;
    const why: string[] = [];
    if (f.direction !== target.direction && f.direction !== 'n/a') {
      if (target.direction === 'more_flammable_than_1g' && f.direction === 'less_flammable_than_1g') counter += 5;
      else if (target.direction === 'less_flammable_than_1g' && f.direction === 'more_flammable_than_1g') counter += 5;
      else if (f.direction === 'neutral' && directional) counter += 3;
      else counter += 2;
      why.push(`reported ${DIRECTION_TEXT[f.direction]}`);
    }
    const fG = binOf(f.gravity_g, GRAVITY_BINS);
    if (fG !== 'unstated' && tG !== 'unstated' && fG !== tG) {
      counter += 1.5;
      why.push(`at ${G_LABEL(f.gravity_g)} vs ${G_LABEL(target.gravity_g)}`);
    }
    const fO2 = binOf(f.o2_percent, O2_BANDS);
    if (fO2 !== 'unstated' && tO2 !== 'unstated' && fO2 !== tO2) {
      counter += 1;
      why.push(`at ${bandLabel(fO2, O2_BANDS)} O₂ vs ${bandLabel(tO2, O2_BANDS)}`);
    }
    if (counter === 0) continue;
    const tierBonus = f.evidence_tier === 1 ? 0.5 : f.evidence_tier === 2 ? 0.3 : 0;
    out.set(f.id, { id: f.id, kind: 'finding', reason: `${relText}; ${why.join('; ')}`, score: rel + counter + tierBonus });
  }

  // Claims that qualify the target.
  const topics: Claim['topic'][] = ['u_shape', 'lunar_flammability', 'test1'];
  const claimItems: CounterItem[] = [];
  for (const c of claims) {
    if (!topics.includes(c.topic) || c.id === target.id) continue;
    const text = `${c.label ?? ''} ${c.text}`;
    let s = 0;
    const why: string[] = [];
    if (CAVEAT.test(text)) {
      s += 3;
      if (STRONG.test(text)) s += 3;
      if (/^(caveat|counterexample)/i.test(c.label ?? '')) s += 1;
      why.push(STRONG.test(text) ? 'pushes back on the result' : 'qualifies or limits the result');
    } else if (target.direction !== 'more_flammable_than_1g' && (c.topic === 'lunar_flammability' || c.topic === 'test1')) {
      s += 2;
      why.push('argues reduced gravity can be more flammable');
    }
    if (s === 0) continue;
    const lower = text.toLowerCase();
    if ([...tTok].some((t) => lower.includes(t))) {
      s += 2;
      why.push('mentions the same material');
    }
    claimItems.push({ id: c.id, kind: 'claim', reason: `${c.topic.replace(/_/g, ' ')} claim; ${why.join('; ')}`, score: s });
  }
  claimItems.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  for (const c of claimItems.slice(0, 4)) out.set(c.id, c);

  // Search on the target's material and experiment terms, for anything the rules above missed.
  if (index) {
    // Search on the material/experiment terms; with neither, fall back to the finding's own wording.
    const terms = [target.material ?? '', target.experiment === 'other' ? '' : target.experiment].join(' ').trim();
    const q = terms || target.finding;
    const exclude = new Set([target.id, ...out.keys()]);
    const byId = new Map(findings.map((f) => [f.id, f]));
    for (const h of retrieve(index, q, 8, exclude)) {
      if (h.kind !== 'finding') continue;
      const f = byId.get(h.id);
      if (!f || f.direction === target.direction) continue; // same direction does not argue against it
      out.set(h.id, { id: h.id, kind: 'finding', reason: `${terms ? `related by search on “${terms}”` : 'related by search on its wording'}; reported ${DIRECTION_TEXT[f.direction]}`, score: 0.5 });
    }
  }

  out.delete(target.id);
  const ranked = [...out.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.slice(0, n);
}
