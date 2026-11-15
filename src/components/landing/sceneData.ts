import type { Finding, Mission, MissionId, Platform } from '../../types';
import { binOf, GRAVITY_BINS, O2_BANDS, PRESSURE_BANDS } from '../../lib/bins';
import { partialGStats } from '../../lib/stats';

/** Condition-space axes (world units). x = gravity (piecewise between labelled anchors), y = O2, z = log pressure. */
export const G_ANCHORS = [0, 0.17, 0.38, 1];
const X_ANCHORS = [-6, -1.6, 1.6, 6];
export const Z_UNSTATED = -5.6; // back plane: "pressure not stated"
export const U_PLANE_Z = 5.2; // side plane for the schematic U-curve

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function gx(g: number): number {
  const v = clamp(g, 0, 1.5);
  for (let i = 0; i < G_ANCHORS.length - 1; i++) {
    const a = G_ANCHORS[i];
    const b = G_ANCHORS[i + 1];
    if (v <= b || i === G_ANCHORS.length - 2) {
      const t = (v - a) / (b - a);
      return X_ANCHORS[i] + t * (X_ANCHORS[i + 1] - X_ANCHORS[i]);
    }
  }
  return X_ANCHORS[X_ANCHORS.length - 1];
}

export function oy(o2: number): number {
  return ((clamp(o2, 10, 100) - 10) / 90) * 8 - 4;
}

const LP0 = Math.log10(20);
const LP1 = Math.log10(330);
export function pz(p: number): number {
  return ((Math.log10(clamp(p, 20, 330)) - LP0) / (LP1 - LP0)) * 8 - 4;
}

export interface ScenePoint {
  id: string;
  x: number;
  y: number;
  z: number;
  psi: boolean;
  tier: number;
  pressureStated: boolean;
}

export interface SceneRing {
  id: MissionId;
  label: string;
  x: number;
  y: number;
  z: number;
  highlight: boolean;
}

export interface SceneInput {
  points: ScenePoint[];
  rings: SceneRing[];
  artemis: { x: number; y: number; z: number } | null;
}

function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Every finding with stated gravity AND O2 becomes a point; rings for missions with a sourced atmosphere. */
export function buildSceneInput(findings: Finding[], missions: Mission[]): SceneInput {
  const points: ScenePoint[] = [];
  for (const f of findings) {
    if (f.gravity_g === null || f.o2_percent === null) continue;
    const jx = (hash01(f.id, 1) - 0.5) * 0.3; // small deterministic jitter so coincident records stay visible
    const jz = (hash01(f.id, 2) - 0.5) * 0.3;
    const stated = f.pressure_kpa !== null;
    points.push({
      id: f.id,
      x: gx(f.gravity_g) + jx,
      y: oy(f.o2_percent),
      z: stated ? pz(f.pressure_kpa as number) + jz : Z_UNSTATED,
      psi: f.psi_id !== null,
      tier: f.evidence_tier,
      pressureStated: stated,
    });
  }
  const rings: SceneRing[] = [];
  let artemis: SceneInput['artemis'] = null;
  for (const m of missions) {
    const g = m.gravity?.value ?? null;
    const o = m.o2?.value ?? null;
    const p = m.pressure?.value ?? null;
    if (g === null || o === null || p === null) continue;
    const ring = { id: m.id, label: m.name, x: gx(g), y: oy(o), z: pz(p), highlight: m.id === 'artemis_habitat' };
    rings.push(ring);
    if (ring.highlight) artemis = { x: ring.x, y: ring.y, z: ring.z };
  }
  return { points, rings, artemis };
}

export interface SceneCounts {
  plotted: number;
  oneG: number;
  ug: number;
  ugPlotted: number;
  ugPsi: number;
  partialPsi: number;
  partialNonPsi: number;
  partialPlatforms: Platform[];
  artemisCell: number | null; // same gravity bin x O2 band
  artemisCell3: number | null; // same gravity bin x O2 band x pressure band
}

export function sceneCounts(findings: Finding[], missions: Mission[]): SceneCounts {
  const bin = (g: number | null) => binOf(g, GRAVITY_BINS);
  const ugAll = findings.filter((f) => bin(f.gravity_g) === 'ug');
  const pg = partialGStats(findings);
  const art = missions.find((m) => m.id === 'artemis_habitat');
  let artemisCell: number | null = null;
  let artemisCell3: number | null = null;
  if (art && art.gravity?.value !== null && art.o2 && art.o2.value !== null) {
    const gk = bin(art.gravity.value);
    const ok = binOf(art.o2.value, O2_BANDS);
    const inCell = findings.filter((f) => bin(f.gravity_g) === gk && binOf(f.o2_percent, O2_BANDS) === ok);
    artemisCell = inCell.length;
    if (art.pressure && art.pressure.value !== null) {
      const pk = binOf(art.pressure.value, PRESSURE_BANDS);
      artemisCell3 = inCell.filter((f) => binOf(f.pressure_kpa, PRESSURE_BANDS) === pk).length;
    }
  }
  return {
    plotted: findings.filter((f) => f.gravity_g !== null && f.o2_percent !== null).length,
    oneG: findings.filter((f) => bin(f.gravity_g) === '1g').length,
    ug: ugAll.length,
    ugPlotted: ugAll.filter((f) => f.o2_percent !== null).length,
    ugPsi: ugAll.filter((f) => f.psi_id !== null).length,
    partialPsi: pg.psi,
    partialNonPsi: pg.nonPsi,
    partialPlatforms: pg.platforms,
    artemisCell,
    artemisCell3,
  };
}
