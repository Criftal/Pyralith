// Smoke tests: every screen renders (server-side) with no data files, and with a small TEST-ONLY dataset.
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Claim, CitedValue, Meta, Mission, Source } from '../types';
import { DataContext, EMPTY_DATASET, FILE_KEYS, type DataState } from '../lib/data';
import { MissionProvider } from '../lib/mission';
import { WeightsProvider } from '../lib/weights';
import { CiteProvider } from '../components/Cite';
import TopBar from '../components/TopBar';
import Footer from '../components/Footer';
import Hook from '../screens/Hook';
import MissionSelect from '../screens/MissionSelect';
import Investigations from '../screens/Investigations';
import GapMap from '../screens/GapMap';
import Placeholder from '../screens/Placeholder';
import Rank from '../screens/Rank';
import Export from '../screens/Export';
import NextFire from '../screens/NextFire';
import Ask from '../screens/Ask';
import { RedTeamPanel } from '../components/Evidence';
import { makeFinding, makeInvestigation } from '../lib/__tests__/fixtures';

function render(node: ReactNode, state: DataState): string {
  return renderToString(
    <DataContext.Provider value={state}>
      <MissionProvider>
        <WeightsProvider>
          <CiteProvider>{node}</CiteProvider>
        </WeightsProvider>
      </MissionProvider>
    </DataContext.Provider>,
  ).replace(/<!-- -->/g, ''); // React's text-node separators
}

const SCREENS: Array<[string, ReactNode]> = [
  ['TopBar', <TopBar route="/" />],
  ['Footer', <Footer />],
  ['Hook', <Hook />],
  ['MissionSelect', <MissionSelect />],
  ['Investigations', <Investigations />],
  ['GapMap', <GapMap />],
  ['Placeholder', <Placeholder kicker="k" title="t" what="w" />],
  ['Rank', <Rank />],
  ['Export', <Export />],
  ['NextFire', <NextFire />],
  ['Ask', <Ask />],
];

describe('screens with no data files', () => {
  const empty: DataState = { loading: false, data: EMPTY_DATASET, missing: [...FILE_KEYS] };
  it.each(SCREENS)('%s renders without crashing', (_name, node) => {
    expect(() => render(node, empty)).not.toThrow();
  });

  it('never claims zero findings when findings.json is missing', () => {
    const html = render(<GapMap />, empty);
    expect(html).not.toContain('PSI holds');
    expect(html).toContain('public/data/findings.json');
    const hook = render(<Hook />, empty);
    expect(hook).toContain('findings.json not exported yet');
  });

  it('renders while loading', () => {
    const loading: DataState = { loading: true, data: EMPTY_DATASET, missing: [] };
    for (const [, node] of SCREENS) expect(() => render(node, loading)).not.toThrow();
  });
});

// ---- TEST-ONLY synthetic dataset (not real NASA data) ----
const cv = (value: number | null, unit: CitedValue['unit'], qualifier: CitedValue['qualifier'] = 'stated'): CitedValue => ({
  value,
  unit,
  display: value === null ? 'not stated' : `${value} ${unit}`,
  qualifier,
  source_id: 'WEB:test',
  page: 1,
  quote: 'synthetic quote',
  note: null,
});

const missions: Mission[] = [
  { id: 'artemis_habitat', name: 'Test habitat', gravity: cv(0.17, 'g'), o2: cv(34, '%'), pressure: cv(56.5, 'kPa'), flow: null },
  { id: 'iss', name: 'Test station', gravity: cv(0, 'g'), o2: cv(21, '%'), pressure: cv(101.3, 'kPa'), flow: cv(10, 'cm/s', 'about') },
  { id: 'mars_transit', name: 'Test transit', gravity: cv(0, 'g', 'assumed'), o2: null, pressure: null, flow: null },
];

const claim = (id: string, topic: Claim['topic'], label: string | null = null): Claim => ({
  id,
  topic,
  label,
  text: `synthetic ${topic} claim`,
  source_id: 'NTRS:1',
  page: 2,
  quote: 'synthetic quote',
  link: topic === 'incident' ? 'https://example.invalid' : null,
});

const sources: Record<string, Source> = {
  'NTRS:1': { id: 'NTRS:1', kind: 'ntrs', title: 'Synthetic paper', authors: ['A. Author', 'B. Author', 'C. Author'], year: 2026, url: 'https://example.invalid/1', pdf_url: 'https://example.invalid/1.pdf', doc_type: 'Technical Memorandum' },
  'WEB:test': { id: 'WEB:test', kind: 'web', title: 'Synthetic web page', authors: [], year: null, url: 'https://example.invalid/w', pdf_url: null, doc_type: 'Web page' },
};

const meta: Meta = {
  generated_at: '2026-11-15T15:00:00Z',
  verification: { candidates: 5, verified: 4, dropped_quote: 1, dropped_numbers: 0, dropped_schema: 0 },
  counts: { findings: 4, investigations: 2, sources: 2, experiments: 3, claims: 5 },
};

