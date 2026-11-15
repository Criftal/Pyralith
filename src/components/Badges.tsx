import type { Platform, SafetyArea, Tier } from '../types';

const PLATFORM_LABEL: Record<Platform, string> = {
  ISS: 'ISS',
  Cygnus: 'Cygnus',
  Shuttle: 'Shuttle',
  sounding_rocket: 'Sounding rocket',
  parabolic: 'Parabolic flight',
  drop_tower: 'Drop tower',
  '1g_lab': '1-g lab',
  model: 'Model',
  review: 'Review',
};

export const platformLabel = (p: Platform): string => PLATFORM_LABEL[p] ?? String(p);

export const TIER_HELP = '1 long-duration flight · 2 short-duration flight · 3 1-g lab · 4 model/review';

const chip = 'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.7rem] leading-none whitespace-nowrap';

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className={`${chip} border-line-strong text-text/85`}>{platformLabel(platform)}</span>;
}

export function TierBadge({ tier }: { tier: Tier }) {
  const strong = tier === 1;
  return (
    <span
      title={`Evidence tier ${tier}. Tiers: ${TIER_HELP}`}
      className={`${chip} font-mono ${strong ? 'border-cool/60 text-cool' : 'border-line-strong text-muted'}`}
    >
      T{tier}
    </span>
  );
}

const SAFETY_STYLE: Record<SafetyArea, string> = {
  prevention: 'border-cool/40 text-cool',
  detection: 'border-[#c7b37a]/50 text-[#d9c58c]',
  suppression: 'border-flame/50 text-flame-soft',
};

export function SafetyTags({ areas }: { areas: SafetyArea[] | null | undefined }) {
  if (!areas || areas.length === 0) return null;
  return (
    <>
      {areas.map((a) => (
        <span key={a} className={`${chip} ${SAFETY_STYLE[a] ?? 'border-line-strong text-muted'}`}>
          {a}
        </span>
      ))}
    </>
  );
}

export function VerifiedBadge() {
  return (
    <span
      title="This quote was machine-checked: it appears verbatim (after whitespace/ligature normalisation) on the cited page of the source."
      className={`${chip} border-cool/50 bg-cool/10 font-mono text-cool`}
    >
      ✓ quote-verified
    </span>
  );
}

export function AiTag() {
  return (
    <span
      title="Plain-English summary written by an AI model (Claude) during extraction. The verbatim quote is the evidence."
      className={`${chip} ml-1 align-middle border-line-strong font-mono text-[0.62rem] uppercase tracking-wider text-faint`}
    >
      AI summary
    </span>
  );
}

export function PsiBadge({ psiId }: { psiId: string | null }) {
  if (psiId) return <span className={`${chip} border-cool/40 font-mono text-cool`}>{psiId}</span>;
  return <span className={`${chip} border-flame/40 text-flame-soft`}>non-PSI</span>;
}
