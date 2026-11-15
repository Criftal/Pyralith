/** Multi-select chip facet (OR within the facet). */
export function Chips<T extends string | number>({
  label,
  options,
  active,
  onChange,
  render = (v: T) => String(v),
}: {
  label: string;
  options: readonly T[];
  active: Set<T>;
  onChange: (next: Set<T>) => void;
  render?: (v: T) => string;
}) {
  const toggle = (v: T) => {
    const next = new Set(active);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">{label}</span>
      {options.map((o) => {
        const on = active.has(o);
        return (
          <button
            key={String(o)}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o)}
            className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${on ? 'border-cool bg-cool/15 text-cool' : 'border-line-strong text-muted hover:text-text'}`}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}
