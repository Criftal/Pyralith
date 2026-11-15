import { useEffect, useRef } from 'react';
import type { Claim } from '../../types';
import { tidy } from '../../lib/format';
import { Cite, claimTarget } from '../Cite';
import { MaskLines } from '../Motion';
import { SectionLabel } from '../States';
import { sectionProgress } from './ConditionSpace';

export interface Incident {
  year: string;
  claim: Claim;
}

/** One incident per label, preferring the NASA incident page itself; year parsed from the label. */
export function incidentsFrom(claims: Claim[]): Incident[] {
  const rank = (c: Claim) => (c.source_id.startsWith('WEB:') ? 0 : 1) + (c.link ? 0 : 2);
  const best = new Map<string, Claim>();
  for (const c of claims.filter((x) => x.topic === 'incident')) {
    const key = (c.label ?? c.id).toLowerCase();
    const cur = best.get(key);
    if (!cur || rank(c) < rank(cur)) best.set(key, c);
  }
  const linked = [...best.values()].filter((c) => c.link);
  return (linked.length ? linked : [...best.values()])
    .map((c) => ({ year: (c.label ?? '').match(/(1[89]\d\d|20\d\d)/)?.[1] ?? '', claim: c }))
    .sort((a, b) => a.year.localeCompare(b.year))
    .slice(0, 4);
}

/**
 * One incident: year and description form a single column unit (same box, same transform).
 * The year is sized to fit its column so nothing can spill into the neighbour.
 */
function Item({ it, pinned }: { it: Incident; pinned: boolean }) {
  const name = (it.claim.label ?? '').replace(/\s*\(\d{4}\)\s*/, '').trim();
  return (
    <article className="flex min-w-0 flex-col">
      <div
        className={`font-display font-normal leading-[0.85] tracking-[-0.03em] text-ink tabular ${
          pinned ? 'text-[clamp(5rem,14vw,12.5rem)]' : 'text-[clamp(4rem,8.5vw,8rem)]'
        }`}
      >
        {it.year || '—'}
      </div>
      <div className="mt-6 border-t border-ink pt-4">
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em]">{name}</div>
        <p className="mt-2 max-w-[26rem] text-[17px] leading-relaxed text-ink">
          {tidy(it.claim.text)} <Cite target={claimTarget(it.claim)} />
        </p>
        {it.claim.link && (
          <a href={it.claim.link} target="_blank" rel="noreferrer" className="link-draw mt-3 inline-block font-mono text-[12px] text-ink-2">
            NASA page ↗
          </a>
        )}
      </div>
    </article>
  );
}

/** "Why this matters": pinned, scrolls horizontally on desktop; a vertical list otherwise. */
export function Timeline({ items, pinned }: { items: Incident[]; pinned: boolean }) {
  const secRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Driven by scroll events (Lenis emits them every smoothed frame), so nothing runs while idle.
  useEffect(() => {
    if (!pinned) return;
    const update = () => {
      if (!trackRef.current || !secRef.current) return;
      const p = sectionProgress(secRef.current);
      const max = Math.max(0, trackRef.current.scrollWidth - window.innerWidth + 48);
      trackRef.current.style.transform = `translate3d(${-p * max}px, 0, 0)`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pinned]);

  if (items.length === 0) return null;
  if (!pinned) {
    return (
      <section className="border-b border-ink">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6">
          <SectionLabel index="08">Why this matters</SectionLabel>
          <div className="mt-8 grid grid-cols-1 gap-12 md:grid-cols-3">
            {items.map((it) => (
              <div key={it.claim.id} className="min-w-0 overflow-hidden">
                <Item it={it} pinned={false} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section ref={secRef} className="relative border-b border-ink" style={{ height: `${120 + items.length * 70}vh` }} aria-label="Why this matters">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-[1440px] px-6">
          <SectionLabel index="08">Why this matters</SectionLabel>
          <MaskLines as="h2" lines={['Fire in a sealed cabin has a history.']} className="mt-3 font-display text-[clamp(2rem,3.6vw,3.2rem)] font-normal leading-[1.03] tracking-[-0.02em]" />
        </div>
        <div className="relative mt-10">
          <div className="absolute inset-x-0 top-[6.2rem] h-px bg-ink" aria-hidden="true" />
          {/* One transform for the whole track; each column clips its own content, so columns can never overlap. */}
          <div ref={trackRef} className="flex gap-[8vw] pl-6 pr-[20vw] will-change-transform">
            {items.map((it) => (
              <div key={it.claim.id} className="w-[min(36rem,72vw)] shrink-0 overflow-hidden [contain:paint]">
                <Item it={it} pinned />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
