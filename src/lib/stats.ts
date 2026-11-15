import type { Finding } from '../types';
import { binOf, GRAVITY_BINS, PARTIAL_G_KEYS } from './bins';

/**
 * "Artemis-like atmosphere": O₂ ≥ 30 % and total pressure ≤ 70.3 kPa (10.2 psi), both stated by the source.
 * Thresholds follow the challenge brief's lunar base / rover atmosphere; the UI cites the claim next to the stat.
 */
export const ARTEMIS_LIKE = { o2MinPercent: 30, pressureMaxKpa: 70.3 } as const;

export function artemisLikeShare(findings: Finding[]): { count: number; total: number; fraction: number | null } {
  const total = findings.length;
  const count = findings.filter(
    (f) =>
      f.o2_percent !== null &&
      f.pressure_kpa !== null &&
      f.o2_percent >= ARTEMIS_LIKE.o2MinPercent &&
      f.pressure_kpa <= ARTEMIS_LIKE.pressureMaxKpa,
  ).length;
  return { count, total, fraction: total === 0 ? null : count / total };
}

export function distinctExperiments(findings: Finding[]): string[] {
  const set = new Set<string>();
  for (const f of findings) {
    const e = (f.experiment ?? '').trim();
    if (e && e.toLowerCase() !== 'other') set.add(e);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function distinctSources(findings: Finding[]): number {
  return new Set(findings.map((f) => f.source_id)).size;
}

export function isPartialG(g: number | null): boolean {
  return (PARTIAL_G_KEYS as readonly string[]).includes(binOf(g, GRAVITY_BINS));
}

export function partialGStats(findings: Finding[]) {
  const real = findings.filter((f) => isPartialG(f.gravity_g));
  const analogues = findings.filter((f) => f.analogue_of_g !== null && isPartialG(f.analogue_of_g));
  const psi = real.filter((f) => f.psi_id !== null).length;
  const nonPsi = real.length - psi;
  const platforms = [...new Set([...real, ...analogues].map((f) => f.platform))];
  return { psi, nonPsi, analogues: analogues.length, platforms };
}

export function normalizeMaterial(m: string | null): string | null {
  if (!m) return null;
  const s = m.trim().replace(/\s+/g, ' ');
  return s ? s.toLowerCase() : null;
}

export interface MaterialBound {
  key: string;
  label: string;
  zeroG: Finding[];
  oneG: Finding[];
}

/** Materials that have at least one µg finding and at least one 1 g finding (exact name match after trimming). */
export function materialsWithBothBounds(findings: Finding[]): MaterialBound[] {
  const map = new Map<string, MaterialBound>();
  for (const f of findings) {
    const key = normalizeMaterial(f.material);
    if (!key) continue;
    const bin = binOf(f.gravity_g, GRAVITY_BINS);
    if (bin !== 'ug' && bin !== '1g') continue;
    let entry = map.get(key);
    if (!entry) {
      entry = { key, label: (f.material ?? key).trim(), zeroG: [], oneG: [] };
      map.set(key, entry);
    }
    (bin === 'ug' ? entry.zeroG : entry.oneG).push(f);
  }
  return [...map.values()]
    .filter((e) => e.zeroG.length > 0 && e.oneG.length > 0)
    .sort((a, b) => b.zeroG.length + b.oneG.length - (a.zeroG.length + a.oneG.length));
}
