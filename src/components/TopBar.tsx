import { useEffect, useRef, useState } from 'react';
import type { CitedValue, MissionId } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { citedShort } from '../lib/format';
import { href, type Route } from '../lib/router';
import { Cite, citedValueTarget } from './Cite';

export const NAV: Array<{ to: Route; label: string }> = [
  { to: '/gap', label: 'Gap Map' },
  { to: '/investigations', label: 'Investigations' },
  { to: '/rank', label: 'Ranked' },
  { to: '/next', label: 'Next fire' },
  { to: '/export', label: 'Export' },
  { to: '/ask', label: 'Ask' },
  { to: '/mission', label: 'Missions' },
];

type Tone = 'paper' | 'night';

export function Wordmark({ tone = 'paper' }: { tone?: Tone }) {
  return (
    <a href={href('/')} className={`font-sans text-[15px] font-semibold tracking-[0.26em] ${tone === 'night' ? 'text-night-ink' : 'text-ink'}`} aria-label="FIREBREAK home">
      FIREBREAK
    </a>
  );
}

/** Text links with a vermilion underline that slides to the active item. */
export function NavLinks({ route, tone = 'paper', className = '' }: { route: Route | null; tone?: Tone; className?: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = listRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      setBar(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [route]);
  return (
    <nav aria-label="Screens" className={`scroll-thin relative overflow-x-auto ${className}`}>
      <ul ref={listRef} className="relative flex gap-x-6 whitespace-nowrap">
        {NAV.map((n) => {
          const active = route === n.to;
          return (
            <li key={n.to}>
              <a
                href={href(n.to)}
                aria-current={active ? 'page' : undefined}
                className={`block py-3 text-[13px] font-medium uppercase tracking-[0.06em] ${
                  tone === 'night' ? (active ? 'text-night-ink' : 'text-night-2 hover:text-night-ink') : active ? 'text-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {n.label}
              </a>
            </li>
          );
        })}
        {bar && (
          <li aria-hidden="true" className="nav-underline pointer-events-none absolute bottom-0 left-0 h-[2px] bg-signal" style={{ width: bar.w, transform: `translateX(${bar.x}px)` }} />
        )}
      </ul>
    </nav>
  );
}

/** Compact mission select with the preset's values in mono, each opening its citation. */
export function MissionPicker({ tone = 'paper', align = 'end' }: { tone?: Tone; align?: 'start' | 'end' }) {
  const { data, loading, missing } = useData();
  const { id, setId, mission } = useMission();
  const night = tone === 'night';
  const values: Array<[string, CitedValue | null]> = mission
    ? [
        ['gravity', mission.gravity],
        ['O₂', mission.o2],
        ['pressure', mission.pressure],
      ]
    : [];
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${align === 'end' ? 'items-end text-right' : 'items-start'}`}>
      <label className="flex items-baseline gap-2">
        <span className={`label ${night ? 'text-night-2' : ''}`}>Mission</span>
        <select
          value={id}
          onChange={(e) => setId(e.target.value as MissionId)}
          disabled={data.missions.length === 0}
          className={`max-w-[12.5rem] cursor-pointer border-0 border-b bg-transparent py-0.5 text-[13px] font-medium ${night ? 'border-night-ink text-night-ink' : 'border-ink text-ink'}`}
        >
          {data.missions.length === 0 ? (
            <option value={id}>{loading ? 'loading…' : missing.includes('missions') ? 'presets not exported' : '—'}</option>
          ) : (
            data.missions.map((m) => (
              <option key={m.id} value={m.id} className="bg-paper text-ink">
                {m.name}
              </option>
            ))
          )}
        </select>
      </label>
      {mission && (
        <div className={`font-mono text-[11px] tabular ${night ? 'text-night-2' : 'text-ink-2'}`}>
          {values.map(([label, v], i) => (
            <span key={label}>
              {i > 0 && ' · '}
              {v && v.value !== null ? (
                <Cite target={citedValueTarget(v, `${mission.name}: ${label}`)} tone={tone}>
                  {citedShort(v)}
                  {v.qualifier === 'assumed' ? ' (assumed)' : ''}
                </Cite>
              ) : (
                <span title="No source in the corpus states this">{label === 'O₂' ? 'O₂ —' : '—'}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ route }: { route: Route | null }) {
  return (
    <header className="z-40 border-b border-ink bg-paper md:sticky md:top-0">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 items-center gap-x-6 px-4 sm:px-6">
        <div className="col-span-5 py-3 md:col-span-2">
          <Wordmark />
        </div>
        <div className="col-span-7 flex justify-end py-2 md:order-3 md:col-span-3">
          <MissionPicker />
        </div>
        <div className="col-span-12 border-t border-rule md:order-2 md:col-span-7 md:border-t-0">
          <NavLinks route={route} />
        </div>
      </div>
    </header>
  );
}
