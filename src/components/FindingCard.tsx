import type { Finding } from '../types';
import { useData } from '../lib/data';
import { formatValue, pdfPageUrl, sourceLabel, tidy } from '../lib/format';
import { AiTag, platformLabel, PsiBadge, TIER_HELP, VerifiedBadge } from './Badges';
import { sub2 } from './Typo';

/**
 * Evidence row: a ruled list item. Left meta column (mono): source + page link, tier, platform, PSI mark, Verified.
 * Main column: the AI summary, the verbatim quote (Newsreader italic, 1px rule) and the stated conditions.
 */
export function FindingCard({ f, compact = false, analogue = false }: { f: Finding; compact?: boolean; analogue?: boolean }) {
  const { data } = useData();
  const src = data.sources[f.source_id];
  const pdf = pdfPageUrl(src, f.page);
  const srcLabel = sourceLabel(f.source_id, data.sources);
  return (
    <article className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule py-5 md:grid-cols-[10.5rem_minmax(0,1fr)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] leading-relaxed text-ink-2 md:block md:space-y-1">
        <div>
          {src?.url ? (
            <a href={src.url} target="_blank" rel="noreferrer" className="link-draw text-ink">
              {srcLabel}
            </a>
          ) : (
            <span className="text-ink">{srcLabel}</span>
          )}{' '}
          ·{' '}
          {pdf ? (
            <a href={pdf} target="_blank" rel="noreferrer" className="link-draw">
              p.&nbsp;{f.page}&nbsp;↗
            </a>
          ) : (
            <>p.&nbsp;{f.page}</>
          )}
        </div>
        <div title={`Evidence tier ${f.evidence_tier}. Tiers: ${TIER_HELP}`}>
          Tier {f.evidence_tier} · {platformLabel(f.platform)}
        </div>
        <div>
          <PsiBadge psiId={f.psi_id} />
        </div>
        {analogue && <div className="text-ink">analogue of {formatValue(f.analogue_of_g, 'g')}</div>}
        <div>{f.verified === true && <VerifiedBadge />}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[17px] leading-snug text-ink">
          {tidy(f.finding)}
          <AiTag />
        </p>
        <blockquote className="mt-3 border-l border-ink pl-4 font-display text-[17px] italic leading-snug text-ink-2">“{sub2(tidy(f.quote))}”</blockquote>
        {!compact && <Conditions f={f} />}
        <div className="mt-2 font-mono text-[11px] text-ink-3">
          {[f.experiment, f.material, f.safety_area?.length ? f.safety_area.join(' · ') : null].filter(Boolean).join('  ·  ')}
        </div>
      </div>
    </article>
  );
}

function Conditions({ f }: { f: Finding }) {
  const items = [
    { k: 'g', v: formatValue(f.gravity_g, 'g'), r: f.reported?.gravity ?? null },
    { k: 'O₂', v: formatValue(f.o2_percent, '%'), r: f.reported?.o2 ?? null },
    { k: 'kPa', v: formatValue(f.pressure_kpa, 'kPa'), r: f.reported?.pressure ?? null },
    { k: 'cm/s', v: formatValue(f.flow_cm_s, 'cm/s'), r: f.reported?.flow ?? null },
  ];
  return (
    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] tabular">
      {items.map((i) => (
        <div key={i.k} title={i.r ? `As reported by the source: ${i.r}` : 'Not stated in the source'} className="flex items-baseline gap-2">
          <dt className="text-ink-3">{i.k}</dt>
          <dd className={i.v === '—' ? 'text-ink-3' : 'text-ink'}>{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}
