import { Fragment, useMemo, useRef, useState } from 'react';
import type { Claim, Finding } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { GRAVITY_BINS, ROW_AXES, UNSTATED, bandLabel, binOf, type Band, type RowAxis } from '../lib/bins';
import { materialsWithBothBounds, normalizeMaterial, partialGStats } from '../lib/stats';
import { buildCells, cellKey, missionRowValue, type Cell } from '../lib/grid';
import { platformLabel } from '../components/Badges';
import { Cite, claimTarget, ClaimLine } from '../components/Cite';
import { FEATURED, futureClaims, pickClaims } from '../lib/claims';
import { tidy } from '../lib/format';
import { FindingCard } from '../components/FindingCard';
import { FlammabilitySchematic } from '../components/Schematic';
import { EmptyNote, Loading, MissingData, ScreenHeader } from '../components/States';

interface Col {
  key: string;
  label: string;
  sub?: string;
}

const COLS: Col[] = [...GRAVITY_BINS.map((b) => ({ key: b.key, label: b.label, sub: b.sub })), { key: UNSTATED, label: 'Unstated', sub: 'gravity' }];

export default function GapMap() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const [axis, setAxis] = useState<RowAxis>('o2');
  const [sel, setSel] = useState<{ axis: RowAxis; key: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectCell = (key: string) => {
    setSel({ axis, key });
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const findings = data.findings;
  const claims = data.claims;
  const bands = ROW_AXES[axis].bands;
  const rows: Band[] = useMemo(() => [...bands, { key: UNSTATED, label: 'Unstated', min: NaN, max: NaN, minIncl: true, maxIncl: true, centre: NaN }], [bands]);
  const cells = useMemo(() => buildCells(findings, axis), [findings, axis]);
  // Colour scale normalised over stated cells, so the large Unstated row/column does not wash out the grid.
  const maxWeight = useMemo(() => {
    const all = [...cells.values()];
    const stated = all.filter((c) => c.col !== UNSTATED && c.row !== UNSTATED);
    return Math.max(1e-9, ...(stated.length ? stated : all).map((c) => c.weight));
  }, [cells]);
  const pg = useMemo(() => partialGStats(findings), [findings]);

  // A mission value no source states sits in the Unstated column/row, like findings do.
  const missionCol = mission ? binOf(mission.gravity?.value ?? null, GRAVITY_BINS) : null;
  const missionRow = mission ? binOf(missionRowValue(mission, axis), bands) : null;
  const missionKey = missionCol && missionRow ? cellKey(missionCol, missionRow) : null;
  const activeKey = sel && sel.axis === axis ? sel.key : missionKey;
  const gapClaim = pickClaims(claims, { ids: FEATURED.gapHeadline, topics: ['partial_g_gap'], n: 1 })[0];

  if (loading) return <Loading />;

  const findingsMissing = missing.includes('findings');
  const colLabel = (k: string) => COLS.find((c) => c.key === k)?.label ?? k;
  const rowLabelOf = (k: string) => bandLabel(k, bands);

  return (
    <div>
      <ScreenHeader
        kicker="Gap Map · gravity × atmosphere"
        title={
          findingsMissing ? (
            'Where does NASA have flight data?'
          ) : (
            <>
              PSI holds <span className="font-mono text-flame">{pg.psi}</span> combustion findings at partial gravity
            </>
          )
        }
      >
        {!findingsMissing && (
          <p>
            Counted across the verified corpus.{' '}
            {gapClaim && <ClaimLine claim={gapClaim} className="text-text/85" />}{' '}
            Non-PSI evidence at partial gravity: <span className="font-mono text-text">{pg.nonPsi}</span> records
            {pg.analogues > 0 && (
              <>
                {' '}
                plus <span className="font-mono text-text">{pg.analogues}</span> analogue
              </>
            )}
            {pg.platforms.length > 0 && <> ({pg.platforms.map(platformLabel).join(', ')})</>}.
          </p>
        )}
      </ScreenHeader>

      {findingsMissing ? (
        <MissingData files={['findings']} what="The evidence grid" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div role="radiogroup" aria-label="Second axis" className="inline-flex rounded-md border border-line-strong p-0.5 text-sm">
              {(Object.keys(ROW_AXES) as RowAxis[]).map((a) => (
                <button
                  key={a}
                  role="radio"
                  aria-checked={axis === a}
                  onClick={() => setAxis(a)}
                  className={`rounded px-3 py-1.5 ${axis === a ? 'bg-panel-2 text-text shadow-[inset_0_-2px_0_var(--color-cool)]' : 'text-muted hover:text-text'}`}
                >
                  {ROW_AXES[a].short}
                </button>
              ))}
            </div>
            <Legend />
          </div>

          {mission && (
            <p className="mb-3 text-sm text-muted">
              <span className="font-mono text-flame">◉</span> Your mission ({mission.name}) operates at{' '}
              <span className="text-text">{missionCol && missionCol !== UNSTATED ? colLabel(missionCol) : 'unstated gravity'}</span>
              {' × '}
              <span className="text-text">
                {missionRow && missionRow !== UNSTATED ? rowLabelOf(missionRow) : `Unstated (no source gives this mission’s ${ROW_AXES[axis].label.toLowerCase()})`}
              </span>
              {missionKey && (
                <>
                  : <span className="font-mono text-text">{cells.get(missionKey)?.findings.length ?? 0}</span> verified findings in that cell.
                </>
              )}
            </p>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="scroll-thin overflow-x-auto rounded-lg border border-line bg-panel/40">
              <div
                role="group"
                aria-label={`Verified findings by gravity and ${ROW_AXES[axis].label}`}
                className="grid min-w-[38rem]"
                style={{ gridTemplateColumns: `minmax(6.5rem, 0.8fr) repeat(${COLS.length}, minmax(4.75rem, 1fr))` }}
              >
                <div className="sticky left-0 z-10 border-b border-line bg-panel p-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                  {ROW_AXES[axis].short} ↓ · g →
                </div>
                {COLS.map((c) => (
                  <div key={c.key} className={`border-b border-line p-2 text-center ${missionCol === c.key ? 'text-flame' : 'text-text'}`}>
                    <div className="text-sm font-semibold">{c.label}</div>
                    <div className="font-mono text-[0.65rem] text-muted">{c.sub}</div>
                  </div>
                ))}
                {rows.map((r) => (
                  <Fragment key={r.key}>
                    <div className={`sticky left-0 z-10 border-t border-line bg-panel p-2 ${missionRow === r.key ? 'text-flame' : 'text-text'}`}>
                      <div className="font-mono text-sm">{r.label}</div>
                      {r.sub && <div className="text-[0.65rem] text-muted">{r.sub}</div>}
                    </div>
                    {COLS.map((c) => {
                      const key = cellKey(c.key, r.key);
                      return (
                        <GridCell
                          key={key}
                          cell={cells.get(key)}
                          isMission={key === missionKey}
                          isActive={key === activeKey}
                          maxWeight={maxWeight}
                          label={`${c.label} × ${r.label}`}
                          onSelect={() => selectCell(key)}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div ref={panelRef} className="scroll-mt-4">
            <CellPanel
              cell={activeKey ? cells.get(activeKey) : undefined}
              title={activeKey ? `${colLabel(activeKey.split('|')[0])} × ${rowLabelOf(activeKey.split('|')[1])}` : null}
              isMission={activeKey !== null && activeKey === missionKey}
            />
            </div>
          </div>
        </>
      )}

      <BoundTheMoon findings={findings} claims={claims} findingsMissing={findingsMissing} />
    </div>
  );
}

function GridCell({
  cell,
  isMission,
  isActive,
  maxWeight,
  label,
  onSelect,
}: {
  cell: Cell | undefined;
  isMission: boolean;
  isActive: boolean;
  maxWeight: number;
  label: string;
  onSelect: () => void;
}) {
  const count = cell?.findings.length ?? 0;
  const psi = cell?.psi ?? 0;
  const diamonds = (cell?.nonPsi ?? 0) + (cell?.analogues.length ?? 0);
  const t = count > 0 ? Math.min(1, (cell?.weight ?? 0) / maxWeight) : 0;
  const style = count > 0 ? { backgroundColor: `rgba(79, 195, 247, ${(0.1 + 0.55 * t).toFixed(3)})` } : undefined;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${label}: ${count} verified findings, ${psi} PSI-backed, ${cell?.nonPsi ?? 0} non-PSI, ${cell?.analogues.length ?? 0} analogue${isMission ? '. Your mission operates here.' : ''}`}
      aria-pressed={isActive}
      style={style}
      className={`relative flex min-h-[4.75rem] flex-col items-center justify-center gap-1 border-t border-l border-line p-1.5 text-center transition-[outline] ${
        count === 0 ? 'hatch' : ''
      } ${isMission ? 'mission-glow z-[1]' : ''} ${
        isActive && !isMission ? 'outline-2 -outline-offset-2 outline-cool' : 'hover:outline-1 hover:-outline-offset-1 hover:outline-line-strong'
      }`}
    >
      <span className={`font-mono text-lg leading-none tabular ${isMission ? 'text-flame' : count === 0 ? 'text-faint' : 'text-text'}`}>{count}</span>
      {(psi > 0 || diamonds > 0) && (
        <span className="flex items-center gap-1.5 font-mono text-[0.66rem] leading-none">
          {psi > 0 && <span className="text-cool">●{psi}</span>}
          {diamonds > 0 && <span className="text-flame">◇{diamonds}</span>}
        </span>
      )}
      {isMission && <span className="font-mono text-[0.58rem] uppercase leading-none tracking-wider text-flame">◉ your mission</span>}
    </button>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
      <li className="flex items-center gap-1.5" title="Fill intensity = sum of tier weights: T1 1.0 · T2 0.6 · T3 0.35 · T4 0.2">
        <span className="inline-block h-3 w-6 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(79,195,247,0.1), rgba(79,195,247,0.65))' }} />
        tier-weighted evidence
      </li>
      <li className="flex items-center gap-1.5">
        <span className="hatch inline-block h-3 w-4 rounded-sm border border-line-strong" />
        no verified findings
      </li>
      <li className="flex items-center gap-1">
        <span className="font-mono text-cool">●</span> PSI-backed
      </li>
      <li className="flex items-center gap-1" title="Non-PSI flight/lab data, or an analogue technique that mimics this gravity (analogues are not counted in the cell total)">
        <span className="font-mono text-flame">◇</span> non-PSI / analogue
      </li>
      <li className="flex items-center gap-1">
        <span className="font-mono text-flame">◉</span> your mission
      </li>
    </ul>
  );
}

function CellPanel({ cell, title, isMission }: { cell: Cell | undefined; title: string | null; isMission: boolean }) {
  if (!title) {
    return (
      <aside className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">
        Select a cell to list its verified findings with quotes and sources.
      </aside>
    );
  }
  const items = [...(cell?.findings ?? [])].sort((a, b) => a.evidence_tier - b.evidence_tier);
  const analogues = cell?.analogues ?? [];
  return (
    <aside className="flex max-h-[none] flex-col rounded-lg border border-line bg-panel/60 xl:sticky xl:top-28 xl:max-h-[calc(100dvh-8rem)]">
      <div className="border-b border-line p-4">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-faint">{isMission ? 'Your mission’s cell' : 'Selected cell'}</div>
        <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          {items.length} verified · {cell?.psi ?? 0} PSI-backed · {cell?.nonPsi ?? 0} non-PSI
          {analogues.length > 0 && <> · {analogues.length} analogue</>}
        </p>
      </div>
      <div className="scroll-thin space-y-3 overflow-y-auto p-4">
        {items.length === 0 && analogues.length === 0 && (
          <EmptyNote>No verified findings in this cell.{isMission ? ' This is where your mission operates.' : ''}</EmptyNote>
        )}
        {items.map((f) => (
          <FindingCard key={f.id} f={f} />
        ))}
        {analogues.length > 0 && (
          <>
            <div className="pt-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-flame">Analogue evidence · mimics this gravity · not counted</div>
            {analogues.map((f) => (
              <FindingCard key={`a-${f.id}`} f={f} analogue />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

function BoundTheMoon({ findings, claims, findingsMissing }: { findings: Finding[]; claims: Claim[]; findingsMissing: boolean }) {
  const materials = useMemo(() => materialsWithBothBounds(findings), [findings]);
  const [key, setKey] = useState<string | null>(null);
  const active = materials.find((m) => m.key === key) ?? materials[0] ?? null;
  const lunar = active ? findings.filter((f) => normalizeMaterial(f.material) === active.key && binOf(f.gravity_g, GRAVITY_BINS) === 'lunar') : [];
  const premise = pickClaims(claims, { ids: FEATURED.boundPremise, n: 1 })[0];

  return (
    <section className="mt-14" aria-labelledby="bound-moon">
      <div className="font-mono text-xs uppercase tracking-[0.25em] text-flame">Can we bound the Moon?</div>
      <h2 id="bound-moon" className="mt-2 text-xl font-semibold sm:text-2xl">
        The naive bound: a material’s 0 g result and its 1 g result, with lunar gravity assumed to lie in between
      </h2>
      {premise && (
        <p className="mt-3 max-w-3xl rounded-md border border-line bg-panel-2 px-4 py-3 text-sm leading-relaxed text-muted">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-faint">The premise · </span>
          <ClaimLine claim={premise} className="text-text/90" />
        </p>
      )}

      {findingsMissing ? null : materials.length === 0 ? (
        <div className="mt-4">
          <EmptyNote>No material in the verified corpus has both a 0 g and a 1 g finding yet, so no naive bound can be drawn.</EmptyNote>
        </div>
      ) : (
        <div className="mt-4">
          <label className="flex flex-wrap items-center gap-3 text-sm text-muted">
            Material
            <select
              value={active?.key ?? ''}
              onChange={(e) => setKey(e.target.value)}
              className="max-w-full rounded-md border border-line-strong bg-panel px-3 py-2 font-mono text-sm text-text"
            >
              {materials.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.zeroG.length} at 0 g · {m.oneG.length} at 1 g)
                </option>
              ))}
            </select>
          </label>
          {active && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_minmax(16rem,0.8fr)_1fr]">
              <BoundColumn title="0 g · microgravity" tone="cool" items={active.zeroG} />
              <div className="flex flex-col rounded-lg border border-dashed border-flame/60 bg-flame/[0.05] p-4 text-center lg:sticky lg:top-28 lg:self-start">
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-flame">Lunar gravity</div>
                <div className="mt-2 font-mono text-4xl text-flame">?</div>
                <p className="mt-2 text-sm text-muted">
                  {lunar.length === 0 ? (
                    <>No verified lunar-gravity finding for {active.label} in this corpus.</>
                  ) : (
                    <>
                      <span className="font-mono text-text">{lunar.length}</span> verified lunar-gravity finding{lunar.length === 1 ? '' : 's'} for {active.label}.
                    </>
                  )}
                </p>
                {lunar.length > 0 && (
                  <div className="mt-3 space-y-3 text-left">
                    {lunar.map((f) => (
                      <FindingCard key={f.id} f={f} compact />
                    ))}
                  </div>
                )}
              </div>
              <BoundColumn title="1 g · Earth gravity" tone="muted" items={active.oneG} />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <WarningCard claims={claims} />
        <FlammabilitySchematic />
      </div>
    </section>
  );
}

function BoundColumn({ title, tone, items }: { title: string; tone: 'cool' | 'muted'; items: Finding[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <div>
      <div className={`mb-2 font-mono text-xs uppercase tracking-[0.2em] ${tone === 'cool' ? 'text-cool' : 'text-muted'}`}>
        {title} · <span className="text-text">{items.length}</span>
      </div>
      <div className="space-y-3">
        {shown.map((f) => (
          <FindingCard key={f.id} f={f} compact />
        ))}
      </div>
      {items.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 font-mono text-xs text-cool hover:underline">
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

const WARN_TOPICS: Claim['topic'][] = ['lunar_flammability', 'u_shape', 'test1'];
const TOPIC_TITLE: Record<string, string> = { lunar_flammability: 'Lunar flammability', u_shape: 'U-shaped boundary', test1: 'Earth screening (Test 1)' };

function WarningCard({ claims }: { claims: Claim[] }) {
  const [showAll, setShowAll] = useState(false);
  const featured = [
    ...pickClaims(claims, { ids: FEATURED.warnLunar, topics: ['lunar_flammability'], n: 2 }),
    ...pickClaims(claims, { ids: FEATURED.warnU, topics: ['u_shape'], n: 2 }),
    ...pickClaims(claims, { ids: FEATURED.warnTest1, topics: ['test1'], n: 1 }),
  ];
  const featuredIds = new Set(featured.map((c) => c.id));
  const all = claims.filter((c) => WARN_TOPICS.includes(c.topic));
  const future = futureClaims(claims, 3);
  const futureIds = new Set(future.map((c) => c.id));
  const moreFuture = claims.filter((c) => c.topic === 'future_experiment' && !futureIds.has(c.id));
  return (
    <div className="rounded-lg border border-flame/50 bg-flame/[0.05] p-5">
      <h3 className="text-lg font-semibold text-flame">⚠︎ Why the Moon may fall outside this range</h3>
      {featured.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Supporting claims have not been exported yet.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm leading-relaxed text-text/90">
          {featured.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className="mt-0.5 font-mono text-flame">›</span>
              <span>
                {c.label && <span className="font-medium text-text">{c.label}: </span>}
                <ClaimLine claim={c} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {all.length > featured.length && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="font-mono text-xs text-cool hover:underline">
            {showAll ? 'Hide' : 'Show'} all {all.length} supporting claims
          </button>
          {showAll && (
            <div className="mt-3 space-y-4">
              {WARN_TOPICS.map((t) => {
                const items = all.filter((c) => c.topic === t && !featuredIds.has(c.id));
                if (!items.length) return null;
                return (
                  <div key={t}>
                    <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
                      {TOPIC_TITLE[t]} · {items.length} more
                    </div>
                    <ul className="mt-1.5 space-y-2 text-sm leading-relaxed text-text/85">
                      {items.map((c) => (
                        <li key={c.id}>
                          {c.label && <span className="font-medium text-text">{c.label}: </span>}
                          <ClaimLine claim={c} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {future.length > 0 && (
        <div className="mt-5 border-t border-flame/25 pt-4">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Future data that could settle it</div>
          <ul className="mt-2 space-y-2 text-sm">
            {[...future, ...(showAll ? moreFuture : [])].map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {c.label && <span className="font-mono font-semibold text-cool">{c.label}</span>}
                <span className="text-text/90">{tidy(c.text)}</span>
                <Cite target={claimTarget(c)} />
                {c.link && (
                  <a href={c.link} target="_blank" rel="noreferrer" className="font-mono text-xs text-cool hover:underline">
                    page ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