const full: DataState = {
  loading: false,
  missing: [],
  data: {
    findings: [
      makeFinding({ id: 'f1', source_id: 'NTRS:1', psi_id: 'PSI-1', experiment: 'EXP-A', gravity_g: 0, o2_percent: 21, pressure_kpa: 101.3, material: 'PMMA', finding: 'synthetic finding one' }),
      makeFinding({ id: 'f2', source_id: 'NTRS:1', experiment: 'EXP-B', platform: '1g_lab', evidence_tier: 3, gravity_g: 1, o2_percent: 21, material: 'pmma' }),
      makeFinding({ id: 'f3', source_id: 'NTRS:1', experiment: 'EXP-C', platform: 'parabolic', evidence_tier: 2, gravity_g: 0.16, o2_percent: 34, pressure_kpa: 56.5 }),
      makeFinding({ id: 'f4', source_id: 'NTRS:1', psi_id: 'PSI-2', experiment: 'EXP-A', gravity_g: 0, analogue_of_g: 0.17, o2_percent: 34, reported: { gravity: 'microgravity', o2: '34%', pressure: null, flow: null } }),
    ],
    investigations: [
      makeInvestigation({ psi_id: 'PSI-1', acronym: 'INV-A', hardware_group: 'MSG-SPICE-duct', fuel_phase: ['solid'], o2_range_percent: [15, 21], gravity_g: 0, data_files: [{ name: 'PSI-1_Experimental table_A.csv', format: 'csv', url: 'https://example.invalid/a.csv' }, { name: 'Raw Data (1 file)', format: 'folder', url: 'https://example.invalid/raw' }], publications: ['NTRS:1', 'DOI:10.0/x'] }),
      makeInvestigation({ psi_id: 'PSI-2', acronym: 'INV-B', hardware_group: 'ACME-CIR', fuel_phase: ['gas'], gravity_g: 0, safety_area: ['detection'] }),
    ],
    sources,
    missions,
    claims: [claim('c1', 'test1'), claim('c2', 'incident', 'Event (1967)'), claim('c3', 'partial_g_gap'), claim('c4', 'u_shape'), claim('c5', 'future_experiment', 'FUT')],
    meta,
  },
};

describe('screens with a synthetic dataset', () => {
  it.each(SCREENS)('%s renders without crashing', (_name, node) => {
    expect(() => render(node, full)).not.toThrow();
  });

  it('Gap Map shows the partial-g headline, mission marker, bound panel and schematic caption', () => {
    const html = render(<GapMap />, full);
    expect(html).toContain('PSI holds');
    expect(html).toContain('your mission');
    expect(html).toContain('synthetic finding one'); // mission cell panel or bound panel
    expect(html).toContain('Schematic, after Ferkul et al. 2026 / Olson 2004 — not plotted from data');
    expect(html).toContain('Why the Moon may fall outside this range');
  });

  it('Hook computes stats from data', () => {
    const html = render(<Hook />, full);
    expect(html).toContain('verified findings');
    expect(html).toContain('Event (1967)');
    expect(html).toContain('4 verified');
  });

  it('Mission selector lists presets with citations', () => {
    const html = render(<MissionSelect />, full);
    expect(html).toContain('Test habitat');
    expect(html).toContain('Test station');
  });

  it('Investigations lists rows with relevance', () => {
    const html = render(<Investigations />, full);
    expect(html).toContain('PSI-1');
    expect(html).toContain('INV-B');
  });
});

describe('phase 2 screens with the synthetic dataset', () => {
  it('Rank shows the formula, scores and the disabled red-team button', () => {
    const html = render(<Rank />, full);
    expect(html).toContain('score = relevance × tier weight × actionability × (1 + bonus if more flammable than 1 g)');
    expect(html).toContain('Red-team this');
    expect(html).toContain('editorial weights, not physics');
  });

  it('Export lists downloads, the dictionary null rule and PSI experiment tables', () => {
    const html = render(<Export />, full);
    expect(html).toContain('findings.csv');
    expect(html).toContain('data_dictionary.md');
    expect(html).toContain('null = not stated in source; empty cell in CSV.');
    expect(html).toContain('PSI-1_Experimental table_A.csv');
    expect(html).not.toContain('Raw Data (1 file)</a>');
  });

  it('Next fire ranks cells with the formula and cited sections', () => {
    const html = render(<NextFire />, full);
    expect(html).toContain('score = cellRelevance(cell centre → mission)');
    expect(html).toContain('Why it matters');
    expect(html).toContain('Nearest existing evidence');
    expect(html).toContain('Platform that could reach it');
  });

  it('handles a mission with no stated O2 or pressure', () => {
    const transit: DataState = { ...full, data: { ...full.data, missions: [missions[2]] } };
    for (const [, node] of SCREENS) expect(() => render(node, transit)).not.toThrow();
  });
});

describe('phase 3: Ask and red team', () => {
  it('Ask renders the query box and suggested questions', () => {
    const html = render(<Ask />, full);
    expect(html).toContain('Is lunar gravity more flammable than Earth?');
    expect(html).toContain('Does turning off ventilation put out a fire?');
    expect(html).toContain('What do we know above 30% oxygen?');
  });

  it('Red-team panel lists counter-evidence without the target', () => {
    const target = full.data.findings[0];
    const html = render(<RedTeamPanel target={target} scope="t" onClose={() => {}} />, full);
    expect(html).toContain('Counter-evidence retrieved (no AI)');
    expect(html).not.toContain(`id="t-${target.id}"`);
  });
});
