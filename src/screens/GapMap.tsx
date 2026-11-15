import { Fragment, useMemo, useRef, useState } from 'react';
import type { Claim, Finding } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { GRAVITY_BINS, ROW_AXES, UNSTATED, bandLabel, binOf, type Band, type RowAxis } from '../lib/bins';
import { materialsWithBothBounds, normalizeMaterial, partialGStats } from '../lib/stats';
import { buildCells, cellKey, cellReadout, missionRowValue, type Cell } from '../lib/grid';
import { FEATURED, futureClaims, pickClaims } from '../lib/claims';
import { tidy } from '../lib/format';
import { platformLabel } from '../components/Badges';
import { Cite, claimTarget, ClaimLine } from '../components/Cite';
import { FindingCard } from '../components/FindingCard';
import { FlammabilitySchematic } from '../components/Schematic';
import { MaskLines, Wipe } from '../components/Motion';
import { EmptyNote, Loading, MissingData, SectionLabel } from '../components/States';

interface Col {
  key: string;
  label: string;
  sub?: string;
}

const COLS: Col[] = [...GRAVITY_BINS.map((b) => ({ key: b.key, label: b.label, sub: b.sub })), { key: UNSTATED, label: 'Unstated', sub: 'gravity' }];
const UNSTATED_BAND: Band = { key: UNSTATED, label: 'Unstated', min: NaN, max: NaN, minIncl: true, maxIncl: true, centre: NaN };

