// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/Ramp.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { usePlayStore } from '../../state/playStore';
import type { Floor, RectCollider } from '../../types';

/**
 * A stylized plywood launch ramp parked midway down the street. It is a pure
 * visual + a registered launch *trigger* (no blocking collider), so bikes rolling
 * up it with speed get thrown into the air (see rideBikeTick). On foot you can run
 * up the deck too.
 *
 * Built in a plain world-aligned group (ramp axis = world Z): the deck slopes from
 * a low foot on the +Z side up to a lip on the -Z side, so riding down-street (-Z)
 * launches you. The store heading (0 = launch toward -Z) matches that.
 */

const RAMP_X = 0;
const RAMP_Z = -48;
const RAMP_HEADING = 0; // launch direction -Z (ride down-street, up the deck)
const LEN = 4.6;        // along-street footprint
const WID = 3.2;        // across-street width
const LIP_H = 1.2;      // lip height

const DECK = '#c08a4e';   // plywood
const FRAME = '#6e4a29';  // darker structural
const STRIPE = '#e8b53a'; // hazard stripe

// The lip (high end) is at -Z, the foot (low end, where you ride on) at +Z.
const LIP_Z = RAMP_Z - LEN / 2;
const FOOT_Z = RAMP_Z + LEN / 2;

/**
 * The ramp deck as a sloped floor: walk up the slope (foot at +Z, y=0) to the
 * lip (-Z, y=LIP_H) and over. Lets the player ride/run up it without clipping.
 */
export function buildRampFloor(): Floor {
  return {
    minX: RAMP_X - WID / 2,
    maxX: RAMP_X + WID / 2,
    minZ: LIP_Z,   // lip end (high)
    maxZ: FOOT_Z,  // foot end (low)
    baseY: LIP_H,  // y at minZ (lip)
    topY: 0,       // y at maxZ (foot)
    axis: 'z',
  };
}

/**
 * Solid faces of the ramp for the PLAYER and BALL (back lip + two sides) — kept
 * out of the bike's set on purpose (the bike has its own Y-aware ramp logic so
 * the airborne launch isn't blocked). maxY = LIP_H so high arcs fly over.
 */
export function buildRampColliders(): RectCollider[] {
  return [
    { minX: RAMP_X - WID / 2, maxX: RAMP_X + WID / 2, minZ: LIP_Z - 0.12, maxZ: LIP_Z + 0.12, minY: 0, maxY: LIP_H, tag: 'ramp-back' },
    { minX: RAMP_X - WID / 2 - 0.12, maxX: RAMP_X - WID / 2 + 0.12, minZ: LIP_Z, maxZ: FOOT_Z, minY: 0, maxY: LIP_H, tag: 'ramp-side-l' },
    { minX: RAMP_X + WID / 2 - 0.12, maxX: RAMP_X + WID / 2 + 0.12, minZ: LIP_Z, maxZ: FOOT_Z, minY: 0, maxY: LIP_H, tag: 'ramp-side-r' },
  ];
}

export function Ramp() {
  useEffect(() => {
    usePlayStore.getState().registerRamp({
      x: RAMP_X,
      z: RAMP_Z,
      heading: RAMP_HEADING,
      halfLen: LEN / 2 + 0.3,
      halfWid: WID / 2 + 0.3,
    });
  }, []);

  const slopeLen = Math.hypot(LEN, LIP_H);
  const theta = Math.atan2(LIP_H, LEN);

  // Triangular side-cheek profile (in shape XY = local Z,Y), high point at -Z lip.
  const cheek = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(LEN / 2, 0);    // foot (+Z, low)
    s.lineTo(-LEN / 2, 0);   // base (-Z, ground)
    s.lineTo(-LEN / 2, LIP_H); // lip (-Z, high)
    s.closePath();
    return s;
  }, []);

  return (
    <group position={[RAMP_X, 0, RAMP_Z]}>
      {/* Two triangular side cheeks (rotated to face ±X). */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (WID / 2), 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
          <shapeGeometry args={[cheek]} />
          <meshStandardMaterial color={FRAME} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Sloped deck (the ride surface): low foot at +Z, high lip at -Z. */}
      <mesh position={[0, LIP_H / 2, 0]} rotation={[theta, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[WID, 0.16, slopeLen]} />
        <meshStandardMaterial color={DECK} roughness={0.85} />
      </mesh>

      {/* Hazard stripes near the lip. */}
      {[-0.55, 0, 0.55].map((ox) => (
        <mesh
          key={ox}
          position={[ox, LIP_H - 0.18, -LEN / 2 + 0.35]}
          rotation={[theta, 0, 0]}
        >
          <boxGeometry args={[0.32, 0.02, 0.9]} />
          <meshStandardMaterial color={STRIPE} roughness={0.6} emissive={STRIPE} emissiveIntensity={0.15} />
        </mesh>
      ))}

      {/* Rounded coping along the lip edge. */}
      <mesh position={[0, LIP_H, -LEN / 2]} castShadow>
        <boxGeometry args={[WID + 0.1, 0.14, 0.18]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Back kicker face under the lip (closes the wedge). */}
      <mesh position={[0, LIP_H / 2, -LEN / 2 - 0.02]} castShadow>
        <boxGeometry args={[WID, LIP_H, 0.1]} />
        <meshStandardMaterial color={FRAME} roughness={0.9} />
      </mesh>
    </group>
  );
}
