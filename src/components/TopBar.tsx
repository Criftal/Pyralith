import type { CitedValue } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { citedShort } from '../lib/format';
import { href, type Route } from '../lib/router';
import { Cite, citedValueTarget } from './Cite';

const NAV: Array<{ to: Route; label: string }> = [
  { to: '/', label: 'Overview' },
  { to: '/mission', label: 'Mission' },
  { to: '/investigations', label: 'Investigations' },
  { to: '/gap', label: 'Gap Map' },
  { to: '/rank', label: 'Ranked findings' },
  { to: '/export', label: 'Export' },
  { to: '/next', label: 'Next fire' },
  { to: '/ask', label: 'Ask' },
];

export default function TopBar({ route }: { route: Route | null }) {
  return (
    <header className="z-40 border-b border-line bg-bg/92 backdrop-blur md:sticky md:top-0">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3">
          <a href={href('/')} className="font-mono text-sm font-semibold tracking-[0.32em] text-text">
            FIRE<span className="text-flame">BREAK</span>
          </a>
          <MissionSummary />
        </div>
        <nav aria-label="Screens" className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-1 py-2 text-sm whitespace-nowrap">
            {NAV.map((n) => {
              const active = route === n.to;
              return (
                <li key={n.to}>
                  <a
                    href={href(n.to)}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded px-2.5 py-1.5 transition-colors ${
                      active ? 'bg-panel-2 text-text shadow-[inset_0_-2px_0_var(--color-flame)]' : 'text-muted hover:text-text'
                    }`}
                  >
                    {n.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function MissionSummary() {
  const { mission } = useMission();
  const { loading, missing } = useData();
  if (!mission) {
    return (
      <div className="font-mono text-xs text-muted">
        Mission: {loading ? 'loading…' : missing.includes('missions') ? 'presets not exported yet' : 'not found'}
      </div>
    );
  }
  const values: Array<[string, CitedValue | null]> = [
    ['gravity', mission.gravity],
    ['O₂', mission.o2],
    ['pressure', mission.pressure],
    ['flow', mission.flow],
  ];
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-sm">
      <span className="text-muted">Mission:</span>
      <a href={href('/mission')} className="font-medium text-text hover:text-flame">
        {mission.name}
      </a>
      {values.map(([label, v]) =>
        v && v.value !== null ? (
          <span key={label} className="flex items-center gap-1.5">
            <span className="text-faint">·</span>
            <Cite target={citedValueTarget(v, `${mission.name}: ${label}`)} className="text-[0.78rem]">
              {citedShort(v)}
              {v.qualifier === 'assumed' ? ' (assumed)' : ''}
            </Cite>
          </span>
        ) : null,
      )}
    </div>
  );
}