export default function GapMap() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const [axis, setAxis] = useState<RowAxis>('o2');
  const [sel, setSel] = useState<{ axis: RowAxis; key: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const findings = data.findings;
  const claims = data.claims;
  const bands = ROW_AXES[axis].bands;
  const rows: Band[] = useMemo(() => [...bands].reverse().concat(UNSTATED_BAND), [bands]);
  const cells = useMemo(() => buildCells(findings, axis), [findings, axis]);
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
  const selectCell = (key: string) => {
    setSel({ axis, key });
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };
  const readKey = hover ?? activeKey;
  const [rc, rr] = readKey ? readKey.split('|') : [null, null];
  const readCell = readKey ? cells.get(readKey) : undefined;

  return (
    <div>
      <header className="grid grid-cols-12 gap-x-6 border-b border-ink pb-10 pt-4">
        <div className="col-span-12">
          <SectionLabel index="03">Gap Map · gravity × atmosphere</SectionLabel>
        </div>
        {findingsMissing ? (
          <MaskLines as="h1" lines={['Where does NASA have flight data?']} className="col-span-12 mt-4 font-display text-[clamp(2.4rem,6vw,5.5rem)] font-normal leading-[1.0] tracking-[-0.025em]" />
        ) : (
          <MaskLines
            as="h1"
            lines={[
              <>
                PSI holds <span className="font-mono text-signal tabular">{pg.psi}</span> combustion
              </>,
              <>findings at partial gravity.</>,
            ]}
            className="col-span-12 mt-4 font-display text-[clamp(2.6rem,7vw,6.5rem)] font-normal leading-[0.98] tracking-[-0.025em] lg:col-span-11"
          />
        )}
        {!findingsMissing && (
          <p className="col-span-12 mt-6 max-w-[46rem] text-[17px] leading-relaxed text-ink-2 lg:col-span-8">
            Counted across the verified corpus. {gapClaim && <ClaimLine claim={gapClaim} className="text-ink" />} Non-PSI evidence at partial gravity:{' '}
            <span className="font-mono text-ink tabular">{pg.nonPsi}</span> records
            {pg.analogues > 0 && (
              <>
                {' '}
                plus <span className="font-mono text-ink tabular">{pg.analogues}</span> analogue
              </>
            )}
            {pg.platforms.length > 0 && <> ({pg.platforms.map(platformLabel).join(', ')})</>}.
          </p>
        )}
      </header>

      {findingsMissing ? (
        <div className="mt-8">
          <MissingData files={['findings']} what="The evidence grid" />
        </div>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-rule pb-4">
            <div role="radiogroup" aria-label="Second axis" className="flex items-baseline gap-x-4">
              <span className="label">Rows</span>
              {(Object.keys(ROW_AXES) as RowAxis[]).map((a) => (
                <button
                  key={a}
                  role="radio"
                  aria-checked={axis === a}
                  onClick={() => {
                    setAxis(a);
                    setHover(null);
                  }}
                  className="toggle"
                >
                  {ROW_AXES[a].short}
                </button>
              ))}
            </div>
            <Legend />
          </div>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[12px] tabular">
            <span className="text-ink" aria-live="polite">
              {readKey ? cellReadout(rc, rr, axis, readCell) : 'Hover or focus a cell'}
            </span>
            {mission && (
              <span className="text-ink-2">
                Your mission ({mission.name}) operates at {missionCol && missionCol !== UNSTATED ? colLabel(missionCol) : 'unstated gravity'} ×{' '}
                {missionRow && missionRow !== UNSTATED ? rowLabelOf(missionRow) : `Unstated (no source gives this mission’s ${ROW_AXES[axis].label.toLowerCase()})`}
                {missionKey && <> : {cells.get(missionKey)?.findings.length ?? 0} verified findings in that cell.</>}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-12 gap-x-6 gap-y-8">
            <Wipe className="col-span-12 xl:col-span-8">
              <div className="scroll-thin overflow-x-auto">
                <div
                  role="group"
                  aria-label={`Verified findings by gravity and ${ROW_AXES[axis].label}`}
                  className="grid min-w-[36rem] gap-px border border-ink bg-ink"
                  style={{ gridTemplateColumns: `6rem repeat(${COLS.length}, minmax(3.6rem, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 flex items-end bg-paper p-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                    {ROW_AXES[axis].short} ↓ · g →
                  </div>
                  {COLS.map((c) => (
                    <div key={c.key} className={`bg-paper p-2 ${rc === c.key ? 'bg-paper-2' : ''}`}>
                      <div className={`text-[13px] font-semibold ${missionCol === c.key ? 'underline decoration-signal decoration-2 underline-offset-4' : ''}`}>{c.label}</div>
                      <div className="font-mono text-[10px] text-ink-3">{c.sub}</div>
                    </div>
                  ))}
                  {rows.map((r) => (
                    <Fragment key={r.key}>
                      <div className={`sticky left-0 z-10 flex flex-col justify-center p-2 ${rr === r.key ? 'bg-paper-2' : 'bg-paper'}`}>
                        <div className={`font-mono text-[12px] ${missionRow === r.key ? 'underline decoration-signal decoration-2 underline-offset-4' : ''}`}>{r.label}</div>
                        {r.sub && <div className="text-[10px] text-ink-3">{r.sub}</div>}
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
                            onHover={(on) => setHover(on ? key : null)}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </Wipe>

            <div ref={panelRef} className="col-span-12 scroll-mt-4 xl:col-span-4">
              <CellPanel
                cell={activeKey ? cells.get(activeKey) : undefined}
                title={activeKey ? `${colLabel(activeKey.split('|')[0])} × ${rowLabelOf(activeKey.split('|')[1])}` : null}
                isMission={activeKey !== null && activeKey === missionKey}
              />
            </div>
          </div>
        </section>
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
  onHover,
}: {
  cell: Cell | undefined;
  isMission: boolean;
  isActive: boolean;
  maxWeight: number;
  label: string;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const count = cell?.findings.length ?? 0;
  const psi = cell?.psi ?? 0;
  const outline = (cell?.nonPsi ?? 0) + (cell?.analogues.length ?? 0);
  const lvl = count > 0 ? Math.max(1, Math.ceil(Math.min(1, (cell?.weight ?? 0) / maxWeight) * 5)) : 0;
  const dark = lvl >= 4;
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      aria-label={`${label}: ${count} verified findings, ${psi} PSI-backed, ${cell?.nonPsi ?? 0} non-PSI, ${cell?.analogues.length ?? 0} analogue${isMission ? '. Your mission operates here.' : ''}`}
      aria-pressed={isActive}
      style={lvl ? { background: `var(--color-tint-${lvl})` } : undefined}
      className={`relative aspect-square min-h-[3.6rem] p-1.5 text-left ${lvl === 0 ? 'hatch bg-paper' : ''} ${
        isMission ? 'z-[1] outline-2 -outline-offset-2 outline-signal' : isActive ? 'z-[1] outline-2 -outline-offset-2 outline-ink' : 'hover:outline-1 hover:-outline-offset-1 hover:outline-ink'
      }`}
    >
      {isMission && <span className="absolute left-1.5 top-1 font-mono text-[9px] uppercase tracking-[0.06em] text-signal">Mission</span>}
      <span className={`absolute bottom-1.5 right-1.5 font-mono text-[15px] leading-none tabular ${dark ? 'text-paper' : count === 0 ? 'text-ink-3' : 'text-ink'}`}>{count}</span>
      {(psi > 0 || outline > 0) && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 font-mono text-[9.5px] leading-none tabular">
          {psi > 0 && (
            <span className={`flex items-center gap-0.5 ${dark ? 'text-paper' : 'text-flight'}`}>
              <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 ${dark ? 'bg-paper' : 'bg-flight'}`} />
              {psi}
            </span>
          )}
          {outline > 0 && (
            <span className={`flex items-center gap-0.5 ${dark ? 'text-paper' : 'text-ink'}`}>
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 border border-signal" />
              {outline}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-ink-2">
      <li className="flex items-center gap-2" title="Fill = sum of tier weights (T1 1.0 · T2 0.6 · T3 0.35 · T4 0.2), in five steps">
        <span className="flex">
          {[1, 2, 3, 4, 5].map((l) => (
            <span key={l} className="inline-block h-3 w-4" style={{ background: `var(--color-tint-${l})` }} />
          ))}
        </span>
        tier-weighted evidence
      </li>
      <li className="flex items-center gap-2">
        <span className="hatch inline-block h-3 w-4 border border-ink" />
        none
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 bg-flight" /> PSI-backed
      </li>
      <li className="flex items-center gap-1.5" title="Non-PSI flight/lab data, or an analogue technique that mimics this gravity (analogues are not counted in the cell total)">
        <span className="inline-block h-2 w-2 border border-signal" /> non-PSI / analogue
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 border-2 border-signal" /> your mission
      </li>
    </ul>
  );
}

function CellPanel({ cell, title, isMission }: { cell: Cell | undefined; title: string | null; isMission: boolean }) {
  if (!title) return <aside className="border-t border-ink pt-4 text-[15px] text-ink-2">Select a cell to list its verified findings with quotes and sources.</aside>;
  const items = [...(cell?.findings ?? [])].sort((a, b) => a.evidence_tier - b.evidence_tier);
  const analogues = cell?.analogues ?? [];
  return (
    <aside className="border-t-2 border-ink xl:sticky xl:top-28">
      <div className="py-3">
        <div className="label">{isMission ? 'Your mission’s cell' : 'Selected cell'}</div>
        <h2 className="mt-1 font-display text-[28px] leading-[1.05]">{title}</h2>
        <p className="mt-1 font-mono text-[12px] text-ink-2 tabular">
          {items.length} verified · {cell?.psi ?? 0} PSI-backed · {cell?.nonPsi ?? 0} non-PSI
          {analogues.length > 0 && <> · {analogues.length} analogue</>}
        </p>
      </div>
      <div className="scroll-thin xl:max-h-[calc(100dvh-14rem)] xl:overflow-y-auto">
        {items.length === 0 && analogues.length === 0 && <EmptyNote>No verified findings in this cell.{isMission ? ' This is where your mission operates.' : ''}</EmptyNote>}
        {items.map((f) => (
          <FindingCard key={f.id} f={f} />
        ))}
        {analogues.length > 0 && (
          <>
            <div className="label border-t border-ink pt-3 text-ink">Analogue evidence · mimics this gravity · not counted</div>
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
    <section className="mt-24 border-t border-ink pt-8" aria-labelledby="bound-moon">
      <SectionLabel index="04">Can we bound the Moon?</SectionLabel>
      <MaskLines
        as="h2"
        lines={['The naive bound: a material’s 0 g and 1 g results,', <em className="italic">with lunar gravity assumed to lie in between.</em>]}
        className="mt-4 max-w-[64rem] font-display text-[clamp(2rem,4.2vw,3.6rem)] font-normal leading-[1.03] tracking-[-0.02em]"
      />
      {premise && (
        <p className="mt-5 max-w-[46rem] border-l border-ink pl-4 text-[16px] leading-relaxed text-ink-2">
          <span className="label mr-2">The premise</span>
          <ClaimLine claim={premise} className="text-ink" />
        </p>
      )}

      {findingsMissing ? null : materials.length === 0 ? (
        <div className="mt-6">
          <EmptyNote>No material in the verified corpus has both a 0 g and a 1 g finding yet, so no naive bound can be drawn.</EmptyNote>
        </div>
      ) : (
        <div className="mt-8">
          <label className="flex max-w-xl flex-wrap items-baseline gap-3">
            <span className="label">Material</span>
            <select value={active?.key ?? ''} onChange={(e) => setKey(e.target.value)} className="input-line min-w-0 flex-1 font-mono text-[14px]">
              {materials.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.zeroG.length} at 0 g · {m.oneG.length} at 1 g)
                </option>
              ))}
            </select>
          </label>
          {active && (
            <div className="mt-6 grid grid-cols-1 border-t border-ink lg:grid-cols-[1fr_minmax(15rem,0.75fr)_1fr]">
              <BoundColumn title="0 g · microgravity" items={active.zeroG} />
              <div className="border-ink py-5 lg:border-x lg:px-6">
                <div className="lg:sticky lg:top-28">
                  <div className="label text-ink">Lunar gravity</div>
                  <div className="mt-2 font-display text-[6rem] leading-none text-ink">?</div>
                  <p className="mt-2 text-[15px] text-ink-2">
                    {lunar.length === 0 ? (
                      <>No verified lunar-gravity finding for {active.label} in this corpus.</>
                    ) : (
                      <>
                        <span className="font-mono text-ink">{lunar.length}</span> verified lunar-gravity finding{lunar.length === 1 ? '' : 's'} for {active.label}.
                      </>
                    )}
                  </p>
                  {lunar.map((f) => (
                    <FindingCard key={f.id} f={f} compact />
                  ))}
                </div>
              </div>
              <BoundColumn title="1 g · Earth gravity" items={active.oneG} />
            </div>
          )}
        </div>
      )}

      <div className="mt-12 grid grid-cols-12 gap-x-6 gap-y-10">
        <div className="col-span-12 lg:col-span-7">
          <WarningCard claims={claims} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <FlammabilitySchematic />
        </div>
      </div>
    </section>
  );
}

function BoundColumn({ title, items }: { title: string; items: Finding[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <div className="py-5 lg:px-0">
      <div className="label">
        {title} · <span className="font-mono text-ink">{items.length}</span>
      </div>
      <div className="mt-1">
        {shown.map((f) => (
          <FindingCard key={f.id} f={f} compact />
        ))}
      </div>
      {items.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="link-draw mt-2 font-mono text-[12px] text-ink">
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
    <div className="border-t-2 border-ink pt-4">
      <h3 className="font-display text-[30px] leading-[1.05]">Why the Moon may fall outside this range</h3>
      {featured.length === 0 ? (
        <p className="mt-3 text-[15px] text-ink-2">Supporting claims have not been exported yet.</p>
      ) : (
        <ol className="mt-4">
          {featured.map((c, i) => (
            <li key={c.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-t border-rule py-3 text-[16px] leading-relaxed">
              <span className="font-mono text-[12px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
              <span>
                {c.label && <span className="font-semibold">{c.label}: </span>}
                <ClaimLine claim={c} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {all.length > featured.length && (
        <div className="border-t border-rule pt-3">
          <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="link-draw font-mono text-[12px] text-ink">
            {showAll ? 'Hide' : 'Show'} all {all.length} supporting claims
          </button>
          {showAll && (
            <div className="mt-4 space-y-5">
              {WARN_TOPICS.map((t) => {
                const items = all.filter((c) => c.topic === t && !featuredIds.has(c.id));
                if (!items.length) return null;
                return (
                  <div key={t}>
                    <div className="label">
                      {TOPIC_TITLE[t]} · {items.length} more
                    </div>
                    <ul className="mt-2 space-y-2 text-[15px] leading-relaxed">
                      {items.map((c) => (
                        <li key={c.id}>
                          {c.label && <span className="font-semibold">{c.label}: </span>}
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
        <div className="mt-6 border-t border-ink pt-4">
          <div className="label">Future data that could settle it</div>
          <ul className="mt-2">
            {[...future, ...(showAll ? moreFuture : [])].map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule py-2 text-[15px]">
                {c.label && <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-flight">{c.label}</span>}
                <span>{tidy(c.text)}</span>
                <Cite target={claimTarget(c)} />
                {c.link && (
                  <a href={c.link} target="_blank" rel="noreferrer" className="link-draw font-mono text-[12px]">
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
