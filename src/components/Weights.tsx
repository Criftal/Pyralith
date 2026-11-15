import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
      <label htmlFor={id} className="truncate text-[13px] text-ink-2">
        {label}
      </label>
      <span className="font-mono text-[12px] text-ink tabular">
        {n2(value)}
        {unit ? ` ${unit}` : ''}
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="col-span-2 w-full" />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2.5 border-t border-rule pt-3">
      <legend className="label float-left mb-2 w-full">{title}</legend>
      <div className="clear-both space-y-2.5">{children}</div>
    </fieldset>
  );
}

const SCALE_RANGE: Record<(typeof DIMS)[number], [number, number, number]> = {
  gravity: [0.05, 2, 0.05],
  o2: [1, 50, 1],
  pressure: [5, 150, 5],
  flow: [1, 50, 1],
};

/**
 * Editorial-weight sliders shared by Rank, Export and Next fire.
 * variant "sidebar": always open, slim column. variant "collapsible": a ruled disclosure.
 */
export function WeightsPanel({ defaultOpen = false, variant = 'collapsible' }: { defaultOpen?: boolean; variant?: 'collapsible' | 'sidebar' }) {
  const { params, setParams, reset, isDefault } = useWeights();
  const [open, setOpen] = useState(defaultOpen || variant === 'sidebar');
  const set = (fn: (p: ScoreParams) => ScoreParams) => setParams(fn);
  const sidebar = variant === 'sidebar';
  const body = (
    <div className={sidebar ? 'space-y-5' : 'grid gap-x-10 gap-y-5 border-t border-rule pt-4 md:grid-cols-2 xl:grid-cols-4'}>
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
        <p className="text-[13px] leading-relaxed text-ink-2">A finding whose source says it is more flammable than at 1 g is multiplied by (1 + bonus).</p>
        <button type="button" onClick={reset} disabled={isDefault} className="btn btn-sm">
          Reset defaults
        </button>
      </Group>
    </div>
  );
  if (sidebar) {
    return (
      <section aria-label="Weights">
        <div className="flex items-baseline justify-between border-b border-ink pb-2">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em]">Weights</span>
          <span className="font-mono text-[11px] text-ink-3">{isDefault ? 'defaults' : 'modified'}</span>
        </div>
        <p className="label mt-2 mb-3 text-ink">editorial weights, not physics</p>
        {body}
      </section>
    );
  }
  return (
    <section className="border-y border-ink">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-baseline justify-between gap-2 py-3 text-left">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">Weights</span>
          <span className="label">editorial weights, not physics</span>
        </span>
        <span className="font-mono text-[11px] text-ink-3">
          {isDefault ? 'defaults' : 'modified'} · {open ? 'hide' : 'adjust'}
        </span>
      </button>
      {open && <div className="pb-5">{body}</div>}
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
    <div className="space-y-2 font-mono text-[11.5px] leading-relaxed text-ink-2">
      <div className="text-[13px] text-ink">
        {n3(d.value)} = {n3(r.value)} × {n2(d.tierWeight)} × {n2(d.actionability)} × {n2(d.directionFactor)}
      </div>
      <div className="text-ink-3">relevance × tier weight × actionability × direction</div>
      <ul className="space-y-1 border-t border-rule pt-2">
        {r.terms.map((t) => (
          <li key={t.dim}>
            <span className="text-ink">{DIM_LABEL[t.dim]}</span>:{' '}
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
      <div className="border-t border-rule pt-2">
        relevance = exp(−½ × {n3(r.sumWeightedZ2)}) × {n2(params.unknownPenalty)}^{r.unknownCount} = {n3(r.expTerm)} × {n3(r.penaltyFactor)} ={' '}
        <span className="text-ink">{n3(r.value)}</span>
      </div>
      <div>
        tier weight (T{f.evidence_tier}) = <span className="text-ink">{n2(d.tierWeight)}</span> · actionability ({f.finding_type.replace(/_/g, ' ')}) ={' '}
        <span className="text-ink">{n2(d.actionability)}</span> · direction ({f.direction.replace(/_/g, ' ')}) = <span className="text-ink">{n2(d.directionFactor)}</span>
      </div>
    </div>
  );
}

/** Mono score with a hairline bar; hover (desktop) or tap (touch) opens a rectangular breakdown. */
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
      <button type="button" onClick={() => setPinned((p) => !p)} aria-expanded={open} aria-label={`Decision value ${n3(d.value)}. Show every term.`} className="flex w-full flex-col items-start gap-1.5 py-1 text-left">
        <span className="font-mono text-[22px] leading-none text-ink tabular">{n3(d.value)}</span>
        <span className="h-px w-full bg-rule">
          <span className="block h-px bg-ink" style={{ width: `${pct}%` }} />
        </span>
        <span className="label">score · terms</span>
      </button>
      {open && (
        <div role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-[min(25rem,calc(100vw-2.5rem))] border border-ink bg-paper p-4">
          <DecisionBreakdown d={d} f={f} params={params} />
        </div>
      )}
    </div>
  );
}
