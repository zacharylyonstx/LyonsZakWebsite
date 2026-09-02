// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/props.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import type { HouseConfig } from '../types';

// Deterministic per-address prop placement. Hash the address and roll for
// each prop type; placements are stable across runs.

export type PropTag =
  | 'truck'
  | 'sedan'
  | 'hoop'
  | 'bins'
  | 'patio'      // BBQ + chairs in backyard
  | 'gardenBed'
  | 'hose'
  | 'bike'
  | 'flagpole'   // hero house only
  | 'bayWindow'  // hero house only
  | 'kidsBikes'; // hero house only

export interface HouseProps {
  address: string;
  /** Color string for the truck/sedan if present. */
  vehicleColor?: string;
  tags: Set<PropTag>;
}

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class Prng {
  private state: number;
  constructor(seed: number) { this.state = seed || 1; }
  next(): number {
    // Mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p: number): boolean { return this.next() < p; }
}

// Brighter, cheerful car colours (no near-black) so vehicles read as real cars.
const VEHICLE_COLORS = [
  '#3a62a8', // blue
  '#c23a3a', // red
  '#c6a45c', // gold/tan
  '#5a6472', // slate gray
  '#b8b8be', // silver
  '#4f864f', // green
  '#e0dacb', // off-white
  '#cf7a3a', // orange
] as const;

export function buildPropsFor(houses: HouseConfig[]): Map<string, HouseProps> {
  const out = new Map<string, HouseProps>();
  for (const h of houses) {
    const seed = hash(h.address);
    const prng = new Prng(seed);
    const tags = new Set<PropTag>();

    if (h.isHero) {
      tags.add('truck');
      tags.add('hoop');
      // (no 'patio' — the backyard is the trampoline + "68" playhouse now)
      tags.add('flagpole');
      tags.add('bayWindow');
      tags.add('kidsBikes');
      tags.add('bins');
      // gardenBed intentionally omitted: its placement (-halfW + 2.5) lands
      // directly on top of the front door (-halfW + 2.4), blocking entry.
      out.set(h.address, {
        address: h.address,
        vehicleColor: '#3f72c4', // bright blue F-150 for Zak
        tags,
      });
      continue;
    }

    // Vehicle: 80% chance overall, 55/45 truck/sedan
    let vehicleColor: string | undefined;
    if (prng.chance(0.8)) {
      tags.add(prng.chance(0.55) ? 'truck' : 'sedan');
      vehicleColor = prng.pick(VEHICLE_COLORS);
    }
    // Basketball hoop is ONLY at 10600 (the family home) — no neighbor hoops.
    if (prng.chance(0.55)) tags.add('bins');
    if (prng.chance(0.70)) tags.add('patio');
    if (prng.chance(0.40)) tags.add('gardenBed');
    if (prng.chance(0.40)) tags.add('hose');
    if (prng.chance(0.25)) tags.add('bike');

    out.set(h.address, { address: h.address, vehicleColor, tags });
  }
  return out;
}
