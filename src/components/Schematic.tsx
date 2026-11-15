/**
 * Schematic U-shaped flammability boundary: 1.25px ink strokes, vermilion only on the lunar point.
 * No numeric ticks; it illustrates the concept described in the cited sources and is not plotted from data.
 */
export function FlammabilitySchematic() {
  const sans = 'Inter Tight Variable, sans-serif';
  const mono = 'JetBrains Mono Variable, monospace';
  return (
    <figure className="border-t border-ink pt-4">
      <svg
        viewBox="0 0 520 230"
        role="img"
        aria-label="Schematic U-shaped flammability boundary: oxygen needed for a flame against flow speed or effective gravity, with a quenching branch at low flow, a blowoff branch at high flow and a marked point near lunar gravity"
        className="h-auto w-full"
      >
        <defs>
          <marker id="schematic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#141413" />
          </marker>
        </defs>
        <line x1="50" y1="190" x2="508" y2="190" stroke="#141413" strokeWidth="1.25" markerEnd="url(#schematic-arrow)" />
        <line x1="50" y1="190" x2="50" y2="14" stroke="#141413" strokeWidth="1.25" markerEnd="url(#schematic-arrow)" />
        <path d="M190 28 C 205 128, 250 150, 300 150 S 395 128, 410 28" fill="none" stroke="#141413" strokeWidth="1.25" />
        <circle className="dot" cx="268" cy="146" r="4.5" fill="#E34A1E" />
        <text x="276" y="172" fill="#141413" fontSize="11" fontFamily={mono}>
          lunar g (schematic)
        </text>
        <text x="300" y="92" fill="#141413" fontSize="15" fontFamily={sans} textAnchor="middle" fontStyle="italic">
          flammable
        </text>
        <text x="420" y="178" fill="#4A4843" fontSize="12" fontFamily={sans} textAnchor="middle">
          no flame
        </text>
        <text fill="#4A4843" fontSize="11" fontFamily={mono} textAnchor="end">
          <tspan x="182" y="56">quenching</tspan>
          <tspan x="182" y="70">(radiative loss)</tspan>
        </text>
        <text fill="#4A4843" fontSize="11" fontFamily={mono} textAnchor="start">
          <tspan x="418" y="56">blowoff</tspan>
          <tspan x="418" y="70">(too little</tspan>
          <tspan x="418" y="84">residence time)</tspan>
        </text>
        <text x="280" y="214" fill="#4A4843" fontSize="12" fontFamily={sans} textAnchor="middle">
          flow speed / effective gravity →
        </text>
        <text x="28" y="102" fill="#4A4843" fontSize="12" fontFamily={sans} textAnchor="middle" transform="rotate(-90 28 102)">
          O₂ concentration →
        </text>
      </svg>
      <figcaption className="mt-2 font-mono text-[11px] text-ink-2">Schematic, after Ferkul et al. 2026 / Olson 2004 — not plotted from data</figcaption>
    </figure>
  );
}
