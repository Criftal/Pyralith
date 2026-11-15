import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, decisionValue, DIMS, gapTo, relevance, type Conditions, type MissionConditions } from '../score';
import { makeFinding } from './fixtures';

const mission: MissionConditions = { gravity: 0.17, o2: 34, pressure: 56.5, flow: 10 };
const exact: Conditions = { gravity: 0.17, o2: 34, pressure: 56.5, flow: 10 };

describe('relevance', () => {
  it('is exactly 1 at zero gap with no unknown dimensions', () => {
    expect(relevance(exact, mission).value).toBe(1);
  });

  it.each(DIMS)('strictly decreases as the %s gap grows', (dim) => {
    const step = DEFAULT_PARAMS.scales[dim] / 4;
    let prev = Infinity;
    for (let k = 0; k <= 12; k++) {
      const item: Conditions = { ...exact, [dim]: (mission[dim] as number) + k * step };
      const v = relevance(item, mission).value;
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  it('never treats null as 0', () => {
    const m0: MissionConditions = { gravity: 0, o2: 21, pressure: 101.3, flow: 0 };
    const base: Conditions = { gravity: 0, o2: 21, pressure: 101.3, flow: 0 };
    const withNull = relevance({ ...base, flow: null }, m0);
    const withZero = relevance({ ...base, flow: 0 }, m0);
    expect(withNull.value).not.toBe(withZero.value);
    expect(withNull.unknownCount).toBe(1);
    expect(withNull.value).toBeCloseTo(DEFAULT_PARAMS.unknownPenalty, 10);

    const nullO2 = relevance({ ...exact, o2: null }, mission).value;
    const zeroO2 = relevance({ ...exact, o2: 0 }, mission).value;
    expect(nullO2).not.toBe(zeroO2);
  });

  it('has zero distance inside a range', () => {
    expect(gapTo([15, 40], 34)).toBe(0);
    expect(relevance({ ...exact, o2: [15, 40] }, mission).value).toBe(1);
    expect(gapTo([15, 30], 34)).toBe(4);
    expect(gapTo([40, 50], 34)).toBe(6);
    expect(gapTo(null, 34)).toBeNull();
  });

  it('skips dimensions the mission does not state', () => {
    const r = relevance({ ...exact, flow: null }, { ...mission, flow: null });
    expect(r.value).toBe(1);
    expect(r.unknownCount).toBe(0);
    expect(r.terms.find((t) => t.dim === 'flow')?.status).toBe('skipped');
  });
});

describe('decisionValue', () => {
  it('multiplies relevance, tier weight, actionability and the direction bonus', () => {
    const f = makeFinding({ gravity_g: 0.17, o2_percent: 34, pressure_kpa: 56.5, flow_cm_s: 10, evidence_tier: 2, finding_type: 'flammability_limit' });
    const plain = decisionValue(f, mission);
    expect(plain.value).toBeCloseTo(1 * 0.6 * 1, 10);
    const more = decisionValue({ ...f, direction: 'more_flammable_than_1g' }, mission);
    expect(more.value).toBeCloseTo(plain.value * 1.5, 10);
    expect(more.directionFactor).toBe(1.5);
  });

  it('ranks long-duration flight above a model at equal relevance', () => {
    const base = makeFinding({ gravity_g: 0.17, o2_percent: 34, pressure_kpa: 56.5, flow_cm_s: 10 });
    expect(decisionValue({ ...base, evidence_tier: 1 }, mission).value).toBeGreaterThan(decisionValue({ ...base, evidence_tier: 4 }, mission).value);
  });
});
