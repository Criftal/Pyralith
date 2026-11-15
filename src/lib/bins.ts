/**
 * Gap Map bins. Lower bound inclusive, upper bound exclusive, except where `maxIncl` says otherwise
 * (the quiescent flow band "≤1 cm/s" and the open-ended last bands).
 */
export interface Band {
  key: string;
  label: string;
  sub?: string;
  min: number;
  max: number;
  minIncl: boolean;
  maxIncl: boolean;
  /** Representative value used when a whole cell is scored (bin midpoint; fixed anchor for open-ended bins). */
  centre: number;
}

export const UNSTATED = 'unstated';

const band = (
  key: string,
  label: string,
  min: number,
  max: number,
  centre: number,
  opts: { sub?: string; minIncl?: boolean; maxIncl?: boolean } = {},
): Band => ({ key, label, sub: opts.sub, min, max, minIncl: opts.minIncl ?? true, maxIncl: opts.maxIncl ?? false, centre });

export const GRAVITY_BINS: Band[] = [
  band('ug', 'µg', -Infinity, 0.05, 0, { sub: '<0.05 g' }),
  band('lunar', 'Lunar', 0.05, 0.27, 0.16, { sub: '0.05–0.27 g' }),
  band('mars', 'Mars', 0.27, 0.6, 0.435, { sub: '0.27–0.6 g' }),
  band('partial', 'Other partial', 0.6, 0.9, 0.75, { sub: '0.6–0.9 g' }),
  band('1g', '1 g', 0.9, Infinity, 1, { sub: '≥0.9 g', maxIncl: true }),
];

/** Gravity bins that count as partial gravity for the headline. */
export const PARTIAL_G_KEYS = ['lunar', 'mars', 'partial'] as const;

export const O2_BANDS: Band[] = [
  band('o2_lt19', '<19%', -Infinity, 19, 15),
  band('o2_19_23', '19–23%', 19, 23, 21, { sub: 'air' }),
  band('o2_23_30', '23–30%', 23, 30, 26.5),
  band('o2_30_40', '30–40%', 30, 40, 35, { sub: 'Artemis EA' }),
  band('o2_40_70', '40–70%', 40, 70, 55),
  band('o2_70_100', '70–100%', 70, Infinity, 85, { maxIncl: true }),
];

export const PRESSURE_BANDS: Band[] = [
  band('p_lt35', '<35 kPa', -Infinity, 35, 25),
  band('p_35_60', '35–60 kPa', 35, 60, 47.5),
  band('p_60_80', '60–80 kPa', 60, 80, 70),
  band('p_80_110', '80–110 kPa', 80, 110, 95),
  band('p_ge110', '≥110 kPa', 110, Infinity, 130, { maxIncl: true }),
];

export const FLOW_BANDS: Band[] = [
  band('f_q', '≤1 cm/s', -Infinity, 1, 0.5, { sub: 'quiescent', maxIncl: true }),
  band('f_1_5', '1–5 cm/s', 1, 5, 3, { minIncl: false }),
  band('f_5_15', '5–15 cm/s', 5, 15, 10),
  band('f_15_40', '15–40 cm/s', 15, 40, 27.5),
  band('f_ge40', '≥40 cm/s', 40, Infinity, 60, { maxIncl: true }),
];

export function inBand(v: number, b: Band): boolean {
  const okMin = b.minIncl ? v >= b.min : v > b.min;
  const okMax = b.maxIncl ? v <= b.max : v < b.max;
  return okMin && okMax;
}

/** Key of the band containing v, or UNSTATED for null/undefined/NaN. */
export function binOf(v: number | null | undefined, bands: Band[]): string {
  if (v === null || v === undefined || Number.isNaN(v)) return UNSTATED;
  for (const b of bands) if (inBand(v, b)) return b.key;
  return UNSTATED;
}

export type RowAxis = 'o2' | 'pressure' | 'flow';

export const ROW_AXES: Record<RowAxis, { label: string; short: string; bands: Band[] }> = {
  o2: { label: 'Oxygen concentration', short: 'O₂ %', bands: O2_BANDS },
  pressure: { label: 'Total pressure', short: 'Pressure', bands: PRESSURE_BANDS },
  flow: { label: 'Flow speed', short: 'Flow', bands: FLOW_BANDS },
};

export function bandLabel(key: string, bands: Band[]): string {
  if (key === UNSTATED) return 'Unstated';
  return bands.find((b) => b.key === key)?.label ?? key;
}
