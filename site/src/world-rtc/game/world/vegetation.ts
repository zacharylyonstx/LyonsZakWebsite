// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/vegetation.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import type { HouseConfig, Lot, RectCollider } from '../types';
import { FRONT_YARD_DEPTH } from './streetLayout';

// Single source of truth for neighborhood tree placement, shared by the renderer
// (Game.tsx) and the collider builder so trees you can see are trees you bump
// into — no driving/walking straight through a trunk.

/**
 * Common-area / greenbelt tree line behind the lots, spanning the street from
 * the bulb up toward the Avery Ranch Blvd entry. (The old pair at (±12,-179)
 * was sitting IN the boulevard pavement — removed.)
 */
export const GREENBELT_TREES: { x: number; z: number }[] = [
  { x: -42, z: -35 }, { x: 42, z: -35 },
  { x: -44, z: -72 }, { x: 44, z: -72 },
  { x: -44, z: -108 }, { x: 44, z: -108 },
  { x: -42, z: -144 }, { x: 42, z: -144 },
  { x: -40, z: -172 }, { x: 40, z: -172 },
];

export interface LotTrees {
  oak: [number, number];      // backyard live oak (world x, z)
  myrtle: [number, number];   // front crepe myrtle (world x, z)
  oakScale: number;
  myrtleScale: number;
  myrtleBloom: string;
  hedge: { x: number; z: number; rotation: number } | null;
  seed: number;
}

/** Deterministic tree layout for a generic (non-hero) lot. Returns null for the
 *  hero house, which plants its own trees. Mirrors the math the renderer uses. */
export function lotTrees(address: string, lot: Lot, depth: number, width: number, garageOnLeft: boolean): LotTrees | null {
  if (address === '10600') return null;
  const seed = address.charCodeAt(0) * 131 + address.charCodeAt(2) * 7;
  const cx = lot.housePivot[0];
  const cz = lot.housePivot[1];
  const yawCos = Math.cos(lot.houseYaw);
  const yawSin = Math.sin(lot.houseYaw);
  const halfD = depth / 2;
  const halfW = width / 2;
  const backLocalX = ((seed % 7) - 3) * 0.7;
  const backLocalZ = halfD + 4 + (seed % 3);
  const backWX = cx + backLocalX * yawCos + backLocalZ * yawSin;
  const backWZ = cz - backLocalX * yawSin + backLocalZ * yawCos;
  const sideLocalX = (garageOnLeft ? -1 : 1) * (halfW + 1.0);
  const sideLocalZ = -halfD - FRONT_YARD_DEPTH * 0.72;
  const sideWX = cx + sideLocalX * yawCos + sideLocalZ * yawSin;
  const sideWZ = cz - sideLocalX * yawSin + sideLocalZ * yawCos;
  const showHedge = (seed % 3) === 0;
  const hedgeLocalZ = -halfD - 0.7;
  const hedgeWX = cx + hedgeLocalZ * yawSin;
  const hedgeWZ = cz + hedgeLocalZ * yawCos;
  return {
    oak: [backWX, backWZ],
    myrtle: [sideWX, sideWZ],
    oakScale: 1.15 + (seed % 5) * 0.05,
    myrtleScale: 0.9 + (seed % 3) * 0.07,
    myrtleBloom: (seed % 2) === 0 ? '#d985b3' : '#c66ea4',
    hedge: showHedge ? { x: hedgeWX, z: hedgeWZ, rotation: lot.houseYaw } : null,
    seed,
  };
}

/** Thin trunk colliders so vehicles/players can't pass through a tree. Canopies
 *  are up high and irrelevant — only the trunk blocks. */
export function buildTreeColliders(houses: HouseConfig[], lotsByAddress: Map<string, Lot>): RectCollider[] {
  const out: RectCollider[] = [];
  const trunk = (x: number, z: number, r: number, maxY: number, tag: string) => {
    out.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, minY: 0, maxY, tag });
  };
  GREENBELT_TREES.forEach((t, i) => trunk(t.x, t.z, 0.6, 6, `tree-greenbelt-${i}`));
  for (const h of houses) {
    const lot = lotsByAddress.get(h.address);
    if (!lot) continue;
    const lt = lotTrees(h.address, lot, h.depth, h.width, h.garageOnLeft);
    if (!lt) continue;
    trunk(lt.oak[0], lt.oak[1], 0.55, 6, `tree-oak-${h.address}`);
    trunk(lt.myrtle[0], lt.myrtle[1], 0.4, 4, `tree-myrtle-${h.address}`);
  }
  return out;
}
