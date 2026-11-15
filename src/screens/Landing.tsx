import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/data';
import { formatPct } from '../lib/format';
import { href } from '../lib/router';
import { FEATURED, pickClaims } from '../lib/claims';
import { ARTEMIS_LIKE, artemisLikeShare, distinctExperiments, distinctSources, partialGStats } from '../lib/stats';
import { Cite, claimTarget } from '../components/Cite';
import { CountUp, MaskLines, prefersReducedMotion, Reveal } from '../components/Motion';
import { SectionLabel } from '../components/States';
import { ConditionSpace, loadSceneModule, sectionProgress } from '../components/landing/ConditionSpace';
import { StaticSpace } from '../components/landing/StaticSpace';
import { Frame, Marquee, Preloader } from '../components/landing/Chrome';
import { Timeline, incidentsFrom } from '../components/landing/Timeline';
import type { FrameState } from '../components/landing/scene';

type Mode = 'webgl' | 'static';
let preloaderShown = false;

function detectMode(): Mode {
  if (typeof window === 'undefined') return 'static';
  if (prefersReducedMotion() || window.innerWidth < 768 || new URLSearchParams(window.location.search).has('static')) return 'static';
  try {
    const c = document.createElement('canvas');
    return c.getContext('webgl2') || c.getContext('webgl') ? 'webgl' : 'static';
  } catch {
    return 'static';
  }
}

