import { useMemo, useState } from 'react';
import type { SafetyArea } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { useWeights } from '../lib/weights';
import { binOf, GRAVITY_BINS, UNSTATED } from '../lib/bins';
import { findingConditions, investigationConditions, missionConditions, relevance } from '../lib/score';
import {
  DATA_DICTIONARY,
  dictionaryCsv,
  dictionaryMarkdown,
  download,
  experimentTables,
  FINDING_COLUMNS,
  findingRow,
  INVESTIGATION_COLUMNS,
  investigationRow,
  toCsv,
} from '../lib/exporters';
import { Chips } from '../components/Chips';
import { Loading, MissingData, ScreenHeader } from '../components/States';
import { Wipe } from '../components/Motion';

const SAFETY: SafetyArea[] = ['prevention', 'detection', 'suppression'];
const GBINS = [...GRAVITY_BINS.map((b) => b.key), UNSTATED];
const GLABEL: Record<string, string> = Object.fromEntries([...GRAVITY_BINS.map((b) => [b.key, b.label] as const), [UNSTATED, 'Unstated'] as const]);

export default function Export() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const { params } = useWeights();
  const [safety, setSafety] = useState<Set<SafetyArea>>(new Set());
  const [gbins, setGbins] = useState<Set<string>>(new Set());
  const [minRel, setMinRel] = useState(0);

  const mc = missionConditions(mission);
  const rows = useMemo(
    () => data.findings.map((f) => ({ f, rel: relevance(findingConditions(f), mc, params).value })),
    [data.findings, mc.gravity, mc.o2, mc.pressure, mc.flow, params],
  );
  const invRows = useMemo(
    () => data.investigations.map((inv) => ({ inv, rel: relevance(investigationConditions(inv), mc, params).value })),
    [data.investigations, mc.gravity, mc.o2, mc.pressure, mc.flow, params],
  );
  const filtered = rows.filter(({ f, rel }) => {
    if (safety.size && !(f.safety_area ?? []).some((s) => safety.has(s))) return false;
    if (gbins.size && !gbins.has(binOf(f.gravity_g, GRAVITY_BINS))) return false;
    return rel >= minRel;
  });

  if (loading) return <Loading />;

  const missionMeta = mission
    ? { id: mission.id, name: mission.name, gravity_g: mc.gravity, o2_percent: mc.o2, pressure_kpa: mc.pressure, flow_cm_s: mc.flow }
    : null;

  const downloads = [
    {
      name: 'findings.csv',
      desc: `${filtered.length} findings · ${FINDING_COLUMNS.length} columns`,
      run: () => download('findings.csv', toCsv(FINDING_COLUMNS, filtered.map(({ f, rel }) => findingRow(f, data.sources, rel))), 'text/csv'),
      disabled: missing.includes('findings'),
    },
    {
      name: 'findings.json',
      desc: `${filtered.length} findings + mission, filters, weights, units`,
      run: () =>
        download(
          'findings.json',
          JSON.stringify(
            {
              generated_at: new Date().toISOString(),
              corpus_generated_at: data.meta?.generated_at ?? null,
              units: { gravity_g: 'g (Earth = 1)', o2_percent: '% O2 by volume', pressure_kpa: 'kPa (absolute)', flow_cm_s: 'cm/s' },
              null_means: 'not stated in source',
              mission: missionMeta,
              filters: { safety_area: [...safety], gravity_bins: [...gbins], min_relevance_to_mission: minRel },
              weights: params,
              disclaimer: 'Research exploration prototype, not for flight safety decisions.',
              findings: filtered.map(({ f, rel }) => findingRow(f, data.sources, rel)),
            },
            null,
            2,
          ),
          'application/json',
        ),
      disabled: missing.includes('findings'),
    },
    {
      name: 'investigations.csv',
      desc: `${invRows.length} PSI investigations · min/max per range`,
      run: () => download('investigations.csv', toCsv(INVESTIGATION_COLUMNS, invRows.map(({ inv, rel }) => investigationRow(inv, rel))), 'text/csv'),
      disabled: missing.includes('investigations'),
    },
    { name: 'data_dictionary.csv', desc: `${DATA_DICTIONARY.length} columns defined`, run: () => download('data_dictionary.csv', dictionaryCsv(), 'text/csv'), disabled: false },
    { name: 'data_dictionary.md', desc: 'same, as Markdown', run: () => download('data_dictionary.md', dictionaryMarkdown(), 'text/markdown'), disabled: false },
  ];

  return (
    <div>
      <ScreenHeader index="06" kicker="Model-ready export" title="Download for modelling">
        Tidy CSV and JSON with explicit units (g, % O₂, kPa, cm/s), source ids, pages and quote-verified flags. Missing values stay missing: an empty CSV cell or a JSON
        null, never 0. Relevance is computed against <span className="text-ink">{mission ? mission.name : 'the selected mission'}</span> with the current weights.
      </ScreenHeader>

      {missing.includes('findings') && (
        <div className="mb-6">
          <MissingData files={['findings']} what="Finding exports" />
        </div>
      )}

      <section aria-label="Filters and downloads">
        <div className="flex flex-col gap-3 border-b border-rule pb-4">
          <Chips label="Safety" options={SAFETY} active={safety} onChange={setSafety} />
          <Chips label="Gravity" options={GBINS} active={gbins} onChange={setGbins} render={(k) => GLABEL[k] ?? k} />
          <label className="flex max-w-xl items-center gap-4">
            <span className="label whitespace-nowrap">Min relevance</span>
            <input type="range" min={0} max={1} step={0.05} value={minRel} onChange={(e) => setMinRel(Number(e.target.value))} className="w-full" aria-label="Minimum relevance to the mission" />
            <span className="w-10 text-right font-mono text-[13px] tabular">{minRel.toFixed(2)}</span>
          </label>
        </div>
        <p className="mt-3 font-mono text-[12px] text-ink-3">
          {filtered.length} of {rows.length} verified findings match these filters.
        </p>
        <div className="mt-5 grid grid-cols-1 border-t border-ink sm:grid-cols-2 xl:grid-cols-5">
          {downloads.map((d, i) => (
            <div key={d.name} className={`flex flex-col items-start gap-3 border-b border-rule py-5 xl:border-b-0 ${i > 0 ? 'xl:border-l xl:border-rule xl:pl-5' : ''} sm:pr-5`}>
              <button type="button" onClick={d.run} disabled={d.disabled} className={`btn ${i === 0 ? 'btn-primary' : ''}`}>
                ↓ {d.name}
              </button>
              <span className="font-mono text-[12px] text-ink-2">{d.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="dictionary">
        <h2 id="dictionary" className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.03]">
          Data dictionary
        </h2>
        <p className="mt-2 max-w-[46rem] text-[16px] text-ink-2">
          <span className="font-mono text-[14px] text-ink">null = not stated in source; empty cell in CSV.</span> Canonical units: gravity in g (Earth = 1), oxygen in % by volume,
          pressure in kPa (absolute), flow in cm/s.
        </p>
        {(['findings', 'investigations'] as const).map((file) => (
          <Wipe key={file} className="mt-8">
            <h3 className="font-mono text-[13px] uppercase tracking-[0.08em]">{file}.csv</h3>
            <div className="scroll-thin mt-2 overflow-x-auto">
              <table className="table-ed min-w-[40rem]">
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_DICTIONARY.filter((d) => d.file === file).map((d) => (
                    <tr key={d.column}>
                      <td className="whitespace-nowrap font-mono text-[12.5px]">{d.column}</td>
                      <td className="whitespace-nowrap font-mono text-[12px] text-ink-2">{d.unit}</td>
                      <td className="text-[14px] leading-relaxed">{d.definition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Wipe>
        ))}
      </section>

      <section className="mt-16" aria-labelledby="psi-sources">
        <h2 id="psi-sources" className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.03]">
          Original PSI data
        </h2>
        <p className="mt-2 max-w-[46rem] text-[16px] text-ink-2">Each investigation’s PSI record and its experiment tables (one row per test run), for going straight to the raw data.</p>
        {missing.includes('investigations') ? (
          <div className="mt-4">
            <MissingData files={['investigations']} what="PSI links" />
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 border-t border-ink md:grid-cols-2 xl:grid-cols-3">
            {data.investigations.map((inv) => {
              const tables = experimentTables(inv);
              return (
                <li key={inv.psi_id} className="min-w-0 border-b border-rule py-4 md:pr-6">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <a href={inv.source_url} target="_blank" rel="noreferrer" className="link-draw font-mono text-[13px] text-flight">
                      {inv.psi_id} ↗
                    </a>
                    <span className="text-[15px] font-medium">{inv.acronym ?? inv.name}</span>
                  </div>
                  {inv.acronym && <div className="mt-0.5 truncate text-[13px] text-ink-2">{inv.name}</div>}
                  <div className="label mt-2">
                    Experiment tables ({tables.length}) · all files ({inv.data_files.length})
                  </div>
                  {tables.length ? (
                    <ul className="mt-1 space-y-0.5 font-mono text-[12px]">
                      {tables.map((t) => (
                        <li key={t.url + t.name} className="truncate">
                          <a href={t.url} target="_blank" rel="noreferrer" className="link-draw" title={t.name}>
                            {t.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[13px] text-ink-3">No experiment table listed on the PSI record.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
