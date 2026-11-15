import { useMemo, useState } from 'react';
import type { Platform, SafetyArea, Tier } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { useWeights } from '../lib/weights';
import { decisionValue, missionConditions } from '../lib/score';
import { platformLabel } from '../components/Badges';
import { FindingCard } from '../components/FindingCard';
import { ScoreChip, WeightsPanel } from '../components/Weights';
import { RedTeamPanel } from '../components/Evidence';
import { EmptyNote, Loading, MissingData, ScreenHeader } from '../components/States';
import { Chips } from '../components/Chips';

const SAFETY: SafetyArea[] = ['prevention', 'detection', 'suppression'];
const TIERS: Tier[] = [1, 2, 3, 4];
const PAGE = 20;

export default function Rank() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const { params } = useWeights();
  const [safety, setSafety] = useState<Set<SafetyArea>>(new Set());
  const [tiers, setTiers] = useState<Set<Tier>>(new Set());
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set());
  const [psiOnly, setPsiOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [redTeam, setRedTeam] = useState(false);

  const mc = missionConditions(mission);
  const ranked = useMemo(
    () =>
      data.findings
        .map((f) => ({ f, d: decisionValue(f, mc, params) }))
        .sort((a, b) => b.d.value - a.d.value || a.f.evidence_tier - b.f.evidence_tier || a.f.id.localeCompare(b.f.id)),
    [data.findings, mc.gravity, mc.o2, mc.pressure, mc.flow, params],
  );
  const presentPlatforms = useMemo(() => [...new Set(data.findings.map((f) => f.platform))].sort(), [data.findings]);

  const filtered = ranked.filter(({ f }) => {
    if (safety.size && !(f.safety_area ?? []).some((s) => safety.has(s))) return false;
    if (tiers.size && !tiers.has(f.evidence_tier)) return false;
    if (platforms.size && !platforms.has(f.platform)) return false;
    if (psiOnly && !f.psi_id) return false;
    return true;
  });
  const max = filtered.length ? filtered[0].d.value : 0;

  if (loading) return <Loading />;

  return (
    <div>
      <ScreenHeader kicker="Ranked findings · decision value" title="What should this mission’s engineers know?">
        Every verified finding, ranked for <span className="text-text">{mission ? mission.name : 'the selected mission'}</span> by how much it should change a design decision.
      </ScreenHeader>

      <div className="mb-4 rounded-lg border border-line bg-panel-2 p-4 font-mono text-xs leading-relaxed text-muted sm:text-sm">
        <div className="text-text">score = relevance × tier weight × actionability × (1 + bonus if more flammable than 1 g)</div>
        <div className="mt-1">relevance = exp(−½ Σ (gap ÷ scale)²) × penalty^(dimensions the finding does not state); a mission value that is not stated is ignored</div>
        <div className="mt-1 text-flame">Editorial weights, not physics. Hover or tap a score to see every term.</div>
      </div>

      <div className="mb-5">
        <WeightsPanel />
      </div>

      {missing.includes('findings') ? (
        <MissingData files={['findings']} what="Ranked findings" />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
            <Chips label="Safety" options={SAFETY} active={safety} onChange={setSafety} />
            <Chips label="Tier" options={TIERS} active={tiers} onChange={setTiers} render={(t) => `T${t}`} />
            <Chips label="Platform" options={presentPlatforms} active={platforms} onChange={setPlatforms} render={platformLabel} />
            <label className="inline-flex items-center gap-2 font-mono text-xs text-muted">
              <input type="checkbox" checked={psiOnly} onChange={(e) => setPsiOnly(e.target.checked)} className="h-4 w-4 accent-[#4FC3F7]" />
              PSI-backed only
            </label>
          </div>

          <p className="mb-3 font-mono text-xs text-muted">
            {filtered.length} of {ranked.length} verified findings match
          </p>

          {filtered.length === 0 ? (
            <EmptyNote>No finding matches these filters.</EmptyNote>
          ) : (
            <ol className="space-y-4">
              {filtered.slice(0, limit).map(({ f, d }, i) => (
                <li key={f.id}>
                  {i === 0 && (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-flame">Top finding for this mission</span>
                      <button
                        type="button"
                        onClick={() => setRedTeam((v) => !v)}
                        aria-expanded={redTeam}
                        title="Retrieve counter-evidence for this finding (no AI); in live mode Claude can argue against it using only those records."
                        className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${redTeam ? 'border-flame bg-flame/10 text-flame' : 'border-flame/60 text-flame hover:bg-flame/10'}`}
                      >
                        {redTeam ? 'Hide red team' : 'Red-team this'}
                      </button>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                    <div className="flex items-start gap-3 sm:flex-col">
                      <div className="w-10 pt-1 font-mono text-lg text-muted sm:w-auto sm:pt-0">#{i + 1}</div>
                      <div className="w-36 sm:w-full">
                        <ScoreChip d={d} f={f} params={params} max={max} />
                      </div>
                    </div>
                    <FindingCard f={f} />
                  </div>
                  {i === 0 && redTeam && (
                    <div className="mt-3 sm:ml-[8.25rem]">
                      <RedTeamPanel target={f} scope="rt-rank" onClose={() => setRedTeam(false)} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {filtered.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mt-5 rounded-md border border-line-strong px-4 py-2 font-mono text-sm text-text hover:border-text">
              Show {Math.min(PAGE, filtered.length - limit)} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
