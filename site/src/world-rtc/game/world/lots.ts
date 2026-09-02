// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/lots.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import type { HouseConfig, Lot, Vec2 } from '../types';
import {
  HOUSE_FRONT_RADIUS,
  LOT_FRONT_RADIUS,
  BACKYARD_DEPTH,
  HERO_BACKYARD_DEPTH,
  STRAIGHT_LOT_FRONT_X,
  STRAIGHT_HOUSE_FRONT_X,
  STRAIGHT_START_Z,
  STRAIGHT_END_Z,
  houseTransform,
} from './streetLayout';

/**
 * Build the lot polygon for every house. Bulb houses get pie-slice wedges
 * bounded by the midpoints between adjacent neighbors' angles, so unequal
 * spacing works without overlap. Straight-section houses get rectangles
 * bounded by neighbor z-midpoints. The hero house (10600) gets an enlarged
 * back radius so the UFO has room to crash.
 */
export function buildLots(houses: HouseConfig[]): Lot[] {
  const result: Lot[] = [];

  // ---- Bulb wedges (with dynamic neighbor-midpoint bounds) ----
  const bulbHouses = houses
    .filter((h) => h.position.kind === 'bulb')
    .map((h) => ({ h, ang: h.position.kind === 'bulb' ? h.position.angleDeg : 0 }))
    .sort((a, b) => a.ang - b.ang);

  for (let i = 0; i < bulbHouses.length; i++) {
    const { h, ang } = bulbHouses[i];
    // Find prev and next neighbors. Without wraparound (houses sit on the
    // southern arc — north is the road). We use virtual neighbors at
    // ang - 60 and ang + 60 if there's no real neighbor, but cap so the
    // wedge stays under 50° on either side.
    const prevAng = i > 0 ? bulbHouses[i - 1].ang : ang - 50;
    const nextAng = i < bulbHouses.length - 1 ? bulbHouses[i + 1].ang : ang + 50;
    const lowerBoundDeg = (ang + prevAng) / 2;
    const upperBoundDeg = (ang + nextAng) / 2;
    const a0 = (lowerBoundDeg * Math.PI) / 180;
    const a1 = (upperBoundDeg * Math.PI) / 180;
    const innerR = LOT_FRONT_RADIUS;
    const backyard = h.isHero ? HERO_BACKYARD_DEPTH : BACKYARD_DEPTH;
    const outerR = HOUSE_FRONT_RADIUS + h.depth + backyard;

    // CCW polygon starting at inner edge near a0:
    //   inner-arc samples a0..a1, then outer-arc samples a1..a0
    const samples = 9;
    const polygon: Vec2[] = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const a = a0 + (a1 - a0) * t;
      polygon.push([Math.cos(a) * innerR, Math.sin(a) * innerR]);
    }
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const a = a1 + (a0 - a1) * t;
      polygon.push([Math.cos(a) * outerR, Math.sin(a) * outerR]);
    }

    const tx = houseTransform(h.position, h.depth);
    // Gate slots: midway along each side edge (the radial spokes).
    const midR = (innerR + outerR * 0.45) / 2;
    const gateSlots: Vec2[] = [
      [Math.cos(a1) * midR, Math.sin(a1) * midR],
      [Math.cos(a0) * midR, Math.sin(a0) * midR],
    ];

    result.push({
      address: h.address,
      polygon,
      // The front edge is the inner arc — it's actually `samples - 1` little
      // segments. We mark the FIRST inner-arc segment so callers can detect
      // "front side" by index%polygon.length range. For our purposes the yard
      // renderer simply skips the inner arc entirely (doesn't fence the front).
      frontEdgeIndex: 0,
      housePivot: [tx.worldX, tx.worldZ],
      houseYaw: tx.yaw,
      gateSlots,
      isWedge: true,
    });
  }

  // ---- Straight-section rectangles ----
  for (const side of ['east', 'west'] as const) {
    const sideHouses = houses
      .filter((h) => h.position.kind === 'straight' && h.position.side === side)
      .map((h) => ({ h, z: h.position.kind === 'straight' ? h.position.z : 0 }))
      .sort((a, b) => a.z - b.z);

    const sign = side === 'east' ? 1 : -1;

    for (let i = 0; i < sideHouses.length; i++) {
      const { h, z } = sideHouses[i];
      const prevZ = i === 0 ? STRAIGHT_START_Z : sideHouses[i - 1].z;
      const nextZ = i === sideHouses.length - 1 ? STRAIGHT_END_Z : sideHouses[i + 1].z;
      const lotMinZ = Math.min(z, (z + prevZ) / 2);
      const lotMaxZ = Math.max(z, (z + nextZ) / 2);
      const z0 = Math.min(lotMinZ, lotMaxZ);
      const z1 = Math.max(lotMinZ, lotMaxZ);
      const xFront = sign * STRAIGHT_LOT_FRONT_X;
      const xBack = sign * (STRAIGHT_HOUSE_FRONT_X + h.depth + BACKYARD_DEPTH);

      // CCW (looking down +Y): for east side (xFront < xBack). Just specify
      // a consistent winding regardless of side sign.
      let polygon: Vec2[];
      if (side === 'east') {
        // East side: front at +X, back at +X-larger. Going CCW from the SW corner
        // (front-south) means south→east→north→west.
        polygon = [
          [xFront, z0], // front-south
          [xBack, z0], // back-south
          [xBack, z1], // back-north
          [xFront, z1], // front-north
        ];
      } else {
        // West side mirror.
        polygon = [
          [xFront, z0],
          [xFront, z1],
          [xBack, z1],
          [xBack, z0],
        ];
      }

      const tx = houseTransform(h.position, h.depth);
      const halfHouseDepth = h.depth / 2;
      // Gate at front-of-house line on each side.
      const houseFrontZ = tx.worldZ - halfHouseDepth; // not used — we use the lot z range directly
      void houseFrontZ;
      const gateZ = tx.worldZ - h.depth / 2 + 0.6; // small offset so gate is just past front of house
      const gateSlots: Vec2[] = [
        [tx.worldX + (h.width / 2 + 1.4) * (side === 'east' ? 1 : -1), gateZ],
        [tx.worldX + (h.width / 2 + 1.4) * (side === 'east' ? -1 : 1), gateZ],
      ];

      result.push({
        address: h.address,
        polygon,
        frontEdgeIndex: side === 'east' ? 3 : 0, // index of edge running along the front (xFront)
        housePivot: [tx.worldX, tx.worldZ],
        houseYaw: tx.yaw,
        gateSlots,
        isWedge: false,
      });
    }
  }

  return result;
}

/** Edge between polygon[i] and polygon[(i+1)%len]. Used by yard fence rendering. */
export function* edges(lot: Lot): Generator<{ a: Vec2; b: Vec2; index: number }> {
  const n = lot.polygon.length;
  for (let i = 0; i < n; i++) {
    yield { a: lot.polygon[i], b: lot.polygon[(i + 1) % n], index: i };
  }
}

/**
 * For wedge lots, the "front" is the inner-arc — every segment whose midpoint
 * is at the inner radius. We treat all inner-arc segments as front (no fence).
 * Returns true if this edge index should be fenced.
 */
export function shouldFenceEdge(lot: Lot, edgeIndex: number): boolean {
  if (!lot.isWedge) {
    return edgeIndex !== lot.frontEdgeIndex;
  }
  // Wedge polygon = [innerArcSamples, outerArcSamples]. For samples=9, indices
  // 0..7 are inner segments (between inner-arc points 0..8), 8 is the spoke
  // from inner[8] -> outer[0], 9..16 are outer segments, 17 is the spoke back.
  const samples = 9;
  if (edgeIndex < samples - 1) return false; // inner arc — front, no fence
  return true; // spokes + outer arc are fenced
}
