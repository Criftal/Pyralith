import { useData } from '../../lib/data';
import { useMission } from '../../lib/mission';
import { href } from '../../lib/router';
import { MaskLines, Reveal, Wipe } from '../Motion';
import { SectionLabel } from '../States';
import { buildSceneInput, G_ANCHORS, gx, oy } from './sceneData';
import { CHAPTERS, GapPreview, useStoryPanels } from './Story';

/** Static fallback (no WebGL, reduced motion or narrow screens): a gravity × O₂ projection with the panels stacked. */
export function StaticSpace() {
  const { data } = useData();
  const { mission } = useMission();
  const panels = useStoryPanels('night');
  const input = buildSceneInput(data.findings, data.missions);
  // Map world x [-6, 6] and y [-4, 4] to the SVG.
  const W = 640;
  const H = 420;
  const sx = (x: number) => 60 + ((x + 6) / 12) * (W - 90);
  const sy = (y: number) => H - 40 - ((y + 4) / 8) * (H - 70);
  const lunar0 = sx(gx(0.05));
  const lunar1 = sx(gx(0.27));
  return (
    <>
      <section className="border-b border-ink">
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 px-4 pb-16 pt-24 sm:px-6">
          <div className="col-span-12">
            <SectionLabel index="01">Passed on Earth</SectionLabel>
          </div>
          <MaskLines
            as="h1"
            lines={['Passed on Earth.', <>Safe on the <em className="italic">Moon?</em></>]}
            className="col-span-12 mt-6 font-display text-[clamp(3.2rem,11vw,9rem)] font-normal leading-[0.97] tracking-[-0.025em]"
          />
          <p className="col-span-12 mt-8 max-w-[34rem] text-[17px] leading-relaxed text-ink md:col-span-6">
            Every verified NASA combustion finding, placed in gravity × oxygen × pressure. Scroll to see where the Moon falls.
          </p>
        </div>
      </section>
      <section className="relative bg-night text-night-ink" data-tone="night">
        <div className="grain absolute inset-0" />
        <div className="relative mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 gap-y-10 px-4 py-16 sm:px-6">
          <div className="col-span-12">
            <SectionLabel index="02" tone="night">
              Condition space · gravity × O₂ projection
            </SectionLabel>
          </div>
          <Wipe className="col-span-12 lg:col-span-7">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Verified findings by gravity and oxygen; mission presets as rings">
              <rect x={lunar0} y={30} width={lunar1 - lunar0} height={H - 70} fill="#ECE8DE" fillOpacity="0.06" stroke="#ECE8DE" strokeOpacity="0.4" strokeWidth="1" />
              {G_ANCHORS.map((g) => (
                <g key={g}>
                  <line x1={sx(gx(g))} x2={sx(gx(g))} y1={30} y2={H - 40} stroke="#ECE8DE" strokeOpacity="0.35" strokeWidth="1" />
                  <text x={sx(gx(g))} y={H - 18} fill="#ECE8DE" fontSize="11" fontFamily="JetBrains Mono Variable, monospace" textAnchor="middle">
                    {g} g
                  </text>
                </g>
              ))}
              {[10, 30, 50, 70, 100].map((o) => (
                <g key={o}>
                  <line x1={56} x2={W - 30} y1={sy(oy(o))} y2={sy(oy(o))} stroke="#ECE8DE" strokeOpacity="0.12" strokeWidth="1" />
                  <text x={50} y={sy(oy(o)) + 4} fill="#8F8A7E" fontSize="10" fontFamily="JetBrains Mono Variable, monospace" textAnchor="end">
                    {o}%
                  </text>
                </g>
              ))}
              {input.points.map((p) =>
                p.psi ? (
                  <circle key={p.id} cx={sx(p.x)} cy={sy(p.y)} r={p.tier === 1 ? 4.5 : 3.5} fill="#8EA2F0" />
                ) : (
                  <circle key={p.id} cx={sx(p.x)} cy={sy(p.y)} r={p.tier === 1 ? 4.5 : 3.5} fill="none" stroke="#E34A1E" strokeWidth="1.25" />
                ),
              )}
              {input.rings.map((r) => (
                <circle key={r.id} cx={sx(r.x)} cy={sy(r.y)} r={r.highlight ? 9 : 7} fill="none" stroke={r.highlight ? '#E34A1E' : '#ECE8DE'} strokeOpacity={r.highlight ? 1 : 0.55} strokeWidth="1.25" />
              ))}
              <text x={W - 30} y={22} fill="#8F8A7E" fontSize="10" fontFamily="JetBrains Mono Variable, monospace" textAnchor="end">
                O₂ ↑ · gravity → (not to linear scale)
              </text>
            </svg>
          </Wipe>
          <Reveal className="col-span-12 space-y-8 lg:col-span-5">
            {panels.map((pn, i) => (
              <div key={pn.key} className="border-t border-night-ink/50 pt-4">
                <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-night-2">
                  <span className="text-night-ink">{String(i + 2).padStart(2, '0')}</span> — {CHAPTERS[pn.chapter]}
                </div>
                <h2 className="mt-2 font-display text-[clamp(1.6rem,4vw,2.3rem)] font-normal leading-[1.05] tracking-[-0.02em]">{pn.title}</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-night-ink/85">{pn.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
      <section className="border-b border-ink">
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 items-center gap-x-6 gap-y-8 px-4 py-16 sm:px-6">
          <div className="col-span-12 lg:col-span-5">
            <SectionLabel index="07">The gap map</SectionLabel>
            <h2 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.02em]">The whole picture, flattened.</h2>
            <a href={href('/gap')} className="btn btn-primary mt-6">
              Explore the evidence →
            </a>
          </div>
          <Wipe className="col-span-12 lg:col-span-6 lg:col-start-7">
            <GapPreview findings={data.findings} mission={mission} />
          </Wipe>
        </div>
      </section>
    </>
  );
}
