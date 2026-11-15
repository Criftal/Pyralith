import type { CitedValue, Mission } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { citedDisplay } from '../lib/format';
import { navigate } from '../lib/router';
import { Cite, citedValueTarget } from '../components/Cite';
import { Wipe } from '../components/Motion';
import { Loading, MissingData, ScreenHeader } from '../components/States';

const COLS: Array<[keyof Pick<Mission, 'gravity' | 'o2' | 'pressure' | 'flow'>, string]> = [
  ['gravity', 'Gravity'],
  ['o2', 'O₂'],
  ['pressure', 'Pressure'],
  ['flow', 'Flow'],
];

export default function MissionSelect() {
  const { data, loading, missing } = useData();
  const { id, setId } = useMission();
  if (loading) return <Loading />;
  return (
    <div>
      <ScreenHeader index="02" kicker="Mission environment" title="Where will the fire happen?">
        Each preset sets the gravity, oxygen, pressure and flow that the Gap Map, investigation relevance and rankings score against. Every value opens the verified quote it
        comes from.
      </ScreenHeader>
      {missing.includes('missions') ? (
        <MissingData files={['missions']} what="Mission presets" />
      ) : (
        <Wipe>
          <div className="scroll-thin overflow-x-auto">
            <table className="table-ed min-w-[52rem]">
              <thead>
                <tr>
                  <th scope="col">Mission</th>
                  {COLS.map(([, label]) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Select</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.missions.map((m) => {
                  const selected = m.id === id;
                  return (
                    <tr key={m.id} className={selected ? 'bg-paper-2' : ''}>
                      <th scope="row" className="text-left align-top">
                        <div className={`font-display text-[24px] font-normal leading-tight ${selected ? 'underline decoration-signal decoration-2 underline-offset-[6px]' : ''}`}>{m.name}</div>
                        {selected && <div className="label mt-1 text-ink">Selected</div>}
                      </th>
                      {COLS.map(([k, label]) => (
                        <ValueCell key={k} v={m[k] as CitedValue | null} title={`${m.name}: ${label}`} />
                      ))}
                      <td className="text-right align-top">
                        <button
                          type="button"
                          onClick={() => {
                            setId(m.id);
                            navigate('/gap');
                          }}
                          className={`btn btn-sm ${selected ? 'btn-primary' : ''}`}
                        >
                          {selected ? 'Open Gap Map →' : 'Select →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Wipe>
      )}
    </div>
  );
}

function ValueCell({ v, title }: { v: CitedValue | null; title: string }) {
  if (!v)
    return (
      <td className="align-top font-mono text-ink-3" title="No source in the corpus gives a value for this preset">
        —
      </td>
    );
  return (
    <td className="align-top">
      <div className="font-mono text-[14px] tabular">{citedDisplay(v)}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        {v.qualifier === 'assumed' && <span className="label text-ink">assumed</span>}
        <Cite target={citedValueTarget(v, title)} />
      </div>
      {v.note && <p className="mt-1 max-w-[16rem] text-[12px] leading-snug text-ink-2">{v.note}</p>}
    </td>
  );
}