export default function Landing() {
  const { data, loading, missing } = useData();
  const [mode, setMode] = useState<Mode | null>(null);
  const [preload, setPreload] = useState<Array<Promise<unknown>> | null>(null);
  const [chapter, setChapter] = useState(0);
  const [tone, setTone] = useState<'paper' | 'night'>('paper');
  const progressRef = useRef<HTMLSpanElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const sceneP = useRef(0);
  const afterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const m = detectMode();
    setMode(m);
    if (m !== 'webgl') return;
    const tasks: Array<Promise<unknown>> = [document.fonts?.ready ?? Promise.resolve(), loadSceneModule()];
    let lenis: { destroy(): void } | null = null;
    let alive = true;
    const lenisTask = import('lenis').then(({ default: Lenis }) => {
      if (alive) lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true });
    });
    tasks.push(lenisTask);
    if (!preloaderShown) {
      preloaderShown = true;
      setPreload(tasks);
    }
    return () => {
      alive = false;
      lenis?.destroy();
    };
  }, []);

  // Page progress, chapter index and frame tone, driven by scroll events (Lenis emits them every smoothed frame).
  useEffect(() => {
    const tick = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      let ch = 0;
      const sceneEl = document.querySelector<HTMLElement>('section[aria-label^="Condition space"]');
      const p = sceneEl ? sectionProgress(sceneEl) : sceneP.current;
      if (mode === 'webgl') ch = p < 0.08 ? 0 : Math.min(6, 1 + Math.floor((p - 0.08) / 0.16));
      afterRefs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.5) ch = 7 + i;
      });
      setChapter((c) => (c === ch ? c : ch));
      if (mode === 'static') {
        const night = document.querySelector<HTMLElement>('[data-tone="night"]');
        const r = night?.getBoundingClientRect();
        const t = r && r.top < 48 && r.bottom > 48 ? 'night' : 'paper';
        setTone((x) => (x === t ? x : t));
      }
    };
    tick();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    return () => {
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
    };
  }, [mode]);

  const onFrame = useCallback((s: FrameState) => {
    sceneP.current = s.p;
    const t = s.darkness > 0.5 ? 'night' : 'paper';
    setTone((x) => (x === t ? x : t));
    // The top band follows the scene's paper → night → paper background exactly.
    if (bandRef.current) {
      bandRef.current.style.backgroundColor = s.bg;
      bandRef.current.style.borderColor = s.darkness > 0.5 ? 'rgba(236,232,222,0.2)' : 'rgba(20,20,19,0.14)';
    }
  }, []);

  const endPreload = useCallback(() => setPreload(null), []);
  const reducedPointer = useMemo(() => (typeof window !== 'undefined' ? window.matchMedia?.('(pointer: coarse)').matches === true : true), []);

  const findingsReady = !loading && !missing.includes('findings');
  const share = artemisLikeShare(data.findings);
  const experiments = distinctExperiments(data.findings);
  const nSources = distinctSources(data.findings);
  const pg = partialGStats(data.findings);
  const v = data.meta?.verification;
  const dropped = v ? v.dropped_quote + v.dropped_numbers + v.dropped_schema : 0;
  const ntrsReports = Object.values(data.sources).filter((s) => s.kind === 'ntrs').length;
  const atmosphereClaims = pickClaims(data.claims, { ids: FEATURED.atmosphereStat, topics: ['exploration_atmosphere'], n: 2 });
  const incidents = incidentsFrom(data.claims);
  const marquee = findingsReady
    ? [
        v ? `${v.verified} verified records` : `${data.findings.length} verified findings`,
        `${data.investigations.length} PSI investigations`,
        `${ntrsReports} NASA reports`,
        `${pg.psi} partial-gravity PSI findings`,
        `${experiments.length} experiments`,
        `${data.claims.length} cited claims`,
        `${formatPct(share.fraction)} of findings in an Artemis-like atmosphere`,
      ]
    : [];

  return (
    <div className="bg-paper">
      {preload && <Preloader tasks={preload} onDone={endPreload} />}
      <Frame chapter={chapter} tone={tone} progressRef={progressRef} bandRef={bandRef} />
      <h1 className="sr-only">Passed on Earth. Safe on the Moon?</h1>

      {mode === 'webgl' ? <ConditionSpace onFrame={onFrame} reducedPointer={reducedPointer} /> : <StaticSpace />}

      {marquee.length > 0 && <Marquee items={marquee} />}

      <section className="border-b border-ink">
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 px-4 py-16 sm:px-6">
          <div className="col-span-12">
            <SectionLabel>The corpus</SectionLabel>
          </div>
          <div className="col-span-12 mt-6 grid grid-cols-1 border-t border-ink md:grid-cols-3">
            {[
              {
                value: findingsReady ? <CountUp value={data.findings.length} /> : '—',
                label: 'verified findings',
                sub: findingsReady ? `each quote machine-checked against its page, from ${nSources} source${nSources === 1 ? '' : 's'}` : 'findings.json not exported yet',
              },
              {
                value: findingsReady ? <CountUp value={experiments.length} /> : '—',
                label: 'experiments',
                sub: findingsReady ? 'distinct named investigations and tests' : 'findings.json not exported yet',
              },
              {
                value: findingsReady ? <CountUp value={(share.fraction ?? 0) * 100} format={(n) => (share.fraction !== null && share.fraction > 0 && share.fraction < 0.01 ? '<1%' : `${Math.round(n)}%`)} /> : '—',
                label: 'of findings from an Artemis-like atmosphere',
                key: true,
                sub: findingsReady ? (
                  <>
                    {share.count} of {share.total} · O₂ ≥ {ARTEMIS_LIKE.o2MinPercent}% and pressure ≤ {ARTEMIS_LIKE.pressureMaxKpa} kPa (10.2 psi), both stated by the source{' '}
                    {atmosphereClaims.map((c) => (
                      <Cite key={c.id} target={claimTarget(c)} />
                    ))}
                  </>
                ) : (
                  'findings.json not exported yet'
                ),
              },
            ].map((s, i) => (
              <div key={i} className={`border-b border-rule py-6 md:border-b-0 md:px-6 ${i > 0 ? 'md:border-l md:border-ink' : 'md:pl-0'}`}>
                <div className={`font-mono text-[clamp(3.5rem,7vw,6rem)] leading-none tabular ${s.key ? 'text-signal' : 'text-ink'}`}>{s.value}</div>
                <div className="mt-4 text-[17px] font-medium">{s.label}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-ink-2">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div
        ref={(el) => {
          afterRefs.current[0] = el;
        }}
      >
        <Timeline items={incidents} pinned={mode === 'webgl'} />
      </div>

      <section
        ref={(el) => {
          afterRefs.current[1] = el;
        }}
        className="border-b border-ink"
      >
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 px-4 py-16 sm:px-6">
          <div className="col-span-12">
            <SectionLabel index="09">Method</SectionLabel>
          </div>
          <MaskLines lines={['Every quote is checked against its page.']} className="col-span-12 mt-4 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-normal leading-[1.03] tracking-[-0.02em] lg:col-span-9" />
          <Reveal className="col-span-12 mt-10 grid grid-cols-1 border-t border-ink md:grid-cols-4">
            {[
              { n: '01', t: 'Collect', d: `PSI: ${data.investigations.length} investigations. NTRS: ${ntrsReports} NASA reports. Cached, so the demo needs no network.` },
              { n: '02', t: 'Extract', d: 'Per-page text from every PDF; findings and claims written with verbatim quotes and page numbers.' },
              {
                n: '03',
                t: 'Verify',
                d: v ? `Quote on the cited page, every number in the source: ${v.candidates} extracted → ${v.verified} verified, ${dropped} dropped. Failures are dropped, never hand-fixed.` : 'Quote on the cited page, every number in the source.',
              },
              { n: '04', t: 'Publish', d: 'Static JSON, cited in every view. AI summaries are labelled; null is shown as “—”, never 0.' },
            ].map((s, i) => (
              <div key={s.n} className={`py-6 md:px-6 ${i > 0 ? 'border-t border-rule md:border-l md:border-t-0 md:border-ink' : 'md:pl-0'}`}>
                <div className="font-mono text-[13px] text-ink">{s.n}</div>
                <div className="mt-2 text-[17px] font-semibold uppercase tracking-[0.06em]">{s.t}</div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 items-end gap-x-6 gap-y-6 px-4 py-20 sm:px-6">
          <MaskLines lines={['Where should NASA', <em className="italic">light the next fire?</em>]} className="col-span-12 font-display text-[clamp(2.4rem,6vw,5.5rem)] font-normal leading-[1] tracking-[-0.025em] lg:col-span-8" />
          <div className="col-span-12 flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
            <a href={href('/gap')} className="btn btn-primary">
              Explore the evidence →
            </a>
            <a href={href('/next')} className="btn">
              Next fire
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

