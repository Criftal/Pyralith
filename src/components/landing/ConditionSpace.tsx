import { useEffect, useMemo, useRef } from 'react';
import { useData } from '../../lib/data';
import { useMission } from '../../lib/mission';
import { href } from '../../lib/router';
import { buildSceneInput } from './sceneData';
import { CHAPTERS, GapPreview, useStoryPanels } from './Story';
import type { FrameState } from './scene';

let sceneModule: Promise<typeof import('./scene')> | null = null;
export const loadSceneModule = () => (sceneModule ??= import('./scene'));

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Chapter a–e panel ranges (between keyframe midpoints) and the flattened-map preview range. */
const PANEL_BOUNDS = [0.08, 0.24, 0.4, 0.56, 0.72, 0.88];
// The flat preview is the scene's last screen: it appears on paper and stays until the pin releases,
// then leaves with the page, so the corpus section follows immediately (no empty viewport, no stuck fragment).
const PREVIEW_IN = 0.92;
const PAPER_RGB = [243, 240, 232];
const NIGHT_RGB = [13, 13, 12];
/** Same paper → night → paper curve the scene uses for its fog and lines. */
export function darknessAt(p: number): number {
  return smooth(0.03, 0.12, p) * (1 - smooth(0.88, 0.94, p));
}
function bgAt(d: number): string {
  return `rgb(${PAPER_RGB.map((v, i) => Math.round(v + (NIGHT_RGB[i] - v) * d)).join(', ')})`;
}
export function activePanel(p: number): number {
  for (let i = 0; i < PANEL_BOUNDS.length - 1; i++) if (p >= PANEL_BOUNDS[i] && p < PANEL_BOUNDS[i + 1]) return i;
  return -1;
}

export function sectionProgress(el: HTMLElement | null): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const travel = r.height - window.innerHeight;
  return travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
}

const LABELS: Array<{ key: string; text: string }> = [
  { key: 'g0', text: '0 g' },
  { key: 'g0.17', text: '0.17 g · lunar' },
  { key: 'g0.38', text: '0.38 g · Mars' },
  { key: 'g1', text: '1 g · Earth' },
  { key: 'o2lo', text: 'O₂ 10%' },
  { key: 'o2hi', text: 'O₂ 100%' },
  { key: 'kpa', text: 'pressure 20 → 330 kPa (log)' },
  { key: 'unstated', text: 'pressure not stated' },
  { key: 'artemis', text: 'Artemis lunar habitat' },
  { key: 'schematic', text: 'Schematic: not plotted from data' },
  { key: 'lunarpoint', text: 'lunar g' },
];

