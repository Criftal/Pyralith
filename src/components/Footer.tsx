import { useData } from '../lib/data';

export const SI_DISCLOSURE = 'Built with SI assistance: code and evidence extraction by Claude Code; every quote machine-verified';

export default function Footer() {
  const { data } = useData();
  const generated = data.meta?.generated_at ? data.meta.generated_at.slice(0, 10) : null;
  return (
    <footer className="mt-24 border-t border-ink">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-x-6 gap-y-3 px-4 py-8 sm:px-6">
        <p className="col-span-12 text-[15px] text-ink md:col-span-6">Research exploration prototype, not for flight safety decisions.</p>
        <p className="col-span-12 text-[13px] leading-relaxed text-ink-2 md:col-span-6">{SI_DISCLOSURE}</p>
        <p className="col-span-12 border-t border-rule pt-3 font-mono text-[12px] text-ink-3">
          Data:{' '}
          <a className="link-draw text-ink-2" href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">
            NASA PSI
          </a>{' '}
          &amp;{' '}
          <a className="link-draw text-ink-2" href="https://ntrs.nasa.gov/" target="_blank" rel="noreferrer">
            NTRS
          </a>
          {generated && <> · corpus built {generated}</>}
        </p>
      </div>
    </footer>
  );
}
