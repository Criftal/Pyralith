import { describe, expect, it } from 'vitest';
import type { Claim } from '../../types';
import { csvCell, FINDING_COLUMNS, findingRow, INVESTIGATION_COLUMNS, investigationRow, toCsv, DATA_DICTIONARY, dictionaryMarkdown } from '../exporters';
import { cellScore, rankCells, nearestFindings, whyClaims, platformClaims } from '../nextfire';
import { pickClaims, futureClaims } from '../claims';
import { relevance, type MissionConditions } from '../score';
import { makeFinding, makeInvestigation } from './fixtures';

describe('CSV export', () => {
  it('writes null and undefined as an empty cell, never 0', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(56.54)).toBe('56.54');
  });

  it('quotes and escapes text, joins arrays with semicolons', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(['prevention', 'detection'])).toBe('prevention;detection');
    expect(csvCell([])).toBe('');
    expect(csvCell(true)).toBe('true');
  });

  it('keeps unstated conditions empty in a findings row', () => {
    const f = makeFinding({ gravity_g: 0, o2_percent: null, pressure_kpa: null, flow_cm_s: 0, safety_area: ['prevention'] });
    const row = findingRow(f, {}, null);
    const csv = toCsv(FINDING_COLUMNS, [row]);
    const [header, line] = csv.trim().split('\n');
    const cells = line.split(',');
    const col = (name: string) => cells[header.split(',').indexOf(name)];
    expect(col('gravity_g')).toBe('0');
    expect(col('o2_percent')).toBe('');
    expect(col('pressure_kpa')).toBe('');
    expect(col('flow_cm_s')).toBe('0');
    expect(col('relevance_to_mission')).toBe('');
    expect(col('quote_verified')).toBe('true');
    expect(header.split(',')).toEqual([...FINDING_COLUMNS]);
  });

  it('splits investigation ranges into min/max columns with empty cells for unknown ranges', () => {
    const inv = makeInvestigation({ o2_range_percent: [21, 13.6], pressure_range_kpa: null, data_files: [{ name: 'PSI-0_Experimental table_X.csv', format: 'csv', url: 'u' }, { name: 'Raw Data', format: 'folder', url: 'v' }] });
    const row = investigationRow(inv, 0.5);
    expect(row.o2_min_percent).toBe(13.6);
    expect(row.o2_max_percent).toBe(21);
    expect(row.pressure_min_kpa).toBeNull();
    expect(row.data_files).toBe(2);
    expect(row.experiment_tables).toEqual(['PSI-0_Experimental table_X.csv']);
    const csv = toCsv(INVESTIGATION_COLUMNS, [row]);
    expect(csv).toContain(',13.6,21,,');
  });

  it('documents every exported column, including the null rule', () => {
    for (const c of FINDING_COLUMNS) expect(DATA_DICTIONARY.some((d) => d.file === 'findings' && d.column === c)).toBe(true);
    for (const c of INVESTIGATION_COLUMNS) expect(DATA_DICTIONARY.some((d) => d.file === 'investigations' && d.column === c)).toBe(true);
    expect(dictionaryMarkdown()).toContain('null = not stated in source; empty cell in CSV');
  });
});

