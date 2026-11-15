import { useData } from '../lib/data';

export default function Footer() {
  const { data } = useData();
  const generated = data.meta?.generated_at ? data.meta.generated_at.slice(0, 10) : null;
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
        <p className="text-text/85">Research exploration prototype, not for flight safety decisions.</p>
        <p className="font-mono">
          Data:{' '}
          <a className="text-cool hover:underline" href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">
            NASA PSI
          </a>{' '}
          &amp;{' '}
          <a className="text-cool hover:underline" href="https://ntrs.nasa.gov/" target="_blank" rel="noreferrer">
            NTRS
          </a>
          {generated && <span className="text-faint"> · corpus built {generated}</span>}
        </p>
      </div>
    </footer>
  );
}