/** Pinned 3D section: the hero headline layered with the lattice, then six scroll chapters. */
export function ConditionSpace({ onFrame, reducedPointer }: { onFrame: (s: FrameState) => void; reducedPointer: boolean }) {
  const { data } = useData();
  const { mission } = useMission();
  const panels = useStoryPanels('night');
  const input = useMemo(() => buildSceneInput(data.findings, data.missions), [data.findings, data.missions]);
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const labelRefs = useRef<Record<string, HTMLElement | null>>({});
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  // DOM layer (hero layers, chapters, preview, band colour) follows scroll events directly, so its end
  // states never depend on the WebGL render loop; the scene keeps rendering in step via its own frame loop.
  const applyRef = useRef<(p: number) => void>(() => {});
  applyRef.current = (p: number) => {
    const darkness = darknessAt(p);
    const bg = bgAt(darkness);
    if (stickyRef.current) stickyRef.current.style.backgroundColor = bg;
    const heroOut = smooth(0.015, 0.09, p);
    if (backRef.current) {
      backRef.current.style.opacity = String(1 - heroOut);
      backRef.current.style.transform = `translate3d(${-heroOut * 8}vw, ${-heroOut * 22}vh, 0)`;
    }
    if (frontRef.current) {
      frontRef.current.style.opacity = String(1 - heroOut);
      frontRef.current.style.transform = `translate3d(${heroOut * 8}vw, ${heroOut * 22}vh, 0)`;
    }
    if (grainRef.current) grainRef.current.style.opacity = String(0.035 * darkness);
    if (canvasRef.current) canvasRef.current.style.opacity = String(1 - smooth(0.86, 0.93, p));
    // Each chapter is either fully on or off; CSS transitions the switch, so it never hangs half-faded.
    const active = activePanel(p);
    panels.forEach((pn, i) => {
      const el = panelRefs.current[pn.key];
      const on = i === active ? '1' : '0';
      if (el && el.dataset.active !== on) el.dataset.active = on;
    });
    if (gapRef.current) {
      const on = p >= PREVIEW_IN ? '1' : '0';
      if (gapRef.current.dataset.active !== on) gapRef.current.dataset.active = on;
    }
    onFrameRef.current({ p, darkness, bg });
  };

  useEffect(() => {
    const update = () => applyRef.current(sectionProgress(sectionRef.current));
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    loadSceneModule().then(({ createScene }) => {
      if (disposed || !canvasRef.current || !stickyRef.current) return;
      handle = createScene({
        canvas: canvasRef.current,
        container: stickyRef.current,
        input,
        labels: labelRefs.current,
        reducedPointer,
        getProgress: () => sectionProgress(sectionRef.current),
        onFrame: (st) => applyRef.current(st.p),
      });
    });
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [input, reducedPointer]);

  return (
    <section ref={sectionRef} className="relative" style={{ height: '580vh' }} aria-label="Condition space: where the evidence sits">
      <div ref={stickyRef} className="sticky top-0 h-[100svh] overflow-hidden bg-paper">
        {/* Back headline layer (behind the lattice). */}
        <div ref={backRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[12vh] z-0 mx-auto max-w-[1440px] px-6">
          <div className="font-display text-[clamp(4rem,11.5vw,11rem)] font-normal leading-[0.95] tracking-[-0.025em] text-ink">Passed on Earth.</div>
        </div>
        <canvas ref={canvasRef} className="absolute inset-0 z-10 h-full w-full" aria-hidden="true" />
        {/* Front headline layer (in front of the lattice). */}
        <div ref={frontRef} className="pointer-events-none absolute inset-x-0 bottom-[9vh] z-20 mx-auto max-w-[1440px] px-6">
          <div aria-hidden="true" className="text-right font-display text-[clamp(4rem,11.5vw,11rem)] font-normal leading-[0.95] tracking-[-0.025em] text-ink">
            Safe on the <em className="italic">Moon?</em>
          </div>
          <div className="mt-6 grid grid-cols-12 gap-x-6">
            <p className="col-span-12 text-[17px] leading-relaxed text-ink md:col-span-5">
              Every verified NASA combustion finding, placed in gravity × oxygen × pressure. Scroll to see where the Moon falls.
            </p>
            <p className="col-span-12 self-end font-mono text-[12px] uppercase tracking-[0.08em] text-ink-2 md:col-span-7 md:text-right">Scroll ↓</p>
          </div>
        </div>
        <div ref={grainRef} className="grain absolute inset-0 z-30" style={{ opacity: 0 }} />
        {/* Projected axis labels. */}
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
          {LABELS.map((l) => (
            <span
              key={l.key}
              ref={(el) => {
                labelRefs.current[l.key] = el;
              }}
              className="absolute left-0 top-0 whitespace-nowrap font-mono text-[11px] tracking-[0.04em]"
              style={{ opacity: 0 }}
            >
              <span className={`inline-block -translate-x-1/2 -translate-y-1/2 ${l.key === 'artemis' || l.key === 'lunarpoint' ? 'text-signal' : ''}`}>{l.text}</span>
            </span>
          ))}
        </div>
        {/* Chapter panels (DOM, cited). */}
        <div className="pointer-events-none absolute inset-0 z-40 mx-auto max-w-[1440px] px-6">
          {panels.map((pn, i) => (
            <div
              key={pn.key}
              ref={(el) => {
                panelRefs.current[pn.key] = el;
              }}
              data-active="0"
              className="chapter-panel absolute bottom-[10vh] left-6 max-w-[30rem] border-t border-night-ink/60 pt-4 text-night-ink"
            >
              <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-night-2">
                <span className="text-night-ink">{String(i + 2).padStart(2, '0')}</span> — {CHAPTERS[pn.chapter]}
              </div>
              <h2 className="mt-3 font-display text-[clamp(1.9rem,3.2vw,2.9rem)] font-normal leading-[1.03] tracking-[-0.02em]">{pn.title}</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-night-ink">{pn.body}</p>
            </div>
          ))}
        </div>
        {/* Final chapter: the flattened gap map. */}
        <div ref={gapRef} data-active="0" className="chapter-panel absolute inset-0 z-40 mx-auto flex max-w-[1440px] items-center px-6">
          <div className="grid w-full grid-cols-12 items-center gap-x-6 gap-y-6 pt-16">
            <div className="col-span-12 md:col-span-5">
              <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-3">
                <span className="text-ink">07</span> — The gap map
              </div>
              <h2 className="mt-3 font-display text-[clamp(2.2rem,4vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.02em] text-ink">The whole picture, flattened.</h2>
              <p className="mt-4 max-w-[28rem] text-[17px] leading-relaxed text-ink-2">Gravity across, oxygen up. Every cell links to its findings, quotes and sources.</p>
              <a href={href('/gap')} className="btn btn-primary mt-6">
                Explore the evidence →
              </a>
            </div>
            <div className="col-span-12 md:col-span-7 lg:col-span-6 lg:col-start-7">
              <GapPreview findings={data.findings} mission={mission} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
