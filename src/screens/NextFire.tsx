import { useMemo, useState } from 'react';
import type { Claim } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { useWeights } from '../lib/weights';
import { formatRange, formatValue } from '../lib/format';
import { missionConditions } from '../lib/score';
import { nearestFindings, platformClaims, rankCells, reachingInvestigations, whyClaims, type Candidate, type NextAxis } from '../lib/nextfire';
import { Cite, claimTarget } from '../components/Cite';
import { FindingCard } from '../components/FindingCard';
import { WeightsPanel } from '../components/Weights';
import { EmptyNote, Loading, MissingData, ScreenHeader } from '../components/States';

const TOP_N = 8;
const G_NAME: Record<string, string> = { ug: 'Microgravity', lunar: 'Lunar gravity', mars: 'Mars gravity', partial: 'Other partial gravity', '1g': 'Earth gravity' };
const n2 = (v: number) => v.toFixed(2);

function combo(c: Candidate): { g: string; gSub: string; r: string } {
  return { g: G_NAME[c.g.key] ?? c.g.label, gSub: c.g.sub ?? '', r: c.axis === 'o2' ? `${c.r.label} O₂` : c.r.label };
}

export default function NextFire() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const { params } = useWeights();
  const [axis, setAxis] = useState<NextAxis>('o2');
  const mc = missionConditions(mission);
  const ranked = useMemo(() => rankCells(data.findings, mc, axis, params), [data.findings, mc.gravity, mc.o2, mc.pressure, mc.flow, axis, params]);
  const top = ranked.slice(0, TOP_N);
  const axisMissing = axis === 'o2' ? mc.o2 === null : mc.pressure === null;

  if (loading) return <Loading />;

  return (
    <div>
      <ScreenHeader kicker="Next fire · where the evidence is thinnest" title="Where should NASA light the next fire?">
        Condition cells near <span className="text-text">{mission ? mission.name : 'the selected mission'}</span> that the verified corpus barely covers, each with cited
        reasons, the nearest existing evidence and a platform that could reach it.
      </ScreenHeader>

      <div className="mb-4 rounded-lg border border-line bg-panel-2 p-4 font-mono text-xs leading-relaxed text-muted sm:text-sm">
        <div className="text-text">score = cellRelevance(cell centre → mission) × 1 ÷ (1 + tier-weighted evidence in the cell)</div>
        <div className="mt-1">
          cellRelevance uses the Rank relevance function on gravity and {axis === 'o2' ? 'O₂' : 'pressure'} only; evidence = Σ tier weights of verified findings in the cell
          (T1 {params.tierWeight[1]}, T2 {params.tierWeight[2]}, T3 {params.tierWeight[3]}, T4 {params.tierWeight[4]}). Analogue records are not counted.
        </div>
        <div className="mt-1 text-flame">A prioritisation heuristic, not a risk model.</div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="Second axis" className="inline-flex rounded-md border border-line-strong p-0.5 text-sm">
          {(['o2', 'pressure'] as NextAxis[]).map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={axis === a}
              onClick={() => setAxis(a)}
              className={`rounded px-3 py-1.5 ${axis === a ? 'bg-panel-2 text-text shadow-[inset_0_-2px_0_var(--color-cool)]' : 'text-muted hover:text-text'}`}
            >
              gravity × {a === 'o2' ? 'O₂' : 'pressure'}
            </button>
          ))}
        </div>
        {axisMissing && mission && (
          <p className="text-xs text-flame-soft">
            No source in the corpus states a {axis === 'o2' ? 'cabin O₂' : 'cabin pressure'} for {mission.name}, so cells are ranked on gravity and evidence alone.
          </p>
        )}
      </div>

      <div className="mb-6">
        <WeightsPanel />
      </div>

      {missing.includes('findings') ? (
        <MissingData files={['findings']} what="The next-fire list" />
      ) : top.length === 0 ? (
        <EmptyNote>No cells to rank.</EmptyNote>
      ) : (
        <ol className="space-y-5">
          {top.map((c, i) => (
            <NextItem key={c.key} c={c} rank={i + 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function NextItem({ c, rank }: { c: Candidate; rank: number }) {
  const { data } = useData();
  const { params } = useWeights();
  const label = combo(c);
  const why = whyClaims(data.claims, c, rank - 1);
  const near = nearestFindings(data.findings, c, params, 2);
  const platforms = platformClaims(data.claims, c);
  const reaching = reachingInvestigations(data.investigations, c);
  const centreRow = c.axis === 'o2' ? formatValue(c.r.centre, '%') + ' O₂' : formatValue(c.r.centre, 'kPa');
  return (
    <li className="rounded-xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="font-mono text-2xl leading-none text-muted">#{rank}</span>
          <div>
            <h2 className="text-lg font-semibold leading-snug text-text sm:text-xl">
              {label.g} <span className="font-mono text-sm text-muted">({label.gSub})</span> × {label.r}
            </h2>
            <p className="mt-1 font-mono text-xs text-muted">
              {c.count === 0 ? <span className="text-flame">no verified findings in this cell</span> : <>{c.count} verified finding{c.count === 1 ? '' : 's'} in this cell</>} · evidence{' '}
              {n2(c.evidence)} · cell relevance {n2(c.rel)} · scored at {formatValue(c.g.centre, 'g')}, {centreRow}
            </p>
          </div>
        </div>
        <div className="rounded-md border border-flame/50 bg-flame/[0.06] px-3 py-2 text-right" title={`${n2(c.rel)} × 1 ÷ (1 + ${n2(c.evidence)})`}>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">score</div>
          <div className="font-mono text-xl leading-none text-flame tabular">{c.score.toFixed(3)}</div>
          <div className="mt-1 font-mono text-[0.65rem] text-muted">
            {n2(c.rel)} ÷ (1 + {n2(c.evidence)})
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <section>
          <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-flame">Why it matters</h3>
          <ClaimList claims={why} empty="No claim in the corpus addresses this cell directly." />
        </section>
        <section>
          <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-cool">Nearest existing evidence</h3>
          {near.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No finding states a gravity level.</p>
          ) : (
            <div className="mt-2 space-y-3">
              {near.map(({ f, rel }) => (
                <div key={f.id}>
                  <div className="mb-1 font-mono text-[0.65rem] text-faint">relevance to cell centre {n2(rel)}</div>
                  <FindingCard f={f} compact />
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-text">Platform that could reach it</h3>
          <ClaimList claims={platforms} empty="No platform claim in the corpus covers this condition." showLabel />
          {reaching.length > 0 && (
            <div className="mt-3 rounded-md border border-line bg-panel-2 p-3">
              <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-faint">PSI records whose range already reaches this cell</div>
              <ul className="mt-1 space-y-1 text-xs">
                {reaching.slice(0, 4).map((inv) => (
                  <li key={inv.psi_id} className="flex flex-wrap gap-x-2">
                    <a href={inv.source_url} target="_blank" rel="noreferrer" className="font-mono text-cool hover:underline">
                      {inv.psi_id}
                    </a>
                    <span className="text-text/85">{inv.acronym ?? inv.name}</span>
                    <span className="font-mono text-muted">
                      {c.axis === 'o2' ? formatRange(inv.o2_range_percent, '%') + ' O₂' : formatRange(inv.pressure_range_kpa, 'kPa')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </li>
  );
}

function ClaimList({ claims, empty, showLabel = false }: { claims: Claim[]; empty: string; showLabel?: boolean }) {
  if (claims.length === 0) return <p className="mt-2 text-sm text-muted">{empty}</p>;
  return (
    <ul className="mt-2 space-y-2.5 text-sm leading-relaxed text-text/90">
      {claims.map((c) => (
        <li key={c.id}>
          {showLabel && c.label && <span className="font-medium text-text">{c.label}: </span>}
          {c.text} <Cite target={claimTarget(c)} />
        </li>
      ))}
    </ul>
  );
}
