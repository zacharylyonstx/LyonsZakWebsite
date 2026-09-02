// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Yard.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { HouseConfig, Lot, Vec2 } from '../types';
import {
  STREET_RADIUS,
  LOT_FRONT_RADIUS,
  frontStripReach,
} from '../world/streetLayout';
import { mat } from '../world/materials';
import { Fence } from './Fence';
import { Gate } from './Gate';
import { Mailbox } from './Mailbox';
import { shouldFenceEdge } from '../world/lots';

const GARAGE_W = 5.6;

interface YardProps {
  config: HouseConfig;
  lot: Lot;
}

/** Rendered lot lawn + fences + driveway + walkway + mailbox. */
export function Yard({ config, lot }: YardProps) {
  const lawnGeom = useMemo(() => buildLawnGeometry(lot.polygon), [lot]);

  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  // House front direction in world XZ (local -Z rotated by yaw) and a point on
  // the front-wall plane. Fences are clipped to the side AWAY from the street.
  const frontDir: Vec2 = [-Math.sin(lot.houseYaw), -Math.cos(lot.houseYaw)];
  const frontPlanePoint: Vec2 = [
    lot.housePivot[0] + frontDir[0] * halfD,
    lot.housePivot[1] + frontDir[1] * halfD,
  ];

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  // Reach the actual curved street/sidewalk (accounts for the bulb curve + the hero's
  // radiusOffset) so the driveway/walkway aren't left short of the curb.
  const reach = (lx: number, r: number) =>
    frontStripReach(config.position, lot.housePivot, lot.houseYaw, halfD, lx, r);
  // Walkway runs to the sidewalk's lawn edge; the mailbox sits a bit past it (curb).
  const walkLen = reach(doorCenterX, LOT_FRONT_RADIUS);
  const mailboxZ = -halfD - reach(config.garageOnLeft ? halfW - 1.0 : -halfW + 1.0, STREET_RADIUS) - 0.2;

  // Driveway slab as a flat quad whose street edge sits ON the (possibly curved) curb,
  // so its two corners meet the pavement instead of one of them stabbing into the road.
  const driveGeom = useMemo(() => {
    const dw = GARAGE_W - 0.2;
    const xL = garageCenterX - dw / 2;
    const xR = garageCenterX + dw / 2;
    const zH = -halfD;
    const zL = -halfD - reach(xL, STREET_RADIUS);
    const zR = -halfD - reach(xR, STREET_RADIUS);
    // Two triangles: houseL, houseR, streetR / houseL, streetR, streetL.
    const pos = new Float32Array([
      xL, 0, zH, xR, 0, zH, xR, 0, zR,
      xL, 0, zH, xR, 0, zR, xL, 0, zL,
    ]);
    const uv = new Float32Array([
      xL * 0.18, zH * 0.18, xR * 0.18, zH * 0.18, xR * 0.18, zR * 0.18,
      xL * 0.18, zH * 0.18, xR * 0.18, zR * 0.18, xL * 0.18, zL * 0.18,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garageCenterX, halfD, lot.housePivot[0], lot.housePivot[1], lot.houseYaw, config.position.kind]);

  return (
    <group>
      {/* Lawn polygon — placed at world origin (geometry IS world XZ) */}
      <mesh geometry={lawnGeom} position={[0, 0.01, 0]} receiveShadow>
        <primitive object={mat.grass()} attach="material" />
      </mesh>

      {/* House-local props (driveway, walkway, mailbox) — these stay relative to the house */}
      <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
        {/* Driveway — quad following the curb (no corner punching into the road) */}
        <mesh geometry={driveGeom} position={[0, 0.022, 0]} receiveShadow>
          <primitive object={mat.concrete()} attach="material" />
        </mesh>

        {/* Front walkway */}
        <mesh position={[doorCenterX, 0.024, -halfD - walkLen / 2]} receiveShadow>
          <boxGeometry args={[1.2, 0.04, walkLen]} />
          <primitive object={mat.sidewalk()} attach="material" />
        </mesh>

        {/* Mailbox at curb (street side of sidewalk) */}
        <Mailbox
          position={[
            config.garageOnLeft ? halfW - 1.0 : -halfW + 1.0,
            0,
            mailboxZ,
          ]}
          name={config.isHero ? 'LYONS' : undefined}
        />
      </group>

      {/* Fences along non-front edges of the lot — but only the portion BEHIND
          the house's front-wall plane, so the front yard stays open to the
          street (real Avery Ranch homes have open front lawns; fencing is a
          back/side-yard feature). frontDir = house local -Z rotated by yaw. */}
      {lot.polygon.map((a0, i) => {
        if (!shouldFenceEdge(lot, i)) return null;
        const b0 = lot.polygon[(i + 1) % lot.polygon.length];
        const clipped = clipBehindFront(a0, b0, frontPlanePoint, frontDir);
        if (!clipped) return null;
        const [a, b] = clipped;
        // Skip if this edge is near a gate slot (we'll render the gate instead)
        const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const nearGate = lot.gateSlots.some(
          (g) => Math.hypot(g[0] - mid[0], g[1] - mid[1]) < 1.0,
        );
        if (nearGate) {
          // Render two short fence pieces flanking the gate slot
          return (
            <FenceWithGate
              key={`fg-${i}`}
              a={a}
              b={b}
              gateAt={lot.gateSlots.find(
                (g) => Math.hypot(g[0] - mid[0], g[1] - mid[1]) < 1.0,
              )!}
            />
          );
        }
        return <Fence key={`f-${i}`} start={[a[0], a[1]]} end={[b[0], b[1]]} />;
      })}
    </group>
  );
}

interface FenceWithGateProps {
  a: Vec2;
  b: Vec2;
  gateAt: Vec2;
}

function FenceWithGate({ a, b, gateAt }: FenceWithGateProps) {
  // Split the edge into two fence pieces, leaving a gap of 1.6m at gateAt.
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return null;
  const ux = dx / len;
  const uz = dz / len;
  const dot = (gateAt[0] - a[0]) * ux + (gateAt[1] - a[1]) * uz;
  const t = Math.max(0.6, Math.min(len - 0.6, dot));
  const gateW = 1.4;
  const halfGate = gateW / 2;
  const aSplitX = a[0] + ux * (t - halfGate);
  const aSplitZ = a[1] + uz * (t - halfGate);
  const bSplitX = a[0] + ux * (t + halfGate);
  const bSplitZ = a[1] + uz * (t + halfGate);
  const gateCenter: Vec2 = [a[0] + ux * t, a[1] + uz * t];
  const gateRot = Math.atan2(uz, ux);
  return (
    <>
      <Fence start={[a[0], a[1]]} end={[aSplitX, aSplitZ]} />
      <Fence start={[bSplitX, bSplitZ]} end={[b[0], b[1]]} />
      <Gate
        position={[gateCenter[0], 0, gateCenter[1]]}
        rotation={gateRot}
        width={gateW}
      />
    </>
  );
}

/**
 * Clip a fence edge to the half-space behind the house's front-wall plane
 * (the side away from the street), so front-yard portions of side fences are
 * removed and the lawn opens to the sidewalk. `n` is the front-facing normal;
 * a point Q is "in front" (street side, no fence) when (Q - p0)·n > 0.
 * Returns the kept sub-segment, or null if the edge is entirely in front.
 */
function clipBehindFront(a: Vec2, b: Vec2, p0: Vec2, n: Vec2): [Vec2, Vec2] | null {
  const EPS = 1e-4;
  const sa = (a[0] - p0[0]) * n[0] + (a[1] - p0[1]) * n[1];
  const sb = (b[0] - p0[0]) * n[0] + (b[1] - p0[1]) * n[1];
  if (sa <= EPS && sb <= EPS) return [a, b];
  if (sa > EPS && sb > EPS) return null;
  const t = sa / (sa - sb);
  const c: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return sa <= EPS ? [a, c] : [c, b];
}

function buildLawnGeometry(polygon: Vec2[]): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(polygon[0][0], polygon[0][1]);
  for (let i = 1; i < polygon.length; i++) {
    shape.lineTo(polygon[i][0], polygon[i][1]);
  }
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  // ShapeGeometry produces XY plane; rotate so it lies on XZ.
  geom.rotateX(-Math.PI / 2);
  // Now Y is up. The original X stays X; the original Y maps to Z but negated.
  // Actually rotateX(-PI/2) sends (x, y, 0) → (x, 0, -y). So our polygon Z became -Z.
  // Compensate by flipping Z in vertex array.
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, -pos.getZ(i));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  // UVs: scale so 1 unit world = 1 unit UV (texture repeat handled in material).
  const uv = geom.getAttribute('uv');
  if (uv) {
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * 0.1, pos.getZ(i) * 0.1);
    }
    uv.needsUpdate = true;
  }
  return geom;
}
