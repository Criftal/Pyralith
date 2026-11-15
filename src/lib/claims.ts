import type { Claim, ClaimTopic } from '../types';

/**
 * Claim selection. Preferred ids pick the clearest statement for each slot; when an id is absent (the corpus is
 * re-exported as extraction batches land) the slot falls back to other claims of the same topic, so the UI never
 * depends on a single record existing.
 */
export const FEATURED = {
  hookTest1: ['c_test1_1g', 'c_burn_0g_not_1g'],
  atmosphereStat: ['c_moon_atm_band', 'c_gap_above_30'],
  gapHeadline: ['c_psi_no_partial_g'],
  boundPremise: ['c_brief_bound'],
  warnLunar: ['c_lunar_nearly_most', 'c_partial_g_worse'],
  warnU: ['c_u_min_lunar', 'c_u_moon_mechanism'],
  warnTest1: ['c_test1_not_worst'],
  future: ['c_luci_fm2_future', 'c_fm2', 'c_fm2_launch'],
} as const;

export const FUTURE_LABELS = ['LUCI & FM2', 'FM2', 'FM2 launch'];

export interface PickOptions {
  ids?: readonly string[];
  topics?: readonly ClaimTopic[];
  /** Only pool claims whose label or text matches (preferred ids are always allowed). With neither topics nor match, only `ids` are returned. */
  match?: RegExp;
  n: number;
  /** Rotate the first few candidates, for variety across a list of items. */
  offset?: number;
  exclude?: ReadonlySet<string>;
}

export function pickClaims(claims: Claim[], opts: PickOptions): Claim[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const seen = new Set<string>(opts.exclude ?? []);
  const preferred: Claim[] = [];
  for (const id of opts.ids ?? []) {
    const c = byId.get(id);
    if (c && !seen.has(c.id)) {
      preferred.push(c);
      seen.add(c.id);
    }
  }
  // Without a topic or match filter there is no fallback pool: only the listed ids are returned.
  const usePool = Boolean(opts.topics || opts.match);
  const pool = usePool
    ? claims.filter(
        (c) =>
          !seen.has(c.id) &&
          (!opts.topics || opts.topics.includes(c.topic)) &&
          (!opts.match || opts.match.test(`${c.label ?? ''} ${c.text}`)),
      )
    : [];
  let ordered = [...preferred, ...pool];
  const k = opts.offset ?? 0;
  if (k > 0 && ordered.length > 1) {
    const head = ordered.slice(0, Math.min(4, ordered.length));
    const r = k % head.length;
    ordered = [...head.slice(r), ...head.slice(0, r), ...ordered.slice(head.length)];
  }
  return ordered.slice(0, opts.n);
}

export function claimById(claims: Claim[], id: string): Claim | undefined {
  return claims.find((c) => c.id === id);
}

/** Future-data claims for the warning card: preferred ids, then the labels the coordinator flagged, then any. */
export function futureClaims(claims: Claim[], n = 3): Claim[] {
  const preferred = pickClaims(claims, { ids: FEATURED.future, n });
  if (preferred.length >= n) return preferred;
  const exclude = new Set(preferred.map((c) => c.id));
  const byLabel = FUTURE_LABELS.map((l) => claims.find((c) => c.topic === 'future_experiment' && c.label === l && !exclude.has(c.id))).filter(
    (c): c is Claim => Boolean(c),
  );
  const rest = claims.filter((c) => c.topic === 'future_experiment' && !exclude.has(c.id) && !byLabel.includes(c));
  return [...preferred, ...byLabel, ...rest].slice(0, n);
}
