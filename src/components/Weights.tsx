import { useEffect, useId, useRef, useState } from 'react';
import type { Finding, FindingType, Tier } from '../types';
import { DEFAULT_PARAMS, DIM_LABEL, DIMS, DIM_UNIT, type DecisionResult, type DimValue, type ScoreParams } from '../lib/score';
import { formatRange, formatValue } from '../lib/format';
import { useWeights } from '../lib/weights';

const FINDING_TYPES = Object.keys(DEFAULT_PARAMS.actionability) as FindingType[];
const TIERS: Tier[] = [1, 2, 3, 4];
const n2 = (v: number) => String(Number(v.toFixed(2)));
const n3 = (v: number | null) => (v === null ? '—' : String(Number(v.toFixed(3))));

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <label htmlFor={id} className="truncate text-xs text-muted">
        {label}
      </label>
      <span className="font-mono text-xs text-text tabular">
        {n2(value)}
        {unit ? ` ${unit}` : ''}
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="col-span-2 h-4 w-full accent-[#FF6B1A]" />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-faint">{title}</legend>
      {children}
    </fieldset>
  );
}

const SCALE_RANGE: Record<(typeof DIMS)[number], [number, number, number]> = {
  gravity: [0.05, 2, 0.05],
  o2: [1, 50, 1],
  pressure: [5, 150, 5],
  flow: [1, 50, 1],
};

/** Collapsible editorial-weight sliders shared by Rank, Export and Next fire. */
export function WeightsPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { params, setParams, reset, isDefault } = useWeights();
  const [open, setOpen] = useState(defaultOpen);
  const set = (fn: (p: ScoreParams) => ScoreParams) => setParams(fn);
  return (
    <section className="rounded-lg border border-line bg-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold text-text">Weights</span>
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-flame">editorial weights, not physics</span>
        </span>
        <span className="font-mono text-xs text-muted">
          {isDefault ? 'defaults' : 'modified'} · {open ? 'hide' : 'adjust'}
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-4">
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
            <Group title="Evidence tier weight">
              {TIERS.map((t) => (
                <Slider key={t} label={`Tier ${t}`} value={params.tierWeight[t]} min={0} max={1} step={0.05} onChange={(v) => set((p) => ({ ...p, tierWeight: { ...p.tierWeight, [t]: v } }))} />
              ))}
            </Group>
            <Group title="Actionability by finding type">
              {FINDING_TYPES.map((ft) => (
                <Slider key={ft} label={ft.replace(/_/g, ' ')} value={params.actionability[ft]} min={0} max={1} step={0.05} onChange={(v) => set((p) => ({ ...p, actionability: { ...p.actionability, [ft]: v } }))} />
              ))}
            </Group>
            <Group title="Relevance scales">
              {DIMS.map((d) => {
                const [min, max, step] = SCALE_RANGE[d];
                return (
                  <Slider key={d} label={`${DIM_LABEL[d]} scale`} unit={DIM_UNIT[d] === '%' ? 'pts' : DIM_UNIT[d]} value={params.scales[d]} min={min} max={max} step={step} onChange={(v) => set((p) => ({ ...p, scales: { ...p.scales, [d]: v } }))} />
                );
              })}
              <Slider label="unknown penalty (per unstated dim)" value={params.unknownPenalty} min={0} max={1} step={0.05} onChange={(v) => set((p) => ({ ...p, unknownPenalty: v }))} />
            </Group>
            <Group title="Direction bonus">
              <Slider label="bonus if more flammable than 1 g" value={params.bonus} min={0} max={2} step={0.05} onChange={(v) => set((p) => ({ ...p, bonus: v }))} />
              <p className="text-xs leading-relaxed text-muted">A finding whose source says the material is more flammable than at 1 g is multiplied by (1 + bonus).</p>
              <button
                type="button"
                onClick={reset}
                disabled={isDefault}
                className="rounded-md border border-line-strong px-3 py-1.5 font-mono text-xs text-text transition-colors hover:border-flame hover:text-flame disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset defaults
              </button>
            </Group>
          </div>
        </div>
      )}
    </section>
  );
}

function fmtItem(v: DimValue, unit: 'g' | '%' | 'kPa' | 'cm/s'): string {
  if (Array.isArray(v)) return formatRange(v as [number, number], unit);
  return formatValue(v as number | null, unit);
}

/** Every term of a decision-value score. */
export function DecisionBreakdown({ d, f, params }: { d: DecisionResult; f: Finding; params: ScoreParams }) {
  const r = d.relevance;
  return (
    <div className="space-y-2 font-mono text-[0.72rem] leading-relaxed text-muted">
      <div className="text-text">
        {n3(d.value)} = {n3(r.value)} × {n2(d.tierWeight)} × {n2(d.actionability)} × {n2(d.directionFactor)}
      </div>
      <div className="text-faint">relevance × tier weight × actionability × direction</div>
      <ul className="space-y-1 border-t border-line pt-2">
        {r.terms.map((t) => (
          <li key={t.dim}>
            <span className="text-text">{DIM_LABEL[t.dim]}</span>:{' '}
            {t.status === 'skipped'
              ? t.mission === null
                ? 'mission value not stated → ignored'
                : 'weight 0 → ignored'
              : t.status === 'unknown'
                ? `not stated in this finding → ×${n2(params.unknownPenalty)}`
                : `${fmtItem(t.item, DIM_UNIT[t.dim])} vs ${formatValue(t.mission, DIM_UNIT[t.dim])} → gap ${n3(t.gap)} ÷ scale ${n2(t.scale)} → z² ${n3((t.z ?? 0) * (t.z ?? 0))}`}
          </li>
        ))}
      </ul>
      <div className="border-t border-line pt-2">
        relevance = exp(−½ × {n3(r.sumWeightedZ2)}) × {n2(params.unknownPenalty)}^{r.unknownCount} = {n3(r.expTerm)} × {n3(r.penaltyFactor)} = <span className="text-text">{n3(r.value)}</span>
      </div>
      <div>
        tier weight (T{f.evidence_tier}) = <span className="text-text">{n2(d.tierWeight)}</span>
      </div>
      <div>
        actionability ({f.finding_type.replace(/_/g, ' ')}) = <span className="text-text">{n2(d.actionability)}</span>
      </div>
      <div>
        direction ({f.direction.replace(/_/g, ' ')}) = <span className="text-text">{n2(d.directionFactor)}</span>
      </div>
    </div>
  );
}

/** Score button: hover (desktop) or tap (touch) to see every term. */
export function ScoreChip({ d, f, params, max }: { d: DecisionResult; f: Finding; params: ScoreParams; max: number }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [pinned]);
  const pct = max > 0 ? Math.max(2, (d.value / max) * 100) : 0;
  const open = pinned || hover;
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        aria-expanded={open}
        aria-label={`Decision value ${n3(d.value)}. Show every term.`}
        className="group flex w-full flex-col items-start gap-1 rounded-md border border-line-strong bg-panel-2 px-2.5 py-2 text-left hover:border-flame"
      >
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">score</span>
        <span className="font-mono text-xl leading-none text-flame tabular">{n3(d.value)}</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-flame" style={{ width: `${pct}%` }} />
        </span>
      </button>
      {open && (
        <div role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-[min(23rem,calc(100vw-2.5rem))] rounded-lg border border-line-strong bg-panel p-3 shadow-2xl">
          <DecisionBreakdown d={d} f={f} params={params} />
        </div>
      )}
    </div>
  );
}
