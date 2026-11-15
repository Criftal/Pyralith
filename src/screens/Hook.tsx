import type { ReactNode } from 'react';
import type { Claim } from '../types';
import { useData } from '../lib/data';
import { formatPct, tidy } from '../lib/format';
import { href } from '../lib/router';
import { ARTEMIS_LIKE, artemisLikeShare, distinctExperiments, distinctSources } from '../lib/stats';
import { Cite, claimTarget, ClaimLine } from '../components/Cite';
import { FEATURED, pickClaims } from '../lib/claims';
import { Loading } from '../components/States';

export default function Hook() {
  const { data, loading, missing } = useData();
  const { findings, claims, meta } = data;
  const haveFindings = !loading && !missing.includes('findings');
  const test1 = pickClaims(claims, { ids: FEATURED.hookTest1, topics: ['test1'], n: 2 });
  const incidents = incidentStrip(claims);
  const atmosphereClaims = pickClaims(claims, { ids: FEATURED.atmosphereStat, topics: ['exploration_atmosphere'], n: 2 });
  const share = artemisLikeShare(findings);
  const experiments = distinctExperiments(findings);
  const nSources = distinctSources(findings);
  const v = meta?.verification;
  const dropped = v ? v.dropped_quote + v.dropped_numbers + v.dropped_schema : 0;

  return (
    <div>
      <section className="pb-10 pt-4 sm:pt-10">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-flame">NASA Space Apps 2026 · Flame in Freefall</div>
        <h1 className="mt-5 text-[clamp(2.7rem,8vw,7rem)] font-semibold leading-[0.95] tracking-tight">
          Passed on Earth.
          <br />
          <span className="text-flame">Safe on the Moon?</span>
        </h1>
        {test1.length > 0 && (
          <div className="mt-7 max-w-3xl space-y-2 text-base leading-relaxed text-muted sm:text-lg">
            {test1.map((c) => (
              <p key={c.id}>
                <ClaimLine claim={c} />
              </p>
            ))}
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={href('/mission')}
            className="inline-flex items-center gap-2 rounded-md bg-flame px-5 py-3 font-semibold text-black transition-colors hover:bg-flame-soft"
          >
            Choose a mission →
          </a>
          <a
            href={href('/gap')}
            className="inline-flex items-center gap-2 rounded-md border border-line-strong px-5 py-3 text-text transition-colors hover:border-text"
          >
            Open the Gap Map
          </a>
        </div>
      </section>

      {loading ? (
        <Loading />
      ) : (
        <section aria-label="Corpus statistics" className="grid gap-4 sm:grid-cols-3">
          <Stat
            value={haveFindings ? String(findings.length) : '—'}
            label="verified findings"
            sub={haveFindings ? `each quote machine-checked against its page, from ${nSources} source${nSources === 1 ? '' : 's'}` : 'findings.json not exported yet'}
          />
          <Stat
            value={haveFindings ? String(experiments.length) : '—'}
            label="experiments"
            sub={haveFindings ? 'distinct named investigations and tests' : 'findings.json not exported yet'}
            title={experiments.join(', ')}
          />
          <Stat
            value={haveFindings ? formatPct(share.fraction) : '—'}
            label="of findings from an Artemis-like atmosphere"
            accent
            sub={
              haveFindings ? (
                <>
                  {share.count} of {share.total} · O₂ ≥ {ARTEMIS_LIKE.o2MinPercent}% and pressure ≤ {ARTEMIS_LIKE.pressureMaxKpa} kPa (10.2 psi), both stated by the source
                  {atmosphereClaims.slice(0, 2).map((c) => (
                    <span key={c.id}>
                      {' '}
                      <Cite target={claimTarget(c)} />
                    </span>
                  ))}
                </>
              ) : (
                'findings.json not exported yet'
              )
            }
            title={`Definition: o2_percent ≥ ${ARTEMIS_LIKE.o2MinPercent} AND pressure_kpa ≤ ${ARTEMIS_LIKE.pressureMaxKpa}, both non-null; denominator = all verified findings.`}
          />
        </section>
      )}

      {v && (
        <p className="mt-4 font-mono text-xs leading-relaxed text-muted">
          Verification: {v.candidates} extracted records → <span className="text-cool">{v.verified} verified</span>, {dropped} dropped ({v.dropped_quote} quote not on
          cited page · {v.dropped_numbers} condition number not in source · {v.dropped_schema} malformed). Failures are dropped, never hand-fixed.
        </p>
      )}

      {incidents.length > 0 && <IncidentStrip incidents={incidents} />}
    </div>
  );
}

/** One incident per label, preferring the NASA incident page itself (WEB source with a link). */
function incidentStrip(claims: Claim[]): Claim[] {
  const rank = (c: Claim) => (c.source_id.startsWith('WEB:') ? 0 : 1) + (c.link ? 0 : 2);
  const best = new Map<string, Claim>();
  for (const c of claims.filter((x) => x.topic === 'incident')) {
    const key = (c.label ?? c.id).toLowerCase();
    const cur = best.get(key);
    if (!cur || rank(c) < rank(cur)) best.set(key, c);
  }
  const linked = [...best.values()].filter((c) => c.link);
  return (linked.length ? linked : [...best.values()]).slice(0, 4);
}

function Stat({ value, label, sub, accent = false, title }: { value: string; label: string; sub: ReactNode; accent?: boolean; title?: string }) {
  return (
    <div title={title} className={`rounded-xl border p-5 ${accent ? 'border-flame/50 bg-flame/[0.05]' : 'border-line bg-panel'}`}>
      <div className={`font-mono text-5xl font-medium leading-none tabular sm:text-6xl ${accent ? 'text-flame' : 'text-text'}`}>{value}</div>
      <div className="mt-3 text-base font-medium text-text">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted">{sub}</div>
    </div>
  );
}

function IncidentStrip({ incidents }: { incidents: Claim[] }) {
  return (
    <section className="mt-14" aria-labelledby="why-matters">
      <h2 id="why-matters" className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
        Why this matters
      </h2>
      <ul className={`mt-3 grid gap-px overflow-hidden rounded-lg border border-line bg-line ${incidents.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {incidents.map((c) => (
          <li key={c.id} className="bg-panel p-4">
            {c.label && <div className="font-mono text-sm font-semibold text-flame">{c.label}</div>}
            <p className="mt-1 text-sm leading-snug text-text/90">{tidy(c.text)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {c.link && (
                <a href={c.link} target="_blank" rel="noreferrer" className="font-mono text-xs text-cool hover:underline">
                  NASA page ↗
                </a>
              )}
              <Cite target={claimTarget(c)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
