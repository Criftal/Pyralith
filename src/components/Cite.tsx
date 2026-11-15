import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Claim, CitedValue } from '../types';
import { useData } from '../lib/data';
import { authorsShort, pdfPageUrl, sourceLabel, tidy } from '../lib/format';
import { VerifiedBadge } from './Badges';

export interface CiteTarget {
  title: string | null;
  text: string | null;
  quote: string;
  page: number;
  source_id: string;
  link: string | null;
  note: string | null;
}

export function claimTarget(c: Claim): CiteTarget {
  return { title: c.label, text: c.text, quote: c.quote, page: c.page, source_id: c.source_id, link: c.link, note: null };
}

export function citedValueTarget(v: CitedValue, title: string): CiteTarget {
  return { title, text: v.display, quote: v.quote, page: v.page, source_id: v.source_id, link: null, note: v.note };
}

const CiteContext = createContext<(t: CiteTarget) => void>(() => {});
export const useCite = () => useContext(CiteContext);

export function CiteProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<CiteTarget | null>(null);
  const open = useCallback((t: CiteTarget) => setTarget(t), []);
  const close = useCallback(() => setTarget(null), []);
  return (
    <CiteContext.Provider value={open}>
      {children}
      {target && <CiteDialog target={target} onClose={close} />}
    </CiteContext.Provider>
  );
}

function CiteDialog({ target, onClose }: { target: CiteTarget; onClose: () => void }) {
  const { data } = useData();
  const src = data.sources[target.source_id];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const pdf = pdfPageUrl(src, target.page);
  const byline = src ? [authorsShort(src.authors), src.year, src.doc_type].filter(Boolean).join(' · ') : '';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Source citation"
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-xl border border-line-strong bg-panel p-5 shadow-2xl sm:max-w-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted">Citation</div>
            {target.title && <div className="mt-1 font-semibold text-text">{target.title}</div>}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded border border-line-strong px-2 py-1 font-mono text-xs text-muted hover:border-text hover:text-text"
            aria-label="Close citation"
          >
            Esc
          </button>
        </div>
        {target.text && <p className="mt-3 text-sm text-text/90">{tidy(target.text)}</p>}
        <blockquote className="mt-4 border-l-2 border-cool pl-4 text-[0.95rem] leading-relaxed text-text">
          “{tidy(target.quote)}”
        </blockquote>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <VerifiedBadge />
          <span className="font-mono text-muted">
            {sourceLabel(target.source_id, data.sources)} · p. {target.page}
          </span>
        </div>
        {target.note && <p className="mt-3 text-xs text-flame-soft">{target.note}</p>}
        <div className="mt-4 rounded-md border border-line bg-panel-2 p-3 text-sm">
          <div className="text-text">{src?.title ?? target.source_id}</div>
          {byline && <div className="mt-1 text-xs text-muted">{byline}</div>}
          <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
            {src?.url && (
              <a className="text-cool hover:underline" href={src.url} target="_blank" rel="noreferrer">
                Open source ↗
              </a>
            )}
            {pdf && (
              <a className="text-cool hover:underline" href={pdf} target="_blank" rel="noreferrer">
                PDF p. {target.page} ↗
              </a>
            )}
            {target.link && (
              <a className="text-cool hover:underline" href={target.link} target="_blank" rel="noreferrer">
                Related page ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small chip that opens the verified quote, page and source for a claim or cited value. */
export function Cite({ target, children, className = '' }: { target: CiteTarget; children?: ReactNode; className?: string }) {
  const open = useCite();
  const { data } = useData();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(target);
      }}
      title="Show the verified source quote"
      className={`inline-flex items-center gap-1 rounded border border-line-strong px-1.5 py-0.5 align-middle font-mono text-[0.72rem] leading-none text-cool transition-colors hover:border-cool hover:bg-cool/10 ${className}`}
    >
      {children ?? (
        <>
          {sourceLabel(target.source_id, data.sources)} · p.{target.page}
        </>
      )}
    </button>
  );
}

/** Render a claim as a sentence followed by its citation chip. */
export function ClaimLine({ claim, className = '' }: { claim: Claim; className?: string }) {
  return (
    <span className={className}>
      {tidy(claim.text)} <Cite target={claimTarget(claim)} />
    </span>
  );
}
