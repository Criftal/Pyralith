import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Claim, Finding } from '../types';
import { useData } from '../lib/data';
import { pdfPageUrl, sourceLabel, tidy } from '../lib/format';
import { postAsk, stripCitations, useLiveStatus, type AskResponse, type LiveStatus } from '../lib/live';
import { counterEvidence } from '../lib/redteam';
import { indexFor } from '../lib/search';
import { AiTag, VerifiedBadge } from './Badges';
import { FindingCard } from './FindingCard';
import { sub2 } from './Typo';

/** Claim as an evidence row (same anatomy as a finding). */
export function ClaimCard({ c, compact = false }: { c: Claim; compact?: boolean }) {
  const { data } = useData();
  const src = data.sources[c.source_id];
  const pdf = pdfPageUrl(src, c.page);
  return (
    <article className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule py-5 md:grid-cols-[10.5rem_minmax(0,1fr)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] leading-relaxed text-ink-2 md:block md:space-y-1">
        <div>
          {src?.url ? (
            <a href={src.url} target="_blank" rel="noreferrer" className="link-draw text-ink">
              {sourceLabel(c.source_id, data.sources)}
            </a>
          ) : (
            <span className="text-ink">{sourceLabel(c.source_id, data.sources)}</span>
          )}{' '}
          ·{' '}
          {pdf ? (
            <a href={pdf} target="_blank" rel="noreferrer" className="link-draw">
              p.&nbsp;{c.page}&nbsp;↗
            </a>
          ) : (
            <>p.&nbsp;{c.page}</>
          )}
        </div>
        <div>claim · {c.topic.replace(/_/g, ' ')}</div>
        <div>
          <VerifiedBadge />
        </div>
      </div>
      <div className="min-w-0">
        {c.label && <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">{c.label}</div>}
        <p className="mt-1 text-[17px] leading-snug text-ink">
          {tidy(c.text)}
          <AiTag />
        </p>
        {!compact && <blockquote className="mt-3 border-l border-ink pl-4 font-display text-[17px] italic leading-snug text-ink-2">“{sub2(tidy(c.quote))}”</blockquote>}
        {c.link && (
          <a href={c.link} target="_blank" rel="noreferrer" className="link-draw mt-2 inline-block font-mono text-[12px] text-ink-2">
            NASA page ↗
          </a>
        )}
      </div>
    </article>
  );
}

/** Scroll to and briefly highlight a record row inside a scope. */
export function useHighlight(scope: string) {
  const [hl, setHl] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const go = useCallback(
    (id: string) => {
      document.getElementById(`${scope}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHl(id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setHl(null), 2600);
    },
    [scope],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { hl, go };
}

/** A finding or claim row with its record id, used as a citation target. */
export function RecordCard({
  id,
  scope,
  highlighted,
  rank,
  reason,
  compact = false,
  action,
}: {
  id: string;
  scope: string;
  highlighted: boolean;
  rank?: number;
  reason?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  const { data } = useData();
  const finding = useMemo(() => data.findings.find((f) => f.id === id), [data.findings, id]);
  const claim = useMemo(() => (finding ? undefined : data.claims.find((c) => c.id === id)), [data.claims, finding, id]);
  if (!finding && !claim) return null;
  return (
    <div id={`${scope}-${id}`} className={`scroll-mt-24 transition-colors duration-300 ${highlighted ? 'bg-paper-2 outline-2 outline-offset-0 outline-ink' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-3 font-mono text-[11px] text-ink-3">
        {rank !== undefined && <span className="text-ink">{String(rank).padStart(2, '0')}</span>}
        <span>{id}</span>
        {reason && <span className="text-ink-2">{reason}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {finding ? <FindingCard f={finding} compact={compact} /> : claim ? <ClaimCard c={claim} compact={compact} /> : null}
    </div>
  );
}

export interface AiState {
  status: 'idle' | 'loading' | 'done' | 'error';
  res?: AskResponse;
  error?: string;
}

/** The AI answer as a quoted block with numbered citations; each number scrolls to its record. */
export function AiAnswer({ res, onCite }: { res: AskResponse; onCite: (id: string) => void }) {
  const removed = res.stripped > 0 ? ` · ${res.stripped} uncited sentence${res.stripped === 1 ? '' : 's'} removed` : '';
  const order: string[] = [];
  for (const s of res.sentences) for (const id of s.citations) if (!order.includes(id)) order.push(id);
  const num = (id: string) => order.indexOf(id) + 1;
  return (
    <figure className="border-l-2 border-ink pl-5" aria-live="polite">
      <figcaption className="label">AI-generated by {res.model}; every sentence cites a quote-verified record{removed}</figcaption>
      {res.refusal || res.sentences.length === 0 ? (
        <blockquote className="mt-3 font-display text-[22px] leading-snug text-ink-2">{sub2(res.answer)}</blockquote>
      ) : (
        <>
          <blockquote className="mt-3 font-display text-[clamp(1.25rem,2.2vw,1.6rem)] leading-snug text-ink">
            {res.sentences.map((s, i) => (
              <span key={i} className="mr-1.5">
                {sub2(stripCitations(s.text))}
                {s.citations.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCite(id)}
                    title={`Scroll to ${id}`}
                    className="ml-0.5 align-super font-mono text-[0.55em] text-ink underline decoration-rule-mid underline-offset-2 hover:decoration-ink"
                  >
                    [{num(id)}]
                  </button>
                ))}{' '}
              </span>
            ))}
          </blockquote>
          <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-ink-2">
            {order.map((id, i) => (
              <li key={id}>
                <button type="button" onClick={() => onCite(id)} className="link-draw">
                  [{i + 1}] {id}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </figure>
  );
}

export function LiveControls({
  live,
  label,
  state,
  disabled = false,
  onRun,
  offNote,
}: {
  live: LiveStatus | null;
  label: string;
  state: AiState;
  disabled?: boolean;
  onRun: () => void;
  offNote: string;
}) {
  if (live === null) return <p className="font-mono text-[12px] text-ink-3">Checking for live AI mode…</p>;
  if (!live.live) return <p className="text-[14px] text-ink-2">{offNote}</p>;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={onRun} disabled={disabled || state.status === 'loading'} className="btn btn-primary">
        {state.status === 'loading' ? 'Asking Claude…' : label}
      </button>
      {state.status === 'error' && <p className="text-[14px] text-ink">{state.error} Showing retrieved evidence only.</p>}
    </div>
  );
}

/** Red team for one finding: deterministic counter-evidence, optionally argued by the live model. */
export function RedTeamPanel({ target, scope, onClose }: { target: Finding; scope: string; onClose: () => void }) {
  const { data } = useData();
  const index = useMemo(() => indexFor(data.findings, data.claims, data.sources), [data.findings, data.claims, data.sources]);
  const items = useMemo(() => counterEvidence(target, data.findings, data.claims, index, 10), [target, data.findings, data.claims, index]);
  const live = useLiveStatus();
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const { hl, go } = useHighlight(scope);
  useEffect(() => setAi({ status: 'idle' }), [target.id]);

  const run = async () => {
    setAi({ status: 'loading' });
    try {
      const res = await postAsk({ mode: 'redteam', target: target.id, ids: items.map((i) => i.id) });
      setAi({ status: 'done', res });
    } catch (e) {
      setAi({ status: 'error', error: e instanceof Error ? e.message : 'Live request failed.' });
    }
  };

  return (
    <section aria-label={`Red team for ${target.id}`} className="border-t-2 border-ink bg-paper-2/60 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink">Red team · {target.id}</div>
          <p className="mt-2 font-display text-[19px] italic leading-snug text-ink">Arguing against: “{sub2(tidy(target.finding))}”</p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-sm">
          Close
        </button>
      </div>
      <div className="mt-4">
        <LiveControls
          live={live}
          label="Ask Claude to argue against it (cites only these records)"
          state={ai}
          disabled={items.length === 0}
          onRun={run}
          offNote="Live AI mode is not configured on this deployment. Showing retrieved counter-evidence only."
        />
      </div>
      {ai.status === 'done' && ai.res && (
        <div className="mt-5">
          <AiAnswer res={ai.res} onCite={go} />
        </div>
      )}
      <h4 className="label mt-6">Counter-evidence retrieved (no AI)</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">No counter-evidence found in our corpus.</p>
      ) : (
        <ol className="mt-1">
          {items.map((it, i) => (
            <li key={it.id}>
              <RecordCard id={it.id} scope={scope} highlighted={hl === it.id} rank={i + 1} reason={it.reason} compact />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
