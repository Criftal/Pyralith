import type { ReactNode } from 'react';
import type { FileKey } from '../lib/data';

export function Loading({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 font-mono text-sm text-muted" role="status">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cool" />
      {label}…
    </div>
  );
}

/** Honest empty state: says which exported data file is absent instead of showing zeros. */
export function MissingData({ files, what }: { files: FileKey[]; what: string }) {
  return (
    <div className="hatch rounded-lg border border-dashed border-line-strong p-6 text-sm text-muted">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-faint">No data yet</div>
      <p className="mt-2">
        {what} will appear once the pipeline exports{' '}
        {files.map((f, i) => (
          <span key={f}>
            <code className="font-mono text-text/80">public/data/{f}.json</code>
            {i < files.length - 1 ? ', ' : ''}
          </span>
        ))}
        .
      </p>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">{children}</div>;
}

export function ScreenHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="font-mono text-xs uppercase tracking-[0.25em] text-flame">{kicker}</div>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-text sm:text-3xl lg:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{children}</div>}
    </header>
  );
}
