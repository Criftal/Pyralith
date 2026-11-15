import type { ReactNode } from 'react';
import type { FileKey } from '../lib/data';
import { MaskLines } from './Motion';

export function Loading({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="py-16 font-mono text-[13px] text-ink-2" role="status">
      {label}…
    </div>
  );
}

/** Honest empty state: says which exported data file is absent instead of showing zeros. */
export function MissingData({ files, what }: { files: FileKey[]; what: string }) {
  return (
    <div className="hatch border-y border-ink px-5 py-6 text-[15px] text-ink">
      <div className="label">No data yet</div>
      <p className="mt-2">
        {what} will appear once the pipeline exports{' '}
        {files.map((f, i) => (
          <span key={f}>
            <code className="font-mono text-[13px]">public/data/{f}.json</code>
            {i < files.length - 1 ? ', ' : ''}
          </span>
        ))}
        .
      </p>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="border-y border-rule py-4 text-[15px] text-ink-2">{children}</div>;
}

/** Numbered section label in mono, e.g. "03 — Gap Map". */
export function SectionLabel({ index, children, tone = 'paper' }: { index?: string; children: ReactNode; tone?: 'paper' | 'night' }) {
  return (
    <div className={`font-mono text-[12px] uppercase tracking-[0.08em] ${tone === 'night' ? 'text-night-2' : 'text-ink-3'}`}>
      {index && <span className={tone === 'night' ? 'text-night-ink' : 'text-ink'}>{index}</span>}
      {index && ' — '}
      {children}
    </div>
  );
}

export function ScreenHeader({ kicker, title, children, index }: { kicker: string; title: ReactNode; children?: ReactNode; index?: string }) {
  return (
    <header className="mb-10 grid grid-cols-12 gap-x-6 border-b border-ink pb-8 pt-4">
      <div className="col-span-12">
        <SectionLabel index={index}>{kicker}</SectionLabel>
      </div>
      <MaskLines as="h1" lines={[title]} className="col-span-12 mt-4 font-display text-[clamp(2.4rem,5.6vw,4.75rem)] font-normal leading-[1.02] tracking-[-0.02em] text-ink lg:col-span-10" />
      {children && <div className="col-span-12 mt-5 max-w-[46rem] text-[17px] leading-relaxed text-ink-2 lg:col-span-8">{children}</div>}
    </header>
  );
}
