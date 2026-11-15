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
      <ScreenHeader kicker="Model-ready export" title="Download for modelling">
        Tidy CSV and JSON with explicit units (g, % O₂, kPa, cm/s), source ids, pages and quote-verified flags. Missing values stay missing: an empty CSV cell or a JSON
        null, never 0. Relevance is computed against <span className="text-text">{mission ? mission.name : 'the selected mission'}</span> with the current weights.
      </ScreenHeader>

      {missing.includes('findings') && (
        <div className="mb-4">
          <MissingData files={['findings']} what="Finding exports" />
        </div>
      )}

      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
          <Chips label="Safety" options={SAFETY} active={safety} onChange={setSafety} />
          <Chips label="Gravity" options={GBINS} active={gbins} onChange={setGbins} render={(k) => GLABEL[k] ?? k} />
          <label className="flex min-w-[16rem] flex-1 items-center gap-3 font-mono text-xs text-muted">
            <span className="whitespace-nowrap uppercase tracking-wider text-faint">Min relevance</span>
            <input type="range" min={0} max={1} step={0.05} value={minRel} onChange={(e) => setMinRel(Number(e.target.value))} className="w-full accent-[#FF6B1A]" aria-label="Minimum relevance to the mission" />
            <span className="w-10 text-right text-text tabular">{minRel.toFixed(2)}</span>
          </label>
        </div>
        <p className="mt-3 font-mono text-xs text-muted">
          {filtered.length} of {rows.length} verified findings match these filters.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {downloads.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={d.run}
              disabled={d.disabled}
              className="flex flex-col items-start gap-1 rounded-md border border-line-strong bg-panel-2 p-3 text-left transition-colors hover:border-flame disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="font-mono text-sm text-flame">↓ {d.name}</span>
              <span className="text-xs text-muted">{d.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="dictionary">
        <h2 id="dictionary" className="text-xl font-semibold">
          Data dictionary
        </h2>
        <p className="mt-1 text-sm text-muted">
          <span className="font-mono text-text">null = not stated in source; empty cell in CSV.</span> Canonical units: gravity in g (Earth = 1), oxygen in % by volume,
          pressure in kPa (absolute), flow in cm/s.
        </p>
        {(['findings', 'investigations'] as const).map((file) => (
          <div key={file} className="mt-4">
            <h3 className="font-mono text-sm text-cool">{file}.csv</h3>
            <div className="scroll-thin mt-2 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead className="bg-panel text-left text-xs text-muted">
                  <tr>
                    <th className="p-2 font-medium" scope="col">
                      Column
                    </th>
                    <th className="p-2 font-medium" scope="col">
                      Unit
                    </th>
                    <th className="p-2 font-medium" scope="col">
                      Definition
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_DICTIONARY.filter((d) => d.file === file).map((d) => (
                    <tr key={d.column} className="border-t border-line align-top">
                      <td className="p-2 font-mono text-xs whitespace-nowrap text-text">{d.column}</td>
                      <td className="p-2 font-mono text-xs whitespace-nowrap text-muted">{d.unit}</td>
                      <td className="p-2 text-xs leading-relaxed text-text/85">{d.definition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10" aria-labelledby="psi-sources">
        <h2 id="psi-sources" className="text-xl font-semibold">
          Original PSI data
        </h2>
        <p className="mt-1 text-sm text-muted">Each investigation’s PSI record and its experiment tables (one row per test run), for going straight to the raw data.</p>
        {missing.includes('investigations') ? (
          <div className="mt-3">
            <MissingData files={['investigations']} what="PSI links" />
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.investigations.map((inv) => {
              const tables = experimentTables(inv);
              return (
                <li key={inv.psi_id} className="min-w-0 rounded-lg border border-line bg-panel p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <a href={inv.source_url} target="_blank" rel="noreferrer" className="font-mono text-sm text-cool hover:underline">
                      {inv.psi_id} ↗
                    </a>
                    <span className="text-sm text-text">{inv.acronym ?? inv.name}</span>
                  </div>
                  {inv.acronym && <div className="mt-0.5 truncate text-xs text-muted">{inv.name}</div>}
                  <div className="mt-2 font-mono text-[0.68rem] uppercase tracking-wider text-faint">
                    Experiment tables ({tables.length}) · all files ({inv.data_files.length})
                  </div>
                  {tables.length ? (
                    <ul className="mt-1 space-y-0.5 font-mono text-xs">
                      {tables.map((t) => (
                        <li key={t.url + t.name} className="truncate">
                          <a href={t.url} target="_blank" rel="noreferrer" className="text-cool hover:underline" title={t.name}>
                            {t.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-faint">No experiment table listed on the PSI record.</p>
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
