import { useMemo, useState } from 'react';
import type { Claim } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { useWeights } from '../lib/weights';
import { formatRange, formatValue, tidy } from '../lib/format';
import { missionConditions } from '../lib/score';
import { nearestFindings, platformClaims, rankCells, reachingInvestigations, whyClaims, type Candidate, type NextAxis } from '../lib/nextfire';
import { Cite, claimTarget } from '../components/Cite';
import { O2 } from '../components/Typo';
import { FindingCard } from '../components/FindingCard';
import { WeightsPanel } from '../components/Weights';
import { EmptyNote, Loading, MissingData, ScreenHeader } from '../components/States';

const TOP_N = 8;
const G_NAME: Record<string, string> = { ug: 'Microgravity', lunar: 'Lunar gravity', mars: 'Mars gravity', partial: 'Other partial gravity', '1g': 'Earth gravity' };
const n2 = (v: number) => v.toFixed(2);

export default function NextFire() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const { params } = useWeights();
  const [axis, setAxis] = useState<NextAxis>('o2');
  const [open, setOpen] = useState<Set<string> | null>(null); // null = default (top row open)
  const mc = missionConditions(mission);
  const ranked = useMemo(() => rankCells(data.findings, mc, axis, params), [data.findings, mc.gravity, mc.o2, mc.pressure, mc.flow, axis, params]);
  const top = ranked.slice(0, TOP_N);
  const axisMissing = axis === 'o2' ? mc.o2 === null : mc.pressure === null;
  const isOpen = (key: string, i: number) => (open ? open.has(key) : i === 0);
  const toggle = (key: string, i: number) =>
    setOpen((prev) => {
      const base = prev ?? new Set(top[0] ? [top[0].key] : []);
      const next = new Set(base);
      if (isOpen(key, i)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (loading) return <Loading />;

  return (
    <div>
      <ScreenHeader index="07" kicker="Next fire · where the evidence is thinnest" title="Where should NASA light the next fire?">
        Condition cells near <span className="text-ink">{mission ? mission.name : 'the selected mission'}</span> that the verified corpus barely covers, each with cited reasons,
        the nearest existing evidence and a platform that could reach it.
      </ScreenHeader>

      <div className="mb-6 border-l-2 border-ink pl-5 font-mono text-[13px] leading-relaxed text-ink-2">
        <div className="text-ink">score = cellRelevance(cell centre → mission) × 1 ÷ (1 + tier-weighted evidence in the cell)</div>
        <div className="mt-1">
          cellRelevance uses the Rank relevance function on gravity and {axis === 'o2' ? 'O₂' : 'pressure'} only; evidence = Σ tier weights of verified findings in the cell (T1{' '}
          {params.tierWeight[1]}, T2 {params.tierWeight[2]}, T3 {params.tierWeight[3]}, T4 {params.tierWeight[4]}). Analogue records are not counted.
        </div>
        <div className="mt-1 text-ink">A prioritisation heuristic, not a risk model.</div>
      </div>

      <div className="mb-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div role="radiogroup" aria-label="Second axis" className="flex items-baseline gap-x-4">
          <span className="label">Cells</span>
          {(['o2', 'pressure'] as NextAxis[]).map((a) => (
            <button key={a} role="radio" aria-checked={axis === a} onClick={() => setAxis(a)} className="toggle">
              gravity × {a === 'o2' ? 'O₂' : 'pressure'}
            </button>
          ))}
        </div>
        {axisMissing && mission && (
          <p className="text-[13px] text-ink-2">
            No source in the corpus states a {axis === 'o2' ? 'cabin O₂' : 'cabin pressure'} for {mission.name}, so cells are ranked on gravity and evidence alone.
          </p>
        )}
      </div>

      <div className="mb-8">
        <WeightsPanel />
      </div>

      {missing.includes('findings') ? (
        <MissingData files={['findings']} what="The next-fire list" />
      ) : top.length === 0 ? (
        <EmptyNote>No cells to rank.</EmptyNote>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <div className="min-w-[44rem]">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_6rem_6rem_6rem_7rem] gap-x-4 border-b border-ink pb-2 font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              <span>#</span>
              <span>Condition cell</span>
              <span className="text-right">Findings</span>
              <span className="text-right">Evidence</span>
              <span className="text-right">Relevance</span>
              <span className="text-right">Score</span>
            </div>
            <ol>
              {top.map((c, i) => (
                <NextRow key={c.key} c={c} rank={i + 1} open={isOpen(c.key, i)} onToggle={() => toggle(c.key, i)} />
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function NextRow({ c, rank, open, onToggle }: { c: Candidate; rank: number; open: boolean; onToggle: () => void }) {
  const { data } = useData();
  const { params } = useWeights();
  const centreRow = c.axis === 'o2' ? `${formatValue(c.r.centre, '%')} O₂` : formatValue(c.r.centre, 'kPa');
  return (
    <li className="border-b border-rule">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[3rem_minmax(0,1fr)_6rem_6rem_6rem_7rem] items-baseline gap-x-4 py-4 text-left hover:bg-paper-2"
      >
        <span className="font-mono text-[13px] text-ink-3 tabular">{String(rank).padStart(2, '0')}</span>
        <span>
          <span className="font-display text-[clamp(1.35rem,2.2vw,1.9rem)] leading-tight">
            {G_NAME[c.g.key] ?? c.g.label} × {c.r.label}
            {c.axis === 'o2' && (
              <>
                {' '}
                <O2 />
              </>
            )}
          </span>
          <span className="ml-3 font-mono text-[11px] text-ink-3">
            {c.g.sub} · scored at {formatValue(c.g.centre, 'g')}, {centreRow} · {open ? 'hide' : 'expand'}
          </span>
        </span>
        <span className={`text-right font-mono text-[15px] tabular ${c.count === 0 ? 'text-ink' : 'text-ink-2'}`}>{c.count}</span>
        <span className="text-right font-mono text-[15px] text-ink-2 tabular">{n2(c.evidence)}</span>
        <span className="text-right font-mono text-[15px] text-ink-2 tabular">{n2(c.rel)}</span>
        <span className="text-right font-mono text-[20px] text-ink tabular" title={`${n2(c.rel)} × 1 ÷ (1 + ${n2(c.evidence)})`}>
          {c.score.toFixed(3)}
        </span>
      </button>
      {open && <NextDetail c={c} rank={rank} params={params} findings={data.findings} />}
    </li>
  );
}

function NextDetail({ c, rank, params, findings }: { c: Candidate; rank: number; params: ReturnType<typeof useWeights>['params']; findings: ReturnType<typeof useData>['data']['findings'] }) {
  const { data } = useData();
  const why = whyClaims(data.claims, c, rank - 1);
  const near = nearestFindings(findings, c, params, 2);
  const platforms = platformClaims(data.claims, c);
  const reaching = reachingInvestigations(data.investigations, c);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 pb-8 pl-[4rem] lg:grid-cols-3">
      <section>
        <h3 className="label text-ink">Why it matters</h3>
        <ClaimList claims={why} empty="No claim in the corpus addresses this cell directly." />
      </section>
      <section>
        <h3 className="label text-ink">Nearest existing evidence</h3>
        {near.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-2">No finding states a gravity level.</p>
        ) : (
          <div className="mt-1">
            {near.map(({ f, rel }) => (
              <div key={f.id}>
                <div className="pt-2 font-mono text-[11px] text-ink-3">relevance to cell centre {n2(rel)}</div>
                <FindingCard f={f} compact />
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="label text-ink">Platform that could reach it</h3>
        <ClaimList claims={platforms} empty="No platform claim in the corpus covers this condition." showLabel />
        {reaching.length > 0 && (
          <div className="mt-4 border-t border-ink pt-3">
            <div className="label">PSI records whose range already reaches this cell</div>
            <ul className="mt-2 space-y-1 text-[14px]">
              {reaching.slice(0, 4).map((inv) => (
                <li key={inv.psi_id} className="flex flex-wrap gap-x-2">
                  <a href={inv.source_url} target="_blank" rel="noreferrer" className="link-draw font-mono text-[13px] text-flight">
                    {inv.psi_id}
                  </a>
                  <span>{inv.acronym ?? inv.name}</span>
                  <span className="font-mono text-[12px] text-ink-2">{c.axis === 'o2' ? `${formatRange(inv.o2_range_percent, '%')} O₂` : formatRange(inv.pressure_range_kpa, 'kPa')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ClaimList({ claims, empty, showLabel = false }: { claims: Claim[]; empty: string; showLabel?: boolean }) {
  if (claims.length === 0) return <p className="mt-2 text-[15px] text-ink-2">{empty}</p>;
  return (
    <ul className="mt-2">
      {claims.map((c) => (
        <li key={c.id} className="border-t border-rule py-2.5 text-[15px] leading-relaxed">
          {showLabel && c.label && <span className="font-semibold">{c.label}: </span>}
          {tidy(c.text)} <Cite target={claimTarget(c)} />
        </li>
      ))}
    </ul>
  );
}
