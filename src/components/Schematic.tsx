/**
 * Schematic U-shaped flammability boundary. Deliberately has no numeric ticks: it illustrates the concept
 * described in the cited sources and is not plotted from data.
 */
export function FlammabilitySchematic() {
  const sans = 'IBM Plex Sans, sans-serif';
  const mono = 'IBM Plex Mono, monospace';
  return (
    <figure className="rounded-lg border border-line bg-panel p-4">
      <svg
        viewBox="0 0 520 218"
        role="img"
        aria-label="Schematic U-shaped flammability boundary: the oxygen needed for a flame plotted against flow speed or effective gravity, with a quenching branch at low flow and a blowoff branch at high flow"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="flam-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B1A" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#FF6B1A" stopOpacity="0.05" />
          </linearGradient>
          <marker id="schematic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#8B98A5" />
          </marker>
        </defs>
        {/* flammable region inside the U */}
        <path d="M190 28 C 205 128, 250 150, 300 150 S 395 128, 410 28 Z" fill="url(#flam-fill)" />
        {/* axes */}
        <line x1="50" y1="190" x2="508" y2="190" stroke="#8B98A5" strokeWidth="1.2" markerEnd="url(#schematic-arrow)" />
        <line x1="50" y1="190" x2="50" y2="14" stroke="#8B98A5" strokeWidth="1.2" markerEnd="url(#schematic-arrow)" />
        {/* boundary */}
        <path d="M190 28 C 205 128, 250 150, 300 150 S 395 128, 410 28" fill="none" stroke="#FF6B1A" strokeWidth="2.5" />
        {/* region labels */}
        <text x="300" y="92" fill="#FF9A5E" fontSize="15" fontFamily={sans} textAnchor="middle">
          flammable
        </text>
        <text x="300" y="176" fill="#8B98A5" fontSize="12" fontFamily={sans} textAnchor="middle">
          no flame
        </text>
        {/* branch labels, outside the U */}
        <text fill="#4FC3F7" fontSize="11" fontFamily={mono} textAnchor="end">
          <tspan x="182" y="56">quenching</tspan>
          <tspan x="182" y="70">(radiative loss)</tspan>
        </text>
        <text fill="#4FC3F7" fontSize="11" fontFamily={mono} textAnchor="start">
          <tspan x="418" y="56">blowoff</tspan>
          <tspan x="418" y="70">(too little</tspan>
          <tspan x="418" y="84">residence time)</tspan>
        </text>
        {/* axis labels */}
        <text x="280" y="210" fill="#8B98A5" fontSize="12" fontFamily={sans} textAnchor="middle">
          flow speed / effective gravity →
        </text>
        <text x="30" y="102" fill="#8B98A5" fontSize="12" fontFamily={sans} textAnchor="middle" transform="rotate(-90 30 102)">
          O₂ concentration →
        </text>
      </svg>
      <figcaption className="mt-2 font-mono text-[0.72rem] text-muted">Schematic, after Ferkul et al. 2026 / Olson 2004 — not plotted from data</figcaption>
    </figure>
  );
}
