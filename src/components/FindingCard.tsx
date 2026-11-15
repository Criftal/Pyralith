import type { Finding } from '../types';
import { useData } from '../lib/data';
import { formatValue, pdfPageUrl, sourceLabel, tidy } from '../lib/format';
import { AiTag, PlatformBadge, PsiBadge, SafetyTags, TierBadge, VerifiedBadge } from './Badges';

export function FindingCard({ f, compact = false, analogue = false }: { f: Finding; compact?: boolean; analogue?: boolean }) {
  const { data } = useData();
  const src = data.sources[f.source_id];
  const pdf = pdfPageUrl(src, f.page);
  const label = `${sourceLabel(f.source_id, data.sources)} · p. ${f.page}`;
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <PlatformBadge platform={f.platform} />
        <TierBadge tier={f.evidence_tier} />
        <PsiBadge psiId={f.psi_id} />
        {analogue && (
          <span className="inline-flex items-center rounded border border-flame/60 px-1.5 py-0.5 font-mono text-[0.7rem] leading-none text-flame">
            analogue of {formatValue(f.analogue_of_g, 'g')}
          </span>
        )}
        <SafetyTags areas={f.safety_area} />
        <span className="ml-auto">{f.verified === true && <VerifiedBadge />}</span>
      </div>
      <p className="mt-3 text-[0.95rem] leading-snug text-text">
        {tidy(f.finding)}
        <AiTag />
      </p>
      <blockquote className="mt-3 border-l-2 border-cool/60 pl-3 text-sm leading-relaxed text-muted">“{tidy(f.quote)}”</blockquote>
      {!compact && <ConditionsRow f={f} />}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted">
        <span className="text-text/80">{f.experiment}</span>
        {f.material && <span>· {f.material}</span>}
        <span className="ml-auto flex flex-wrap gap-3">
          {src?.url ? (
            <a href={src.url} target="_blank" rel="noreferrer" className="text-cool hover:underline">
              {label}
            </a>
          ) : (
            <span>{label}</span>
          )}
          {pdf && (
            <a href={pdf} target="_blank" rel="noreferrer" className="text-cool hover:underline">
              PDF ↗
            </a>
          )}
        </span>
      </div>
    </article>
  );
}

function ConditionsRow({ f }: { f: Finding }) {
  const items = [
    { k: 'gravity', v: formatValue(f.gravity_g, 'g'), r: f.reported?.gravity ?? null },
    { k: 'O₂', v: formatValue(f.o2_percent, '%'), r: f.reported?.o2 ?? null },
    { k: 'pressure', v: formatValue(f.pressure_kpa, 'kPa'), r: f.reported?.pressure ?? null },
    { k: 'flow', v: formatValue(f.flow_cm_s, 'cm/s'), r: f.reported?.flow ?? null },
  ];
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div
          key={i.k}
          title={i.r ? `As reported by the source: ${i.r}` : 'Not stated in the source'}
          className="rounded border border-line px-2 py-1"
        >
          <dt className="text-[0.62rem] uppercase tracking-wider text-faint">{i.k}</dt>
          <dd className={`font-mono text-sm tabular ${i.v === '—' ? 'text-faint' : 'text-text'}`}>{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}
