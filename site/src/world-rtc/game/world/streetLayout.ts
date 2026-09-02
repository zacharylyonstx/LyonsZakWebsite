// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/streetLayout.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
// Geometry of the Royal Tara Cove cul-de-sac.
//
// World convention: y is up, +x east, +z south. The bulb of the cul-de-sac
// is centered at the world origin; the straight section extends NORTH from
// the bulb (i.e. into negative Z) up to where it meets Avery Ranch Blvd.
//
// In real life the street is a "lollipop": a long straight stick with the
// bulb (cul-de-sac) at the south end. We model it the same way.
//
// Address numbering goes from south (cul-de-sac) to north (entry):
//   10600/10601/10604/10605 wrap around the bulb
//   10609..10649 line the straight section, evens west, odds east (no 10606/8/10)

// --- Cul-de-sac bulb (south end) ---
// Real Royal Tara Cove bulb is ~14-15 m pavement radius (measured from Esri
// satellite + OSM turning_circle + TX residential cul-de-sac specs). The old
// 22 m read as a parking lot.
export const STREET_RADIUS = 14.5;        // pavement edge of the bulb
export const SIDEWALK_WIDTH = 1.4;
export const LOT_FRONT_RADIUS = STREET_RADIUS + SIDEWALK_WIDTH;
export const FRONT_YARD_DEPTH = 7;
export const HOUSE_FRONT_RADIUS = LOT_FRONT_RADIUS + FRONT_YARD_DEPTH;
export const BACKYARD_DEPTH = 12;
/** Extra-deep backyard for the hero house (10600) — UFO needs landing room. */
export const HERO_BACKYARD_DEPTH = 24;

// --- Straight section (running north from bulb to Avery Ranch Blvd) ---
// The section starts where it meets the top of the bulb and extends ~165m north
// (real measured length; 25 homes total, ~21 lining the straight stick).
export const STRAIGHT_START_Z = -STREET_RADIUS;            // south end of straight (joins bulb)
export const STRAIGHT_END_Z = -STREET_RADIUS - 165;        // north end (entry); real stick ~165 m
export const STRAIGHT_LENGTH = STRAIGHT_START_Z - STRAIGHT_END_Z; // 95
export const STRAIGHT_HALF_ROAD = 5.0;                     // road centerline to curb (10m wide road)
export const STRAIGHT_LOT_FRONT_X = STRAIGHT_HALF_ROAD + SIDEWALK_WIDTH; // sidewalk outer edge
export const STRAIGHT_HOUSE_FRONT_X = STRAIGHT_LOT_FRONT_X + FRONT_YARD_DEPTH; // 13.4m
export const STRAIGHT_BACK_X = STRAIGHT_HOUSE_FRONT_X + 13 + BACKYARD_DEPTH;   // back fence

// --- Per-house position type ---
// A house lives EITHER on the bulb (polar) OR on the straight section (linear).
export type HousePosition =
  | { kind: 'bulb'; angleDeg: number; radiusOffset?: number }
  | { kind: 'straight'; side: 'east' | 'west'; z: number };

export interface HouseTransform {
  worldX: number;
  worldZ: number;
  yaw: number;        // rotation around Y so the house's front (-Z local) faces inward
}

// Convert a HousePosition + house depth to world transform.
// `houseDepth` is the front-to-back dimension of the house body.
//
// For a house at polar angle θ on the bulb, its position is (R cos θ, R sin θ)
// and we want its local –Z (front) to point toward origin. From the rotation
// math (Ry(α) sends (0,0,-1) to (-sin α, 0, -cos α)) we need
//     yaw α = 90° − θ.
export function houseTransform(pos: HousePosition, houseDepth: number): HouseTransform {
  if (pos.kind === 'bulb') {
    // radiusOffset pushes a house deeper into its lot (used by the wide hero house
    // so it doesn't crowd its cul-de-sac neighbors).
    const r = HOUSE_FRONT_RADIUS + houseDepth / 2 + (pos.radiusOffset ?? 0);
    const rad = (pos.angleDeg * Math.PI) / 180;
    return {
      worldX: Math.cos(rad) * r,
      worldZ: Math.sin(rad) * r,
      yaw: (Math.PI / 2) - rad,
    };
  }
  // Straight section: house faces the road centerline (+x or -x).
  // East-side house at +X needs front (local -Z) to point in -X direction
  //   → yaw = +π/2. West-side house at -X needs front in +X → yaw = -π/2.
  const sign = pos.side === 'east' ? 1 : -1;
  const x = sign * (STRAIGHT_HOUSE_FRONT_X + houseDepth / 2);
  const yaw = pos.side === 'east' ? Math.PI / 2 : -Math.PI / 2;
  return { worldX: x, worldZ: pos.z, yaw };
}

// Lerp between START_Z and END_Z based on a 0..1 factor (0 = south near bulb, 1 = north entry).
export function straightZ(t: number): number {
  return STRAIGHT_START_Z + (STRAIGHT_END_Z - STRAIGHT_START_Z) * t;
}

/**
 * How far past the house front (in house-LOCAL +front units) a strip at house-local
 * X must run to reach a target radius. On the bulb the street/sidewalk is a CIRCLE,
 * so an off-center strip (the driveway at the garage) — and any radiusOffset — make
 * the real reach longer than the flat FRONT_YARD_DEPTH. Used to extend driveways /
 * curb props (hoop, bins, mailbox) so they actually meet the street.
 *   targetR: STREET_RADIUS (pavement) or LOT_FRONT_RADIUS (sidewalk lawn edge).
 * Straight-section houses keep the flat FRONT_YARD_DEPTH (they already meet the road).
 */
export function frontStripReach(
  pos: HousePosition,
  housePivot: [number, number],
  houseYaw: number,
  halfD: number,
  localX: number,
  targetR: number,
): number {
  if (pos.kind !== 'bulb') return FRONT_YARD_DEPTH;
  const cy = Math.cos(houseYaw);
  const sy = Math.sin(houseYaw);
  // House-front world point at this local X, and the front direction (toward street).
  const px = housePivot[0] + localX * cy + -halfD * sy;
  const pz = housePivot[1] - localX * sy + -halfD * cy;
  const fx = -sy;
  const fz = -cy;
  // Ray (px,pz)+d*(fx,fz) hits the circle radius targetR centered at the origin.
  const PdotF = px * fx + pz * fz;
  const disc = PdotF * PdotF - (px * px + pz * pz - targetR * targetR);
  if (disc <= 0) return FRONT_YARD_DEPTH;
  const d = -PdotF - Math.sqrt(disc);
  return d > 0 ? d : FRONT_YARD_DEPTH;
}
