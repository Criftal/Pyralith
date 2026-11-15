import { describe, expect, it } from 'vitest';
import { artemisLikeShare, distinctExperiments, materialsWithBothBounds, partialGStats } from '../stats';
import { buildCells, cellKey } from '../grid';
import { compareInvestigations } from '../compare';
import { makeFinding, makeInvestigation } from './fixtures';

describe('artemisLikeShare', () => {
  it('counts only findings that state both O2 and pressure inside the window', () => {
    const fs = [
      makeFinding({ id: 'a', o2_percent: 34, pressure_kpa: 56.5 }),
      makeFinding({ id: 'b', o2_percent: 34, pressure_kpa: null }), // pressure unknown: not counted
      makeFinding({ id: 'c', o2_percent: 21, pressure_kpa: 101.3 }),
      makeFinding({ id: 'd', o2_percent: 30, pressure_kpa: 70.3 }), // boundary values count
    ];
    const s = artemisLikeShare(fs);
    expect(s.count).toBe(2);
    expect(s.total).toBe(4);
    expect(s.fraction).toBe(0.5);
  });

  it('returns null (not 0) for an empty corpus', () => {
    expect(artemisLikeShare([]).fraction).toBeNull();
  });
});

describe('distinctExperiments', () => {
  it('ignores "other" and blanks', () => {
    const fs = [makeFinding({ experiment: 'BASS-II' }), makeFinding({ experiment: 'other' }), makeFinding({ experiment: 'BASS-II' }), makeFinding({ experiment: 'FLEX' })];
    expect(distinctExperiments(fs)).toEqual(['BASS-II', 'FLEX']);
  });
});

describe('partial gravity and the Gap Map grid', () => {
  const fs = [
    makeFinding({ id: 'psi0', psi_id: 'PSI-1', gravity_g: 0, o2_percent: 21 }),
    makeFinding({ id: 'lunar', gravity_g: 0.16, o2_percent: 21, platform: 'parabolic', evidence_tier: 2 }),
    makeFinding({ id: 'efield', psi_id: 'PSI-2', gravity_g: 0, analogue_of_g: 0.17, o2_percent: 21 }),
  ];

  it('counts PSI vs non-PSI partial-g records and analogues separately', () => {
    const s = partialGStats(fs);
    expect(s.psi).toBe(0);
    expect(s.nonPsi).toBe(1);
    expect(s.analogues).toBe(1);
  });

  it('places analogues as markers in the mimicked column without counting them', () => {
    const cells = buildCells(fs, 'o2');
    const lunar = cells.get(cellKey('lunar', 'o2_19_23'));
    expect(lunar?.findings.map((f) => f.id)).toEqual(['lunar']);
    expect(lunar?.analogues.map((f) => f.id)).toEqual(['efield']);
    expect(lunar?.weight).toBeCloseTo(0.6, 10);
    const ug = cells.get(cellKey('ug', 'o2_19_23'));
    expect(ug?.findings.length).toBe(2);
    expect(ug?.psi).toBe(2);
  });

  it('puts unstated gravity in the unstated column', () => {
    const cells = buildCells([makeFinding({ gravity_g: null, o2_percent: null })], 'o2');
    expect(cells.get(cellKey('unstated', 'unstated'))?.findings.length).toBe(1);
  });
});

describe('materialsWithBothBounds', () => {
  it('requires both a µg and a 1 g finding for the same material', () => {
    const fs = [
      makeFinding({ id: '1', material: 'PMMA', gravity_g: 0 }),
      makeFinding({ id: '2', material: ' pmma ', gravity_g: 1 }),
      makeFinding({ id: '3', material: 'Nomex', gravity_g: 0 }),
    ];
    const m = materialsWithBothBounds(fs);
    expect(m.length).toBe(1);
    expect(m[0].zeroG.map((f) => f.id)).toEqual(['1']);
    expect(m[0].oneG.map((f) => f.id)).toEqual(['2']);
  });
});

describe('compareInvestigations', () => {
  it('flags differences only between stated values', () => {
    const a = makeInvestigation({ psi_id: 'PSI-1', acronym: 'A', hardware_group: 'ACME-CIR', fuel: null });
    const b = makeInvestigation({ psi_id: 'PSI-2', acronym: 'B', hardware_group: 'MDCA-CIR', fuel: 'heptane' });
    const { rows, summary } = compareInvestigations([a, b], () => null);
    expect(rows.find((r) => r.key === 'hardware_group')?.differs).toBe(true);
    expect(rows.find((r) => r.key === 'fuel')?.differs).toBe(false);
    expect(summary).toContain('A and B differ');
    expect(summary).toContain('Not stated for at least one of them');
  });
});
