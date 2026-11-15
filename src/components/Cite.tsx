import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Claim, CitedValue } from '../types';
import { useData } from '../lib/data';
import { authorsShort, pdfPageUrl, sourceLabel, tidy } from '../lib/format';
import { VerifiedBadge } from './Badges';
import { sub2 } from './Typo';

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
      {target && <CiteDrawer target={target} onClose={close} />}
    </CiteContext.Provider>
  );
}

/** Right-side drawer: square, hairline border, no shadow. */
function CiteDrawer({ target, onClose }: { target: CiteTarget; onClose: () => void }) {
  const { data } = useData();
  const src = data.sources[target.source_id];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  const pdf = pdfPageUrl(src, target.page);
  const byline = src ? [authorsShort(src.authors), src.year, src.doc_type].filter(Boolean).join(' · ') : '';
  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Source citation"
        className="absolute inset-y-0 right-0 flex w-full max-w-[30rem] flex-col overflow-y-auto border-l border-ink bg-paper text-ink"
      >
        <div className="flex items-center justify-between border-b border-ink px-6 py-4">
          <span className="label">Source</span>
          <button ref={closeRef} onClick={onClose} className="font-mono text-[12px] text-ink-2 hover:text-ink" aria-label="Close citation">
            Close · Esc
          </button>
        </div>
        <div className="space-y-5 px-6 py-6">
          {target.title && <h2 className="font-display text-[28px] leading-[1.05]">{sub2(target.title)}</h2>}
          {target.text && <p className="text-[15px] leading-relaxed text-ink">{tidy(target.text)}</p>}
          <blockquote className="border-l border-ink pl-4 font-display text-[19px] italic leading-snug text-ink">“{sub2(tidy(target.quote))}”</blockquote>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <VerifiedBadge />
            <span className="font-mono text-[12px] text-ink-2">
              {sourceLabel(target.source_id, data.sources)} · p. {target.page}
            </span>
          </div>
          {target.note && <p className="border-t border-rule pt-3 text-[13px] text-ink-2">{target.note}</p>}
          <div className="border-t border-ink pt-4">
            <div className="text-[15px] leading-snug">{src?.title ?? target.source_id}</div>
            {byline && <div className="mt-1 font-mono text-[12px] text-ink-2">{byline}</div>}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[12px]">
              {src?.url && (
                <a className="link-draw text-ink" href={src.url} target="_blank" rel="noreferrer">
                  Open source ↗
                </a>
              )}
              {pdf && (
                <a className="link-draw text-ink" href={pdf} target="_blank" rel="noreferrer">
                  PDF p. {target.page} ↗
                </a>
              )}
              {target.link && (
                <a className="link-draw text-ink" href={target.link} target="_blank" rel="noreferrer">
                  Related page ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Compact mono citation marker; opens the source drawer. */
export function Cite({ target, children, className = '', tone = 'paper' }: { target: CiteTarget; children?: ReactNode; className?: string; tone?: 'paper' | 'night' }) {
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
      className={`inline align-baseline font-mono text-[11px] leading-none underline decoration-1 underline-offset-2 ${
        tone === 'night' ? 'text-night-2 decoration-night-2/50 hover:text-night-ink' : 'text-ink-2 decoration-rule-mid hover:text-ink hover:decoration-ink'
      } ${className}`}
    >
      {children ?? (
        <>
          [{sourceLabel(target.source_id, data.sources)} p.{target.page}]
        </>
      )}
    </button>
  );
}

/** A claim as a sentence followed by its citation marker. */
export function ClaimLine({ claim, className = '', tone = 'paper' }: { claim: Claim; className?: string; tone?: 'paper' | 'night' }) {
  return (
    <span className={className}>
      {tidy(claim.text)} <Cite target={claimTarget(claim)} tone={tone} />
    </span>
  );
}
