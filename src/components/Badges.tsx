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

/* Editorial labels: plain mono text, no boxes or pills. */

export function PlatformBadge({ platform }: { platform: Platform }) {
  return <span className="font-mono text-[12px] text-ink-2">{platformLabel(platform)}</span>;
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span title={`Evidence tier ${tier}. Tiers: ${TIER_HELP}`} className="font-mono text-[12px] text-ink-2">
      Tier {tier}
    </span>
  );
}

export function SafetyTags({ areas }: { areas: SafetyArea[] | null | undefined }) {
  if (!areas || areas.length === 0) return null;
  return <span className="font-mono text-[12px] text-ink-2">{areas.join(' · ')}</span>;
}

export function VerifiedBadge() {
  return (
    <span
      title="Machine-checked: the quote appears verbatim (after whitespace/ligature normalisation) on the cited page of the source."
      className="smallcaps inline-flex items-center gap-1 text-ink"
    >
      <span aria-hidden="true">✓</span> Verified
    </span>
  );
}

export function AiTag() {
  return (
    <span title="Plain-English summary written by an AI model (Claude) during extraction. The verbatim quote is the evidence." className="smallcaps ml-2 align-middle text-ink-3">
      AI summary
    </span>
  );
}

/** PSI-backed (cobalt square) or non-PSI (outlined square). */
export function PsiBadge({ psiId }: { psiId: string | null }) {
  if (psiId)
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-flight">
        <span aria-hidden="true" className="inline-block h-2 w-2 bg-flight" />
        {psiId}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-2">
      <span aria-hidden="true" className="inline-block h-2 w-2 border border-ink-2" />
      non-PSI
    </span>
  );
}
