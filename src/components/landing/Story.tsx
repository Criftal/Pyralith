import type { ReactNode } from 'react';
import type { Claim, CitedValue, Finding, Mission } from '../../types';
import { useData } from '../../lib/data';
import { useMission } from '../../lib/mission';
import { pickClaims } from '../../lib/claims';
import { binOf, GRAVITY_BINS, O2_BANDS } from '../../lib/bins';
import { buildCells, cellKey } from '../../lib/grid';
import { citedShort } from '../../lib/format';
import { platformLabel } from '../Badges';
import { Cite, ClaimLine, claimTarget, citedValueTarget } from '../Cite';
import { sceneCounts } from './sceneData';

export const CHAPTERS = ['Passed on Earth', 'Earth gravity', 'Microgravity', 'Lunar gravity', 'Artemis', 'Why not interpolate', 'The gap map', 'Why this matters', 'Method'];

export interface StoryPanel {
  key: string;
  chapter: number; // index into CHAPTERS
  title: ReactNode;
  body: ReactNode;
}

function claim(claims: Claim[], id: string, topics: Claim['topic'][]): Claim | undefined {
  return pickClaims(claims, { ids: [id], topics, n: 1 })[0];
}

function MissionValues({ m, tone }: { m: Mission; tone: 'paper' | 'night' }) {
  const vals: Array<[string, CitedValue | null]> = [
    ['gravity', m.gravity],
    ['O₂', m.o2],
    ['pressure', m.pressure],
  ];
  return (
    <span className="font-mono text-[14px] tabular">
      {vals.map(([label, v], i) => (
        <span key={label}>
          {i > 0 && ' · '}
          {v && v.value !== null ? (
            <Cite target={citedValueTarget(v, `${m.name}: ${label}`)} tone={tone} className="!text-[14px]">
              {citedShort(v)}
            </Cite>
          ) : (
            '—'
          )}
        </span>
      ))}
    </span>
  );
}

/** Narrative panels for the condition-space scene; every number is computed, every claim cited. */
export function useStoryPanels(tone: 'paper' | 'night' = 'night'): StoryPanel[] {
  const { data } = useData();
  const { mission } = useMission();
  const c = sceneCounts(data.findings, data.missions);
  const test1 = claim(data.claims, 'c_test1_1g', ['test1']);
  const psiNone = claim(data.claims, 'c_psi_no_partial_g', ['partial_g_gap']);
  const uMin = claim(data.claims, 'c_u_min_lunar', ['u_shape']);
  const nearly = claim(data.claims, 'c_lunar_nearly_most', ['lunar_flammability']);
  const art = data.missions.find((m) => m.id === 'artemis_habitat') ?? mission;
  const n = (v: number | null) => (v === null ? '—' : String(v));
  return [
    {
      key: 'a',
      chapter: 1,
      title: <>Test 1 screens materials here, in Earth gravity.{test1 && <> <Cite target={claimTarget(test1)} tone={tone} /></>}</>,
      body: (
        <>
          <span className="font-mono tabular">{c.oneG}</span> verified findings in this corpus sit at 1 g. NASA’s screening question is whether a material that passes here is safe elsewhere.
        </>
      ),
    },
    {
      key: 'b',
      chapter: 2,
      title: <>The 0 g plane: the station’s evidence.</>,
      body: (
        <>
          <span className="font-mono tabular">{c.ug}</span> verified findings come from microgravity, <span className="font-mono tabular">{c.ugPsi}</span> of them PSI-backed.{' '}
          <span className="font-mono tabular">{c.ugPlotted}</span> state an O₂ level and appear here as points.
        </>
      ),
    },
    {
      key: 'c',
      chapter: 3,
      title: (
        <>
          PSI holds <span className="font-mono text-signal tabular">{c.partialPsi}</span> combustion findings at partial gravity.{psiNone && <> <Cite target={claimTarget(psiNone)} tone={tone} /></>}
        </>
      ),
      body: (
        <>
          Between 0.05 and 0.9 g the corpus has <span className="font-mono tabular">{c.partialNonPsi}</span> non-PSI records
          {c.partialPlatforms.length > 0 && <> ({c.partialPlatforms.map(platformLabel).join(', ')})</>}, outlined in vermilion.
        </>
      ),
    },
    {
      key: 'd',
      chapter: 4,
      title: <>Artemis will operate here.</>,
      body: (
        <>
          {art && (
            <span className="mb-2 block">
              <MissionValues m={art} tone={tone} />
            </span>
          )}
          <span className="font-mono tabular">{n(c.artemisCell)}</span> verified findings share its gravity × O₂ bin; <span className="font-mono tabular">{n(c.artemisCell3)}</span> also share its
          pressure band.
        </>
      ),
    },
    {
      key: 'e',
      chapter: 5,
      title: <>Why 0 g and 1 g can’t bound it.</>,
      body: (
        <>
          {uMin && (
            <span className="mb-2 block">
              <ClaimLine claim={uMin} tone={tone} />
            </span>
          )}
          {nearly && (
            <span className="mb-2 block">
              <ClaimLine claim={nearly} tone={tone} />
            </span>
          )}
          <span className="label block !text-current opacity-70">Curve: schematic, not plotted from data</span>
        </>
      ),
    },
  ];
}

/** Compact gravity × O₂ grid preview (same bins and tints as the Gap Map). */
export function GapPreview({ findings, mission }: { findings: Finding[]; mission: Mission | null }) {
  const cells = buildCells(findings, 'o2');
  const stated = [...cells.values()].filter((x) => x.col !== 'unstated' && x.row !== 'unstated');
  const max = Math.max(1e-9, ...stated.map((x) => x.weight));
  const mCol = mission ? binOf(mission.gravity?.value ?? null, GRAVITY_BINS) : null;
  const mRow = mission ? binOf(mission.o2?.value ?? null, O2_BANDS) : null;
  const rows = [...O2_BANDS].reverse();
  return (
    <figure className="w-full max-w-[min(34rem,62vh)]">
      <div className="grid gap-px border border-ink bg-ink" style={{ gridTemplateColumns: `4.5rem repeat(${GRAVITY_BINS.length}, minmax(0,1fr))` }}>
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <div className="flex items-center bg-paper px-1.5 font-mono text-[10px] text-ink-2">{r.label}</div>
            {GRAVITY_BINS.map((g) => {
              const cell = cells.get(cellKey(g.key, r.key));
              const count = cell?.findings.length ?? 0;
              const lvl = count ? Math.max(1, Math.ceil((Math.min(1, (cell?.weight ?? 0) / max)) * 5)) : 0;
              const isM = g.key === mCol && r.key === mRow;
              return (
                <div
                  key={g.key}
                  className={`relative aspect-square ${lvl === 0 ? 'hatch bg-paper' : ''} ${isM ? 'outline-2 -outline-offset-2 outline-signal' : ''}`}
                  style={lvl ? { background: `var(--color-tint-${lvl})` } : undefined}
                  title={`${g.label} × ${r.label}: ${count}`}
                >
                  <span className={`absolute bottom-0.5 right-1 font-mono text-[10px] ${lvl >= 4 ? 'text-paper' : 'text-ink'}`}>{count}</span>
                </div>
              );
            })}
          </div>
        ))}
        <div className="bg-paper" />
        {GRAVITY_BINS.map((g) => (
          <div key={g.key} className="bg-paper px-1 py-1 text-center font-mono text-[10px] text-ink-2">
            {g.label}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 font-mono text-[11px] text-ink-2">Verified findings by gravity × O₂. Hatched = none. Outlined = your mission.</figcaption>
    </figure>
  );
}
