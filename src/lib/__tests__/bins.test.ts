import { describe, expect, it } from 'vitest';
import { binOf, FLOW_BANDS, GRAVITY_BINS, O2_BANDS, PRESSURE_BANDS, UNSTATED } from '../bins';

describe('gravity bins', () => {
  it.each([
    [0, 'ug'],
    [0.049, 'ug'],
    [0.05, 'lunar'],
    [0.165, 'lunar'],
    [0.27, 'mars'],
    [0.38, 'mars'],
    [0.6, 'partial'],
    [0.899, 'partial'],
    [0.9, '1g'],
    [1, '1g'],
    [1.8, '1g'],
  ])('%s g -> %s', (g, key) => {
    expect(binOf(g, GRAVITY_BINS)).toBe(key);
  });

  it('null is unstated, not µg', () => {
    expect(binOf(null, GRAVITY_BINS)).toBe(UNSTATED);
    expect(binOf(undefined, GRAVITY_BINS)).toBe(UNSTATED);
    expect(binOf(Number.NaN, GRAVITY_BINS)).toBe(UNSTATED);
  });
});

describe('O2 bands', () => {
  it.each([
    [18.99, 'o2_lt19'],
    [19, 'o2_19_23'],
    [21, 'o2_19_23'],
    [23, 'o2_23_30'],
    [30, 'o2_30_40'],
    [34, 'o2_30_40'],
    [40, 'o2_40_70'],
    [70, 'o2_70_100'],
    [100, 'o2_70_100'],
  ])('%s%% -> %s', (v, key) => {
    expect(binOf(v, O2_BANDS)).toBe(key);
  });
});

describe('pressure bands', () => {
  it.each([
    [29.6, 'p_lt35'],
    [35, 'p_35_60'],
    [56.5, 'p_35_60'],
    [60, 'p_60_80'],
    [70.3, 'p_60_80'],
    [80, 'p_80_110'],
    [101.3, 'p_80_110'],
    [110, 'p_ge110'],
  ])('%s kPa -> %s', (v, key) => {
    expect(binOf(v, PRESSURE_BANDS)).toBe(key);
  });
});

describe('flow bands', () => {
  it.each([
    [0, 'f_q'],
    [1, 'f_q'],
    [1.0001, 'f_1_5'],
    [4.99, 'f_1_5'],
    [5, 'f_5_15'],
    [15, 'f_15_40'],
    [40, 'f_ge40'],
    [200, 'f_ge40'],
  ])('%s cm/s -> %s', (v, key) => {
    expect(binOf(v, FLOW_BANDS)).toBe(key);
  });
});
