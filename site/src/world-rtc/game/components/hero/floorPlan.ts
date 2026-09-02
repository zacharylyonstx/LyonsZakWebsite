// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/hero/floorPlan.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
// Single source of truth for the 10600 hero house interior layout.
// Renderer (Interior10600.tsx), collider builder (HeroHouse10600.tsx),
// and any future consumer all read from this file so geometry can't drift.
//
// House-local coordinate system: facing INTO the house (+Z) your RIGHT is -X
// (garage / stairs / family + bedrooms above) and your LEFT is +X (front door,
// great room + game room above). -Z = front (street), +Z = back (yard).
// Hero house: width=24 (x=-12..12), depth=18 (z=-9..9).

export type FloorMaterial = 'wood' | 'tile' | 'concrete';

export type RoomId =
  | 'great' | 'kitchen' | 'family'
  | 'garage';

export interface Room {
  id: RoomId;
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  floor: FloorMaterial;
  /** Drywall ceiling at y=2.95. False for garage (open rafters). */
  ceiling: boolean;
}

export interface InteriorWall {
  /** 'x' = wall runs along the X axis (constant Z); 'z' = wall runs along the Z axis (constant X). */
  axis: 'x' | 'z';
  /** Position on the constant axis. */
  at: number;
  /** Span on the variable axis. */
  from: number; to: number;
  /** Door openings (1m wide) on the variable axis. Wall mesh is split around these. */
  openings: { from: number; to: number }[];
  tag: string;
}

/** Interior wall height (matches the existing `<InteriorWall>` mesh). */
export const WALL_HEIGHT = 2.8;
/** Interior wall thickness. */
export const WALL_THICK = 0.15;
/** Interior wall y-center (mesh position). */
export const WALL_Y = 1.4;

// House: width 24 (x = -12..12), depth 18 (z = -9..9). Facing in (+Z) the RIGHT is
// -X (garage side), the LEFT is +X (front door + oak). Two columns:
//   RIGHT  (-X, x=-12..-4): garage (front) → family den (back, green + fireplace)
//   LEFT+CENTER (x=-4..12): great room (front, 2-story) → kitchen (back)
// The staircase is NOT in this column — it lives IN the great room against the
// garage wall, open to the two-story space (see StairsAndLoft.tsx), like the real
// entry photo: you see it the moment you walk in.
export const ROOMS: Room[] = [
  // Left/center: the open flow you walk into.
  { id: 'great',   minX: -4.0, maxX: 12.0, minZ: -9.0, maxZ:  1.0, floor: 'wood', ceiling: false },
  { id: 'kitchen', minX: -4.0, maxX: 12.0, minZ:  1.0, maxZ:  9.0, floor: 'tile', ceiling: true },
  // Right (-X) column.
  { id: 'garage', minX: -12.0, maxX: -4.0, minZ: -9.0, maxZ: -1.5, floor: 'concrete', ceiling: false },
  { id: 'family', minX: -12.0, maxX: -4.0, minZ: -1.5, maxZ:  9.0, floor: 'wood', ceiling: true },
];

export const INTERIOR_WALLS: InteriorWall[] = [
  // Right wall of the great room / kitchen (x = -4): behind it is the garage (front)
  // and the family den (back). The staircase stands in the great room just east of
  // this wall, so z=-9..-1.5 stays solid (the garage/stair wall). Openings let you
  // into the family den.
  { axis: 'z', at: -4.0, from: -9.0, to: 9.0, openings: [
    { from: -0.5, to: 1.0 },   // great room ↔ family (front of the den)
    { from:  3.0, to: 7.0 },   // kitchen → family dog-leg
  ], tag: 'right-spine' },
  // Garage back wall (z = -1.5): garage is enclosed; a man-door into the family den.
  { axis: 'x', at: -1.5, from: -12.0, to: -4.0, openings: [
    { from: -6.0, to: -5.0 },  // garage man-door
  ], tag: 'garage-back' },
];

/**
 * Module-load self-check: throws if rooms overlap, walls cross room interiors,
 * or door openings escape the wall span. We want structural mistakes to surface
 * the first time the renderer mounts, not 15 minutes into a playtest.
 */
function validate(): void {
  // 1. No two non-garage rooms overlap.
  const livable = ROOMS.filter((r) => r.id !== 'garage');
  for (let i = 0; i < livable.length; i++) {
    for (let j = i + 1; j < livable.length; j++) {
      const a = livable[i], b = livable[j];
      const overlaps =
        a.minX < b.maxX && b.minX < a.maxX &&
        a.minZ < b.maxZ && b.minZ < a.maxZ;
      if (overlaps) {
        throw new Error(`floorPlan: rooms "${a.id}" and "${b.id}" overlap`);
      }
    }
  }

  // 2. Every wall opening lies within the wall span.
  for (const w of INTERIOR_WALLS) {
    for (const op of w.openings) {
      if (op.from < w.from - 0.001 || op.to > w.to + 0.001 || op.from >= op.to) {
        throw new Error(`floorPlan: wall "${w.tag}" opening (${op.from}, ${op.to}) escapes span (${w.from}, ${w.to})`);
      }
    }
  }

  // 3. The interior bounds cover x=-12..+12 and z=-9..+9 (the hero house livable + garage).
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of ROOMS) {
    if (r.minX < minX) minX = r.minX;
    if (r.maxX > maxX) maxX = r.maxX;
    if (r.minZ < minZ) minZ = r.minZ;
    if (r.maxZ > maxZ) maxZ = r.maxZ;
  }
  if (minX !== -12.0 || maxX !== 12.0 || minZ !== -9.0 || maxZ !== 9.0) {
    throw new Error(`floorPlan: room bounds (${minX}..${maxX}, ${minZ}..${maxZ}) don't match hero house (-12..12, -9..9)`);
  }
}
validate();

export function roomCenter(id: RoomId): [number, number] {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`floorPlan: no room "${id}"`);
  return [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
}
