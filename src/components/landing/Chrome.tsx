import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMission } from '../../lib/mission';
import { formatValue } from '../../lib/format';
import { href } from '../../lib/router';
import { MissionPicker, NAV, NavLinks, Wordmark } from '../TopBar';
import { CHAPTERS } from './Story';

/** Preloader: covers font loading and the dynamic three.js/lenis imports, then wipes upward. */
export function Preloader({ tasks, onDone }: { tasks: Array<Promise<unknown>>; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const [out, setOut] = useState(false);
  const finished = useRef(false);
  useEffect(() => {
    let alive = true;
    const settled = new Set<number>();
    tasks.forEach((t, i) =>
      t.then(
        () => settled.add(i),
        () => settled.add(i),
      ),
    );
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (!alive) return;
      const real = tasks.length ? settled.size / tasks.length : 1;
      const timeCap = Math.min(0.92, (now - t0) / 1400); // never claim progress faster than the tasks finish
      const goal = real >= 1 ? 1 : Math.min(real * 0.92 + 0.05, timeCap);
      setShown((s) => s + (goal - s) * 0.14);
      const forced = now - t0 > 4000; // never hold the page longer than needed
      if (((real >= 1 && goal === 1) || forced) && !finished.current) {
        finished.current = true;
        setShown(1);
        window.setTimeout(() => alive && setOut(true), 180);
        window.setTimeout(() => alive && onDone(), 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [tasks, onDone]);
  return (
    <div className={`preloader fixed inset-0 z-[70] flex flex-col justify-between bg-paper px-6 py-6 ${out ? 'is-out' : ''}`} role="status" aria-label="Loading">
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-[15px] font-semibold tracking-[0.26em]">FIREBREAK</span>
        <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-3">Loading condition space</span>
      </div>
      <div className="flex items-end justify-between border-t border-ink pt-4">
        <span className="font-mono text-[clamp(4.5rem,16vw,13rem)] leading-[0.85] tabular">{String(Math.round(shown * 100)).padStart(3, '0')}</span>
        <span className="font-mono text-[12px] text-ink-3">%</span>
      </div>
    </div>
  );
}

/** Fixed corner frame for the landing: a solid top band (wordmark, nav + mission), section index, progress + readout. */
export function Frame({
  chapter,
  tone,
  progressRef,
  bandRef,
}: {
  chapter: number;
  tone: 'paper' | 'night';
  progressRef: RefObject<HTMLSpanElement | null>;
  bandRef?: RefObject<HTMLDivElement | null>;
}) {
  const { mission } = useMission();
  const [menu, setMenu] = useState(false);
  const night = tone === 'night';
  const ink = night ? 'text-night-ink' : 'text-ink';
  const sub = night ? 'text-night-2' : 'text-ink-2';
  const readout = mission
    ? [formatValue(mission.gravity?.value ?? null, 'g'), mission.o2?.value != null ? `${formatValue(mission.o2.value, '%')} O₂` : 'O₂ —', formatValue(mission.pressure?.value ?? null, 'kPa')].join(' · ')
    : '—';

  // Section index: fade the old label out, swap, fade the new one in (never two at once).
  const [shown, setShown] = useState(chapter);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (chapter === shown) return;
    setVisible(false);
    const t = window.setTimeout(() => {
      setShown(chapter);
      setVisible(true);
    }, 170);
    return () => window.clearTimeout(t);
  }, [chapter, shown]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        ref={bandRef}
        className={`pointer-events-auto absolute inset-x-0 top-0 flex h-14 items-center justify-between border-b px-4 sm:px-6 ${night ? 'border-night-ink/20 bg-night' : 'border-rule bg-paper'}`}
      >
        <div className={ink}>
          <Wordmark tone={tone} />
        </div>
        <div className="hidden items-center gap-8 xl:flex">
          <NavLinks route="/" tone={tone} />
          <MissionPicker tone={tone} />
        </div>
        <button type="button" onClick={() => setMenu((m) => !m)} className={`font-mono text-[12px] uppercase tracking-[0.08em] xl:hidden ${ink}`} aria-expanded={menu}>
          {menu ? 'Close' : 'Menu'}
        </button>
      </div>
      {menu && (
        <nav className="pointer-events-auto absolute inset-x-0 top-14 border-b border-ink bg-paper px-4 py-4 sm:px-6 xl:hidden" aria-label="Screens">
          <ul className="space-y-3">
            {NAV.map((n) => (
              <li key={n.to}>
                <a href={href(n.to)} className="font-display text-[28px] leading-none text-ink">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-rule pt-4">
            <MissionPicker align="start" />
          </div>
        </nav>
      )}
      <div
        className={`index-swap absolute bottom-4 left-4 hidden px-1 font-mono text-[11px] uppercase tracking-[0.08em] sm:left-5 md:block ${sub} ${night ? 'bg-night' : 'bg-paper'}`}
        style={{ opacity: visible ? 1 : 0 }}
        aria-live="polite"
      >
        <span className={ink}>{String(shown + 1).padStart(2, '0')}</span> / {String(CHAPTERS.length).padStart(2, '0')} — {CHAPTERS[shown]}
      </div>
      <div className={`absolute bottom-4 right-4 hidden items-center gap-4 font-mono text-[11px] tabular sm:right-6 md:flex ${sub}`}>
        <span>{readout}</span>
        <span className={`relative block h-px w-28 ${night ? 'bg-night-ink/25' : 'bg-rule-mid'}`} aria-hidden="true">
          <span ref={progressRef} className={`absolute inset-y-0 left-0 block w-full origin-left ${night ? 'bg-night-ink' : 'bg-ink'}`} style={{ transform: 'scaleX(0)' }} />
        </span>
      </div>
    </div>
  );
}

/** Restrained mono marquee built from computed corpus numbers. */
export function Marquee({ items }: { items: string[] }) {
  const line = items.join('   ·   ');
  return (
    <div className="marquee overflow-hidden border-y border-ink py-3" aria-label={line}>
      <div className="marquee-track" aria-hidden="true">
        {[0, 1].map((k) => (
          <span key={k} className="whitespace-nowrap pr-12 font-mono text-[13px] uppercase tracking-[0.08em] text-ink">
            {line}
            {'   ·   '}
          </span>
        ))}
      </div>
    </div>
  );
}
