import { Fragment, useMemo, useState } from 'react';
import type { FuelPhase, HardwareGroup, Investigation, SafetyArea } from '../types';
import { useData } from '../lib/data';
import { useMission } from '../lib/mission';
import { formatRange } from '../lib/format';
import { describeRelevance, investigationConditions, missionConditions, relevance, type RelevanceResult } from '../lib/score';
import { compareInvestigations, type CompareRow } from '../lib/compare';
import { EmptyNote, Loading, MissingData, ScreenHeader } from '../components/States';
import { Chips } from '../components/Chips';
import { Wipe } from '../components/Motion';

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
      <ScreenHeader index="04" kicker="Investigation Explorer" title="Every PSI combustion investigation, side by side">
        Filter by hardware, fuel and safety area; relevance is scored against <span className="text-ink">{mission ? mission.name : 'the selected mission'}</span>. Tick two or three
        rows to compare them.
      </ScreenHeader>

      {missing.includes('investigations') ? (
        <MissingData files={['investigations']} what="The investigation table" />
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-rule pb-4">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter: name, fuel, sensor…" aria-label="Text filter" className="input-line max-w-md text-[16px]" />
            <Chips label="Hardware" options={HARDWARE} active={hw} onChange={setHw} />
            <Chips label="Fuel" options={PHASES} active={phase} onChange={setPhase} />
            <Chips label="Safety" options={SAFETY} active={safety} onChange={setSafety} />
          </div>

          {selectedInvs.length >= 2 && <ComparePanel invs={selectedInvs} relById={relById} onClear={() => setSelected([])} />}
          {selectedInvs.length === 1 && <p className="mt-3 font-mono text-[12px] text-ink-2">1 selected · tick one or two more to compare.</p>}

          <p className="mt-3 font-mono text-[12px] text-ink-3">
            {sorted.length} of {rows.length} investigations · relevance = exp(−½ Σ (gap/scale)²) × 0.8^(unstated dimensions), a ranking heuristic, not physics
          </p>

          <Wipe className="mt-4">
            <div className="scroll-thin overflow-x-auto">
              <table className="table-ed min-w-[70rem]">
                <thead>
                  <tr>
                    <th className="w-8" scope="col">
                      <span className="sr-only">Compare</span>
                    </th>
                    <Th k="psi_id" sort={sort} onSort={setSortKey}>PSI</Th>
                    <Th k="name" sort={sort} onSort={setSortKey}>Investigation</Th>
                    <Th k="hardware_group" sort={sort} onSort={setSortKey}>Hardware</Th>
                    <Th k="fuel" sort={sort} onSort={setSortKey}>Fuel</Th>
                    <Th k="o2" sort={sort} onSort={setSortKey} num>O₂ %</Th>
                    <Th k="pressure" sort={sort} onSort={setSortKey} num>kPa</Th>
                    <Th k="flow" sort={sort} onSort={setSortKey} num>cm/s</Th>
                    <Th k="sensors" sort={sort} onSort={setSortKey} num>Sensors</Th>
                    <th scope="col">Safety</th>
                    <Th k="files" sort={sort} onSort={setSortKey} num>Files</Th>
                    <Th k="relevance" sort={sort} onSort={setSortKey} num>Relevance</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ inv, rel }) => {
                    const isSel = selected.includes(inv.psi_id);
                    const isOpen = expanded === inv.psi_id;
                    return (
                      <Fragment key={inv.psi_id}>
                        <tr className={isSel ? 'bg-paper-2' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSel}
                              disabled={!isSel && selected.length >= 3}
                              onChange={() => toggleSelect(inv.psi_id)}
                              aria-label={`Compare ${inv.acronym ?? inv.name}`}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="whitespace-nowrap font-mono text-[13px]">
                            <a href={inv.source_url} target="_blank" rel="noreferrer" className="link-draw text-flight">
                              {inv.psi_id}
                            </a>
                          </td>
                          <td>
                            <div className="font-medium">
                              {inv.acronym ?? inv.name}
                              {inv.acronym && inv.acronym !== inv.name && <span className="ml-1 font-normal text-ink-2">· {inv.name}</span>}
                            </div>
                            <div className="font-mono text-[11px] text-ink-3">{[inv.platform, inv.years].filter(Boolean).join(' · ') || '—'}</div>
                            <button type="button" onClick={() => setExpanded(isOpen ? null : inv.psi_id)} className="link-draw mt-1 font-mono text-[11px] text-ink" aria-expanded={isOpen}>
                              {isOpen ? 'hide details' : 'details'}
                            </button>
                          </td>
                          <td className="whitespace-nowrap font-mono text-[12px]">{inv.hardware_group}</td>
                          <td>
                            <div>{inv.fuel_phase.length ? inv.fuel_phase.join(' / ') : '—'}</div>
                            <div className="text-[12px] text-ink-2">{[inv.fuel, inv.fuel_shape, inv.sample_size].filter(Boolean).join(' · ') || '—'}</div>
                          </td>
                          <td className="num">{formatRange(inv.o2_range_percent, '%')}</td>
                          <td className="num">{formatRange(inv.pressure_range_kpa)}</td>
                          <td className="num">{formatRange(inv.flow_range_cm_s)}</td>
                          <td className="num" title={inv.sensors.join(', ')}>
                            {inv.sensors.length || '—'}
                          </td>
                          <td className="font-mono text-[12px] text-ink-2">{inv.safety_area.length ? inv.safety_area.join(' · ') : '—'}</td>
                          <td className="num" title={inv.data_files.map((f) => f.name).join('\n')}>
                            {inv.data_files.length}
                          </td>
                          <td className="num" title={describeRelevance(rel)}>
                            <RelevanceBar value={rel.value} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-paper-2/50">
                            <td />
                            <td colSpan={11}>
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
          </Wipe>
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

function Th({ k, sort, onSort, children, num = false }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: string; num?: boolean }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={num ? 'text-right' : ''}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-[0.08em] hover:text-ink ${active ? 'text-ink' : ''}`}>
        {children}
        <span className="font-mono text-[10px]">{active ? (sort.dir === 1 ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function RelevanceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="h-px w-14 bg-rule">
        <span className="block h-px bg-ink" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[13px] tabular">{value.toFixed(2)}</span>
    </div>
  );
}

function Details({ inv }: { inv: Investigation }) {
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : '—');
  return (
    <div className="grid gap-6 py-2 text-[14px] md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <div className="label">Objectives (verbatim from PSI)</div>
          <p className="mt-1 leading-relaxed">{inv.objectives ?? '—'}</p>
        </div>
        <div>
          <div className="label">Variables</div>
          <p className="mt-1">{list(inv.variables)}</p>
        </div>
        {inv.within_investigation_differences && (
          <div>
            <div className="label">Differences within the investigation</div>
            <p className="mt-1">{inv.within_investigation_differences}</p>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <div className="label">Sensors · measurements</div>
          <p className="mt-1">{list(inv.sensors)}</p>
          <p className="mt-1 text-ink-2">{list(inv.measurement_types)}</p>
        </div>
        <div>
          <div className="label">Data files ({inv.data_files.length})</div>
          {inv.data_files.length ? (
            <ul className="mt-1 space-y-0.5 font-mono text-[12px]">
              {inv.data_files.map((f) => (
                <li key={f.url + f.name}>
                  <a href={f.url} target="_blank" rel="noreferrer" className="link-draw">
                    {f.name}
                  </a>
                  {f.format && <span className="text-ink-3"> · {f.format}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-ink-3">—</p>
          )}
        </div>
        <div>
          <div className="label">Publications ({inv.publications.length})</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px]">
            {inv.publications.length === 0 && <span className="text-ink-3">—</span>}
            {inv.publications.map((p) => {
              const l = pubLink(p);
              return l.url ? (
                <a key={p} href={l.url} target="_blank" rel="noreferrer" className="link-draw">
                  {l.label}
                </a>
              ) : (
                <span key={p}>{l.label}</span>
              );
            })}
          </div>
        </div>
        <a href={inv.source_url} target="_blank" rel="noreferrer" className="link-draw inline-block font-mono text-[12px]">
          Open the PSI record ↗
        </a>
      </div>
    </div>
  );
}

function ComparePanel({ invs, relById, onClear }: { invs: Investigation[]; relById: Map<string, RelevanceResult>; onClear: () => void }) {
  const { rows, summary } = compareInvestigations(invs, (inv) => relById.get(inv.psi_id)?.value ?? null);
  return (
    <section className="mt-6 border-t-2 border-ink pt-4" aria-label="Compare investigations">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[clamp(1.8rem,3vw,2.6rem)] leading-tight">Compare · {invs.map((i) => i.acronym ?? i.psi_id).join(' vs ')}</h2>
        <button type="button" onClick={onClear} className="btn btn-sm">
          Clear selection
        </button>
      </div>
      <div className="mt-4 border-l border-ink pl-4">
        <div className="label">How these differ · auto-generated from PSI records {invs.map((i) => i.psi_id).join(', ')} (template, not AI)</div>
        <p className="mt-1 text-[16px] leading-relaxed">{summary}</p>
      </div>
      <div className="scroll-thin mt-4 overflow-x-auto">
        <table className="table-ed min-w-[36rem]">
          <thead>
            <tr>
              <th scope="col">Attribute</th>
              {invs.map((i) => (
                <th key={i.psi_id} scope="col">
                  <span className="font-mono text-flight">{i.psi_id}</span> <span className="normal-case tracking-normal text-ink">{i.acronym ?? i.name}</span>
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
    <tr>
      <th scope="row" className={`text-left text-[12px] font-medium uppercase tracking-[0.06em] ${row.differs ? 'text-ink' : 'text-ink-3'}`}>
        {row.label}
        {row.differs && <span className="ml-1 font-mono normal-case text-ink">≠</span>}
      </th>
      {row.values.map((v, idx) => (
        <td key={idx} className={`${row.differs && v !== '—' ? 'border-l-2 border-l-ink font-medium' : v === '—' ? 'text-ink-3' : 'text-ink-2'} ${row.mono ? 'font-mono text-[12.5px]' : ''}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
