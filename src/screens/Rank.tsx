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
      <ScreenHeader index="05" kicker="Ranked findings · decision value" title="What should this mission’s engineers know?">
        Every verified finding, ranked for <span className="text-ink">{mission ? mission.name : 'the selected mission'}</span> by how much it should change a design decision.
      </ScreenHeader>

      <div className="mb-8 border-l-2 border-ink pl-5 font-mono text-[13px] leading-relaxed text-ink-2">
        <div className="text-ink">score = relevance × tier weight × actionability × (1 + bonus if more flammable than 1 g)</div>
        <div className="mt-1">relevance = exp(−½ Σ (gap ÷ scale)²) × penalty^(dimensions the finding does not state); a mission value that is not stated is ignored</div>
        <div className="mt-1 text-ink">Editorial weights, not physics. Hover or tap a score to see every term.</div>
      </div>

      {missing.includes('findings') ? (
        <MissingData files={['findings']} what="Ranked findings" />
      ) : (
        <div className="grid grid-cols-12 gap-x-8 gap-y-8">
          <aside className="col-span-12 lg:col-span-3">
            <div className="scroll-thin hidden lg:sticky lg:top-28 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-2">
              <WeightsPanel variant="sidebar" />
            </div>
            <div className="lg:hidden">
              <WeightsPanel />
            </div>
          </aside>
          <div className="col-span-12 lg:col-span-9">
            <div className="flex flex-col gap-3 border-b border-rule pb-4">
              <Chips label="Safety" options={SAFETY} active={safety} onChange={setSafety} />
              <Chips label="Tier" options={TIERS} active={tiers} onChange={setTiers} render={(t) => `T${t}`} />
              <Chips label="Platform" options={presentPlatforms} active={platforms} onChange={setPlatforms} render={platformLabel} />
              <label className="inline-flex items-center gap-2 font-mono text-[12px] text-ink-2">
                <input type="checkbox" checked={psiOnly} onChange={(e) => setPsiOnly(e.target.checked)} className="h-4 w-4" />
                PSI-backed only
              </label>
            </div>
            <p className="mt-3 font-mono text-[12px] text-ink-3">
              {filtered.length} of {ranked.length} verified findings match
            </p>

            {filtered.length === 0 ? (
              <div className="mt-4">
                <EmptyNote>No finding matches these filters.</EmptyNote>
              </div>
            ) : (
              <ol className="mt-2">
                {filtered.slice(0, limit).map(({ f, d }, i) => (
                  <li key={f.id} className={i === 0 ? 'border-t-2 border-ink' : ''}>
                    {i === 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                        <span className="label text-ink">Top finding for this mission</span>
                        <button
                          type="button"
                          onClick={() => setRedTeam((v) => !v)}
                          aria-expanded={redTeam}
                          title="Retrieve counter-evidence for this finding (no AI); in live mode Claude can argue against it using only those records."
                          className={`btn btn-sm ${redTeam ? 'btn-primary' : ''}`}
                        >
                          {redTeam ? 'Hide red team' : 'Red-team this'}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3rem_8rem_minmax(0,1fr)]">
                      <div className="pt-5 font-mono text-[13px] text-ink-3 tabular">{String(i + 1).padStart(2, '0')}</div>
                      <div className="pt-4 sm:pr-2">
                        <ScoreChip d={d} f={f} params={params} max={max} />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <FindingCard f={f} />
                      </div>
                    </div>
                    {i === 0 && redTeam && (
                      <div className="mb-4 sm:ml-[12rem]">
                        <RedTeamPanel target={f} scope="rt-rank" onClose={() => setRedTeam(false)} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {filtered.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn mt-6">
                Show {Math.min(PAGE, filtered.length - limit)} more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
