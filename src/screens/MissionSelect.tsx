import type { CitedValue, Mission } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { citedDisplay } from '../lib/format';
import { navigate } from '../lib/router';
import { Cite, citedValueTarget } from '../components/Cite';
import { Loading, MissingData, ScreenHeader } from '../components/States';

export default function MissionSelect() {
  const { data, loading, missing } = useData();
  const { id, setId } = useMission();
  if (loading) return <Loading />;
  return (
    <div>
      <ScreenHeader kicker="Mission environment" title="Where will the fire happen?">
        Each preset sets the gravity, oxygen, pressure and flow that the Gap Map, investigation relevance and rankings score against. Every value opens the
        verified quote it comes from.
      </ScreenHeader>
      {missing.includes('missions') ? (
        <MissingData files={['missions']} what="Mission presets" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.missions.map((m) => (
            <MissionCard
              key={m.id}
              m={m}
              selected={m.id === id}
              onSelect={() => {
                setId(m.id);
                navigate('/gap');
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MissionCard({ m, selected, onSelect }: { m: Mission; selected: boolean; onSelect: () => void }) {
  const rows: Array<[string, CitedValue | null]> = [
    ['Gravity', m.gravity],
    ['O₂', m.o2],
    ['Pressure', m.pressure],
    ['Flow', m.flow],
  ];
  return (
    <article className={`flex flex-col rounded-xl border p-5 transition-colors ${selected ? 'border-flame bg-flame/[0.06]' : 'border-line bg-panel hover:border-line-strong'}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold leading-snug">{m.name}</h2>
        {selected && <span className="rounded border border-flame/60 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-flame">Selected</span>}
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map(([label, v]) => (
          <div key={label} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-2 text-right">
                {v ? (
                  <>
                    <span className="font-mono text-text">{citedDisplay(v)}</span>
                    {v.qualifier === 'assumed' && (
                      <span className="rounded border border-flame/50 px-1 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-flame-soft">assumed</span>
                    )}
                    <Cite target={citedValueTarget(v, `${m.name}: ${label}`)} />
                  </>
                ) : (
                  <span className="font-mono text-faint" title="No source in the corpus gives a value for this preset">
                    —
                  </span>
                )}
              </dd>
            </div>
            {v?.note && <p className="mt-1 text-xs leading-snug text-flame-soft/90">{v.note}</p>}
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-5 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
          selected ? 'bg-flame text-black hover:bg-flame-soft' : 'border border-line-strong text-text hover:border-flame hover:text-flame'
        }`}
      >
        {selected ? 'Open the Gap Map →' : 'Select this mission →'}
      </button>
    </article>
  );
}
