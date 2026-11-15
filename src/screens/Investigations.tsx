import { Fragment, useMemo, useState } from 'react';
import type { FuelPhase, HardwareGroup, Investigation, SafetyArea } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { formatRange } from '../lib/format';
import { describeRelevance, investigationConditions, missionConditions, relevance, type RelevanceResult } from '../lib/score';
import { compareInvestigations, type CompareRow } from '../lib/compare';
import { SafetyTags } from '../components/Badges';
import { EmptyNote, Loading, MissingData, ScreenHeader } from '../components/States';

type SortKey = 'psi_id' | 'name' | 'hardware_group' | 'fuel' | 'o2' | 'pressure' | 'flow' | 'sensors' | 'files' | 'relevance';

const HARDWARE: HardwareGroup[] = ['ACME-CIR', 'MDCA-CIR', 'MSG-SPICE-duct', 'other'];
const PHASES: FuelPhase[] = ['solid', 'liquid', 'gas'];
const SAFETY: SafetyArea[] = ['prevention', 'detection', 'suppression'];

interface Row {
  inv: Investigation;
  rel: RelevanceResult;
}

function psiNumber(id: string): number {
  const m = id.match(/(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

function sortValue(r: Row, key: SortKey): string | number | null {
  const i = r.inv;
  switch (key) {
    case 'psi_id':
      return psiNumber(i.psi_id);
    case 'name':
      return (i.acronym ?? i.name).toLowerCase();
    case 'hardware_group':
      return i.hardware_group;
    case 'fuel':
      return `${i.fuel_phase.join('/')} ${i.fuel ?? ''}`.trim().toLowerCase() || null;
    case 'o2':
      return i.o2_range_percent ? i.o2_range_percent[1] : null;
    case 'pressure':
      return i.pressure_range_kpa ? i.pressure_range_kpa[0] : null;
    case 'flow':
      return i.flow_range_cm_s ? i.flow_range_cm_s[1] : null;
    case 'sensors':
      return i.sensors.length;
    case 'files':
      return i.data_files.length;
    case 'relevance':
      return r.rel.value;
  }
}

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

function pubLink(p: string): { label: string; url: string | null } {
  if (p.startsWith('NTRS:')) {
    const id = p.slice(5);
    return { label: `NTRS ${id}`, url: `https://ntrs.nasa.gov/citations/${id}` };
  }
  if (p.startsWith('DOI:')) {
    const doi = p.slice(4);
    return { label: `doi:${doi}`, url: `https://doi.org/${doi}` };
  }
  return { label: p, url: null };
}

export default function Investigations() {
  const { data, loading, missing } = useData();
  const { mission } = useMission();
  const [q, setQ] = useState('');
  const [hw, setHw] = useState<Set<HardwareGroup>>(new Set());
  const [phase, setPhase] = useState<Set<FuelPhase>>(new Set());
  const [safety, setSafety] = useState<Set<SafetyArea>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'relevance', dir: -1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const mc = missionConditions(mission);
  const rows: Row[] = useMemo(
    () => data.investigations.map((inv) => ({ inv, rel: relevance(investigationConditions(inv), mc) })),
    [data.investigations, mc.gravity, mc.o2, mc.pressure, mc.flow],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(({ inv }) => {
      if (hw.size && !hw.has(inv.hardware_group)) return false;
      if (phase.size && !inv.fuel_phase.some((p) => phase.has(p))) return false;
      if (safety.size && !inv.safety_area.some((s) => safety.has(s))) return false;
      if (!needle) return true;
      const hay = [inv.psi_id, inv.name, inv.acronym, inv.fuel, inv.fuel_shape, inv.hardware_group, inv.platform, inv.objectives, ...inv.sensors, ...inv.measurement_types, ...inv.variables]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, hw, phase, safety]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // nulls last in both directions
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [filtered, sort]);

  const selectedInvs = selected.map((id) => data.investigations.find((i) => i.psi_id === id)).filter((x): x is Investigation => Boolean(x));
  const relById = new Map(rows.map((r) => [r.inv.psi_id, r.rel]));

  if (loading) return <Loading />;

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'relevance' || key === 'files' || key === 'sensors' ? -1 : 1 }));

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));

  return (
    <div>
      <ScreenHeader kicker="Investigation Explorer" title="Every PSI combustion investigation, side by side">
        Filter by hardware, fuel and safety area; relevance is scored against{' '}
        <span className="text-text">{mission ? mission.name : 'the selected mission'}</span>. Tick two or three rows to compare them.
      </ScreenHeader>

      {missing.includes('investigations') ? (
        <MissingData files={['investigations']} what="The investigation table" />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter: name, fuel, sensor…"
              aria-label="Text filter"
              className="w-full rounded-md border border-line-strong bg-panel px-3 py-2 text-sm text-text placeholder:text-faint lg:w-72"
            />
            <Facet label="Hardware" options={HARDWARE} active={hw} onToggle={(v) => setHw((s) => toggle(s, v))} />
            <Facet label="Fuel" options={PHASES} active={phase} onToggle={(v) => setPhase((s) => toggle(s, v))} />
            <Facet label="Safety" options={SAFETY} active={safety} onToggle={(v) => setSafety((s) => toggle(s, v))} />
          </div>

          {selectedInvs.length >= 2 && (
            <ComparePanel invs={selectedInvs} relById={relById} onClear={() => setSelected([])} />
          )}
          {selectedInvs.length === 1 && <p className="mb-3 font-mono text-xs text-muted">1 selected · tick one or two more to compare.</p>}

          <p className="mb-2 font-mono text-xs text-muted">
            {sorted.length} of {rows.length} investigations · relevance = exp(−½ Σ (gap/scale)²) × 0.8^(unstated dimensions), a ranking heuristic, not physics
          </p>

          <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[68rem] border-collapse text-sm">
              <thead className="bg-panel text-left text-xs text-muted">
                <tr>
                  <th className="w-8 p-2" scope="col">
                    <span className="sr-only">Compare</span>
                  </th>
                  <Th k="psi_id" sort={sort} onSort={setSortKey}>PSI</Th>
                  <Th k="name" sort={sort} onSort={setSortKey}>Investigation</Th>
                  <Th k="hardware_group" sort={sort} onSort={setSortKey}>Hardware</Th>
                  <Th k="fuel" sort={sort} onSort={setSortKey}>Fuel</Th>
                  <Th k="o2" sort={sort} onSort={setSortKey}>O₂ %</Th>
                  <Th k="pressure" sort={sort} onSort={setSortKey}>Pressure</Th>
                  <Th k="flow" sort={sort} onSort={setSortKey}>Flow</Th>
                  <Th k="sensors" sort={sort} onSort={setSortKey}>Sensors</Th>
                  <th className="p-2 font-medium" scope="col">Safety</th>
                  <Th k="files" sort={sort} onSort={setSortKey}>Files</Th>
                  <Th k="relevance" sort={sort} onSort={setSortKey}>Relevance</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ inv, rel }) => {
                  const isSel = selected.includes(inv.psi_id);
                  const isOpen = expanded === inv.psi_id;
                  return (
                    <Fragment key={inv.psi_id}>
                      <tr className={`border-t border-line align-top ${isSel ? 'bg-flame/[0.06]' : 'hover:bg-panel-2/60'}`}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={isSel}
                            disabled={!isSel && selected.length >= 3}
                            onChange={() => toggleSelect(inv.psi_id)}
                            aria-label={`Compare ${inv.acronym ?? inv.name}`}
                            className="h-4 w-4 accent-[#FF6B1A]"
                          />
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap">
                          <a href={inv.source_url} target="_blank" rel="noreferrer" className="text-cool hover:underline">
                            {inv.psi_id}
                          </a>
                        </td>
                        <td className="p-2">
                          <div className="font-medium text-text">
                            {inv.acronym ?? inv.name}
                            {inv.acronym && inv.acronym !== inv.name && <span className="ml-1 font-normal text-muted">· {inv.name}</span>}
                          </div>
                          <div className="font-mono text-xs text-muted">{[inv.platform, inv.years].filter(Boolean).join(' · ') || '—'}</div>
                          <button type="button" onClick={() => setExpanded(isOpen ? null : inv.psi_id)} className="mt-1 font-mono text-xs text-cool hover:underline" aria-expanded={isOpen}>
                            {isOpen ? 'hide details' : 'details'}
                          </button>
                        </td>
                        <td className="p-2 font-mono text-xs whitespace-nowrap">{inv.hardware_group}</td>
                        <td className="p-2">
                          <div className="text-text">{inv.fuel_phase.length ? inv.fuel_phase.join(' / ') : '—'}</div>
                          <div className="text-xs text-muted">{[inv.fuel, inv.fuel_shape, inv.sample_size].filter(Boolean).join(' · ') || '—'}</div>
                        </td>
                        <td className="p-2 font-mono whitespace-nowrap tabular">{formatRange(inv.o2_range_percent, '%')}</td>
                        <td className="p-2 font-mono whitespace-nowrap tabular">{formatRange(inv.pressure_range_kpa, 'kPa')}</td>
                        <td className="p-2 font-mono whitespace-nowrap tabular">{formatRange(inv.flow_range_cm_s, 'cm/s')}</td>
                        <td className="p-2 text-xs" title={inv.sensors.join(', ')}>
                          {inv.sensors.length ? (
                            <>
                              <span className="font-mono text-text">{inv.sensors.length}</span>{' '}
                              <span className="text-muted">
                                {inv.sensors.slice(0, 2).join(', ')}
                                {inv.sensors.length > 2 ? '…' : ''}
                              </span>
                            </>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <SafetyTags areas={inv.safety_area} />
                            {inv.safety_area.length === 0 && <span className="text-faint">—</span>}
                          </div>
                        </td>
                        <td className="p-2 font-mono tabular" title={inv.data_files.map((f) => f.name).join('\n')}>
                          {inv.data_files.length}
                        </td>
                        <td className="p-2" title={describeRelevance(rel)}>
                          <RelevanceBar value={rel.value} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-line bg-panel/60">
                          <td />
                          <td colSpan={11} className="p-3">
                            <Details inv={inv} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length === 0 && (
            <div className="mt-3">
              <EmptyNote>No investigation matches these filters.</EmptyNote>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Th({ k, sort, onSort, children }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: string }) {
  const active = sort.key === k;
  return (
    <th className="p-2 font-medium" scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-text ${active ? 'text-text' : ''}`}>
        {children}
        <span className="font-mono text-[0.6rem] text-faint">{active ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function Facet<T extends string>({ label, options, active, onToggle }: { label: string; options: T[]; active: Set<T>; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">{label}</span>
      {options.map((o) => {
        const on = active.has(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${on ? 'border-cool bg-cool/15 text-cool' : 'border-line-strong text-muted hover:text-text'}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function RelevanceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-flame" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular text-text">{value.toFixed(2)}</span>
    </div>
  );
}

function Details({ inv }: { inv: Investigation }) {
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : '—');
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div className="space-y-3">
        <div>
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Objectives (verbatim from PSI)</div>
          <p className="mt-1 leading-relaxed text-text/90">{inv.objectives ?? '—'}</p>
        </div>
        <div>
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Variables</div>
          <p className="mt-1 text-text/90">{list(inv.variables)}</p>
        </div>
        {inv.within_investigation_differences && (
          <div>
            <div className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Differences within the investigation</div>
            <p className="mt-1 text-text/90">{inv.within_investigation_differences}</p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Sensors · measurements</div>
          <p className="mt-1 text-text/90">{list(inv.sensors)}</p>
          <p className="mt-1 text-muted">{list(inv.measurement_types)}</p>
        </div>
        <div>
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Data files ({inv.data_files.length})</div>
          {inv.data_files.length ? (
            <ul className="mt-1 space-y-0.5 font-mono text-xs">
              {inv.data_files.map((f) => (
                <li key={f.url + f.name}>
                  <a href={f.url} target="_blank" rel="noreferrer" className="text-cool hover:underline">
                    {f.name}
                  </a>
                  {f.format && <span className="text-faint"> · {f.format}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-faint">—</p>
          )}
        </div>
        <div>
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Publications ({inv.publications.length})</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
            {inv.publications.length === 0 && <span className="text-faint">—</span>}
            {inv.publications.map((p) => {
              const l = pubLink(p);
              return l.url ? (
                <a key={p} href={l.url} target="_blank" rel="noreferrer" className="text-cool hover:underline">
                  {l.label}
                </a>
              ) : (
                <span key={p}>{l.label}</span>
              );
            })}
          </div>
        </div>
        <a href={inv.source_url} target="_blank" rel="noreferrer" className="inline-block font-mono text-xs text-cool hover:underline">
          Open the PSI record ↗
        </a>
      </div>
    </div>
  );
}

function ComparePanel({ invs, relById, onClear }: { invs: Investigation[]; relById: Map<string, RelevanceResult>; onClear: () => void }) {
  const { rows, summary } = compareInvestigations(invs, (inv) => relById.get(inv.psi_id)?.value ?? null);
  return (
    <section className="mb-6 rounded-lg border border-line-strong bg-panel p-4" aria-label="Compare investigations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Compare · {invs.map((i) => i.acronym ?? i.psi_id).join(' vs ')}</h2>
        <button type="button" onClick={onClear} className="font-mono text-xs text-muted hover:text-text">
          clear selection
        </button>
      </div>
      <div className="mt-3 rounded-md border border-line bg-panel-2 p-3 text-sm leading-relaxed">
        <div className="mb-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          How these differ · auto-generated from PSI records {invs.map((i) => i.psi_id).join(', ')} (template, not AI)
        </div>
        <p className="text-text/90">{summary}</p>
      </div>
      <div className="scroll-thin mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="p-2 font-medium" scope="col">
                Attribute
              </th>
              {invs.map((i) => (
                <th key={i.psi_id} className="p-2 font-medium" scope="col">
                  <span className="font-mono text-cool">{i.psi_id}</span> <span className="text-text">{i.acronym ?? i.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CompareTr key={r.key} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompareTr({ row }: { row: CompareRow }) {
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className={`p-2 text-left text-xs font-medium ${row.differs ? 'text-flame' : 'text-muted'}`}>
        {row.label}
        {row.differs && <span className="sr-only"> (differs)</span>}
      </th>
      {row.values.map((v, idx) => (
        <td key={idx} className={`p-2 ${row.differs && v !== '—' ? 'bg-flame/[0.08] text-text shadow-[inset_2px_0_0_var(--color-flame)]' : v === '—' ? 'text-faint' : 'text-text/85'} ${row.mono ? 'font-mono text-xs' : ''}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}