describe('next fire ranking', () => {
  it('ranks an empty cell above a full one at equal relevance', () => {
    expect(cellScore(0.8, 0)).toBeGreaterThan(cellScore(0.8, 2));
    // Mission states gravity only, so every O2 row in the µg column has the same relevance.
    const mission: MissionConditions = { gravity: 0, o2: null, pressure: null, flow: null };
    const findings = [makeFinding({ id: 'a', gravity_g: 0, o2_percent: 21 }), makeFinding({ id: 'b', gravity_g: 0, o2_percent: 21, evidence_tier: 2 })];
    const ranked = rankCells(findings, mission, 'o2');
    const full = ranked.find((c) => c.key === 'ug|o2_19_23')!;
    const empty = ranked.find((c) => c.key === 'ug|o2_30_40')!;
    expect(full.rel).toBeCloseTo(empty.rel, 12);
    expect(full.evidence).toBeCloseTo(1.6, 12);
    expect(ranked.indexOf(empty)).toBeLessThan(ranked.indexOf(full));
    expect(empty.score).toBeGreaterThan(full.score);
  });

  it('puts the mission’s own empty cell first', () => {
    const mission: MissionConditions = { gravity: 0.17, o2: 34, pressure: 56.5, flow: null };
    const ranked = rankCells([makeFinding({ gravity_g: 0, o2_percent: 21 })], mission, 'o2');
    expect(ranked[0].key).toBe('lunar|o2_30_40');
    expect(ranked[0].count).toBe(0);
  });

  it('never uses findings without a stated gravity as nearest evidence', () => {
    const mission: MissionConditions = { gravity: 0.17, o2: 34, pressure: null, flow: null };
    const c = rankCells([], mission, 'o2')[0];
    const near = nearestFindings([makeFinding({ id: 'nog', gravity_g: null, o2_percent: 35 }), makeFinding({ id: 'ug', gravity_g: 0, o2_percent: 34 })], c);
    expect(near.map((x) => x.f.id)).toEqual(['ug']);
  });

  it('chooses reasons and platforms by topic', () => {
    const cl = (id: string, topic: Claim['topic'], label: string, text = label): Claim => ({ id, topic, label, text, source_id: 'X:1', page: 1, quote: 'q', link: null });
    const claims = [
      cl('c_lunar_nearly_most', 'lunar_flammability', 'Nearly the most flammable'),
      cl('c_u_min_lunar', 'u_shape', 'Minimum near lunar g'),
      cl('c_gap_above_30', 'high_o2', 'Data gap above 30% O2'),
      cl('c_test1_not_worst', 'test1', 'Olson 2004'),
      cl('c_fm2', 'future_experiment', 'FM2'),
      cl('c_platform_rocket', 'platform', 'Rotating sounding rocket', 'about 150 s'),
    ];
    const mission: MissionConditions = { gravity: 0.17, o2: 34, pressure: null, flow: null };
    const lunar = rankCells([], mission, 'o2')[0];
    expect(whyClaims(claims, lunar).map((c) => c.id)).toEqual(['c_lunar_nearly_most', 'c_u_min_lunar', 'c_gap_above_30']);
    expect(platformClaims(claims, lunar).map((c) => c.id)).toEqual(['c_fm2', 'c_platform_rocket']);
    const oneG = rankCells([], { gravity: 1, o2: 21, pressure: null, flow: null }, 'o2')[0];
    expect(whyClaims(claims, oneG).map((c) => c.id)).toEqual(['c_test1_not_worst']);
  });
});

describe('claim picking', () => {
  const mk = (id: string, topic: Claim['topic'], label: string | null = null): Claim => ({ id, topic, label, text: id, source_id: 'X:1', page: 1, quote: 'q', link: null });
  it('prefers listed ids and falls back to the topic when they are missing', () => {
    const claims = [mk('a', 'test1'), mk('b', 'test1'), mk('pref', 'test1')];
    expect(pickClaims(claims, { ids: ['pref', 'gone'], topics: ['test1'], n: 2 }).map((c) => c.id)).toEqual(['pref', 'a']);
    expect(pickClaims(claims, { ids: ['gone'], topics: ['test1'], n: 1 }).map((c) => c.id)).toEqual(['a']);
  });
  it('returns only listed ids when no topic or match is given', () => {
    const claims = [mk('a', 'context'), mk('b', 'test1')];
    expect(pickClaims(claims, { ids: ['c_brief_bound'], n: 1 })).toEqual([]);
    expect(pickClaims(claims, { ids: ['b'], n: 2 }).map((c) => c.id)).toEqual(['b']);
  });
  it('falls back to flagged labels for future data', () => {
    const claims = [mk('x', 'future_experiment', 'LUCI'), mk('y', 'future_experiment', 'FM2 launch'), mk('z', 'future_experiment', 'LUCI & FM2')];
    expect(futureClaims(claims, 3).map((c) => c.id)).toEqual(['z', 'y', 'x']);
  });
});

describe('relevance with a mission that states no atmosphere', () => {
  it('ignores dimensions the mission leaves null', () => {
    const r = relevance({ gravity: 0, o2: 21, pressure: 101, flow: null }, { gravity: 0, o2: null, pressure: null, flow: null });
    expect(r.value).toBe(1);
    expect(r.terms.filter((t) => t.status === 'skipped').length).toBe(3);
  });
});
