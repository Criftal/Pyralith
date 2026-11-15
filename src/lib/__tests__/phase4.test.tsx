import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cellReadout, buildCells, cellKey } from '../grid';
import { activePanel } from '../../components/landing/ConditionSpace';
import { sub2 } from '../../components/Typo';
import { makeFinding } from './fixtures';

describe('Gap Map readout', () => {
  const cells = buildCells([makeFinding({ gravity_g: 0.16, o2_percent: 34, pressure_kpa: 56.5, flow_cm_s: 10 })], 'o2');
  it('reads as a clean mono line for each axis', () => {
    expect(cellReadout('lunar', 'o2_30_40', 'o2', cells.get(cellKey('lunar', 'o2_30_40')))).toBe('Lunar · 0.05–0.27 g × 30–40% O₂ · 1 verified finding');
    expect(cellReadout('lunar', 'p_35_60', 'pressure', undefined)).toBe('Lunar · 0.05–0.27 g × 35–60 kPa · 0 verified findings');
    expect(cellReadout('ug', 'f_5_15', 'flow', undefined)).toBe('µg · <0.05 g × 5–15 cm/s · 0 verified findings');
    expect(cellReadout('unstated', 'unstated', 'o2', undefined)).toBe('Unstated gravity × O₂ not stated · 0 verified findings');
  });
});

describe('scroll-scene chapters', () => {
  it('activates exactly one chapter per range and none in the hero or preview', () => {
    expect(activePanel(0)).toBe(-1);
    expect(activePanel(0.079)).toBe(-1);
    expect(activePanel(0.08)).toBe(0);
    expect(activePanel(0.239)).toBe(0);
    expect(activePanel(0.24)).toBe(1);
    expect(activePanel(0.5)).toBe(2);
    expect(activePanel(0.87)).toBe(4);
    expect(activePanel(0.88)).toBe(-1);
    expect(activePanel(1)).toBe(-1);
  });
});

describe('serif subscript two', () => {
  it('renders ₂ as a sized <sub> in Newsreader contexts', () => {
    const html = renderToString(<span>{sub2('30–40% O₂ at 56.5 kPa')}</span>);
    expect(html).toContain('O<sub class="sub2">2</sub>');
    expect(html).not.toContain('₂');
    expect(sub2('no subscript here')).toBe('no subscript here');
  });
});
