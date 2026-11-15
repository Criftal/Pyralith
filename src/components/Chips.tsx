/** Multi-select facet as text toggles (underline when active; OR within the facet). */
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
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" role="group" aria-label={label}>
      <span className="label mr-1">{label}</span>
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={active.has(o)} onClick={() => toggle(o)} className="toggle">
          {render(o)}
        </button>
      ))}
    </div>
  );
}
