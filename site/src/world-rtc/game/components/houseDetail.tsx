// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/houseDetail.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mat } from '../world/materials';

/**
 * Realistic facade details shared by the house renderer: a mullioned window
 * unit (white trim + recessed glass + grid muntins + sill), louvered shutters,
 * a gabled entry portico, and a front gable accent. All placed in house-LOCAL
 * space on the front (z ≈ -halfD) or sides.
 */

const TRIM = '#f4f1e8';

interface WindowUnitProps {
  /** Position of the window CENTER in the parent group. */
  position: [number, number, number];
  w: number;
  h: number;
  /** Grid muntins: columns x rows of panes (0/1 = no grid). */
  cols?: number;
  rows?: number;
  trimColor?: string;
  /** Louvered shutters flanking the window. */
  shutters?: boolean;
  shutterColor?: string;
  /** Face normal: +Z (front, default), -Z (back), +X / -X (sides). */
  facing?: 'z' | '-z' | 'x' | '-x';
}

/** A double-hung style window with white trim, recessed glass + grid + sill. */
export function WindowUnit({
  position,
  w,
  h,
  cols = 2,
  rows = 2,
  trimColor = TRIM,
  shutters = false,
  shutterColor = '#34423a',
  facing = 'z',
}: WindowUnitProps) {
  const yRot = facing === 'x' ? Math.PI / 2 : facing === '-x' ? -Math.PI / 2 : facing === '-z' ? Math.PI : 0;
  // Per-window glass variant from its position, so neighbouring panes don't all
  // show the identical sky-glint. Wall depth (±halfD/halfW) differs per house, so
  // this also varies house-to-house for free.
  const glassSeed = Math.round(position[0] * 12.9 + position[1] * 7.7 + position[2] * 3.3);
  const fw = 0.06; // frame width
  const muntin = 0.035;
  const vBars = Math.max(0, cols - 1);
  const hBars = Math.max(0, rows - 1);

  return (
    <group position={position} rotation={[0, yRot, 0]}>
      {/* white casing/trim board behind the glass */}
      <mesh position={[0, 0, -0.02]} castShadow>
        <boxGeometry args={[w + fw * 2 + 0.06, h + fw * 2 + 0.06, 0.05]} />
        <meshStandardMaterial color={trimColor} roughness={0.6} />
      </mesh>
      {/* recessed glass — self-lit sky/interior pane (z=0.02 is the z-safe depth) */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[w, h, 0.02]} />
        <primitive object={mat.glassFor(glassSeed)} attach="material" />
      </mesh>
      {/* outer frame (4 thin bars) */}
      {[
        [0, h / 2 + fw / 2, w + fw * 2, fw],
        [0, -h / 2 - fw / 2, w + fw * 2, fw],
        [-w / 2 - fw / 2, 0, fw, h],
        [w / 2 + fw / 2, 0, fw, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={`f${i}`} position={[x, y, 0.05]} castShadow>
          <boxGeometry args={[bw, bh, 0.05]} />
          <meshStandardMaterial color={trimColor} roughness={0.6} />
        </mesh>
      ))}
      {/* grid muntins */}
      {Array.from({ length: vBars }, (_, i) => {
        const x = -w / 2 + (w / cols) * (i + 1);
        return (
          <mesh key={`v${i}`} position={[x, 0, 0.05]}>
            <boxGeometry args={[muntin, h, 0.04]} />
            <meshStandardMaterial color={trimColor} />
          </mesh>
        );
      })}
      {Array.from({ length: hBars }, (_, i) => {
        const y = -h / 2 + (h / rows) * (i + 1);
        return (
          <mesh key={`h${i}`} position={[0, y, 0.05]}>
            <boxGeometry args={[w, muntin, 0.04]} />
            <meshStandardMaterial color={trimColor} />
          </mesh>
        );
      })}
      {/* sill */}
      <mesh position={[0, -h / 2 - fw - 0.04, 0.04]} castShadow>
        <boxGeometry args={[w + fw * 2 + 0.22, 0.09, 0.16]} />
        <meshStandardMaterial color={trimColor} roughness={0.6} />
      </mesh>
      {/* shutters */}
      {shutters && [-1, 1].map((s) => (
        <Shutter key={s} position={[s * (w / 2 + fw + 0.22), 0, 0.04]} h={h + 0.04} color={shutterColor} />
      ))}
    </group>
  );
}

/** A louvered shutter panel. */
export function Shutter({ position, h, color }: { position: [number, number, number]; h: number; color: string }) {
  const sw = 0.4;
  const slats = Math.max(4, Math.round(h / 0.16));
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[sw, h, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* louver slat shadow lines */}
      {Array.from({ length: slats }, (_, i) => {
        const y = -h / 2 + (h / slats) * (i + 0.5);
        return (
          <mesh key={i} position={[0, y, 0.026]}>
            <boxGeometry args={[sw - 0.05, 0.018, 0.005]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.22} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A black coach lantern mounted beside the front door. */
export function CoachLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.13, 0.26, 0.12]} />
        <meshStandardMaterial color="#191919" roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.085, 0.17, 0.02]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffd45a" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0, 0.16, 0.0]} castShadow>
        <boxGeometry args={[0.17, 0.05, 0.15]} />
        <meshStandardMaterial color="#191919" />
      </mesh>
    </group>
  );
}

/** A small gabled entry portico over the front door: two posts + gable roof. */
export function EntryPortico({
  x,
  z,
  doorH,
  width = 2.4,
  depth = 1.5,
  postColor = TRIM,
  roofColor = '#6a6258',
}: {
  x: number;
  z: number;
  doorH: number;
  width?: number;
  depth?: number;
  postColor?: string;
  roofColor?: string;
}) {
  const h = doorH + 0.5;
  return (
    <group position={[x, 0, z]}>
      {/* step */}
      <mesh position={[0, 0.08, -depth / 2]} receiveShadow castShadow>
        <boxGeometry args={[width + 0.5, 0.16, depth + 0.4]} />
        <meshStandardMaterial color="#c3bdb0" roughness={0.85} />
      </mesh>
      {/* posts */}
      {[-width / 2 + 0.15, width / 2 - 0.15].map((px) => (
        <mesh key={px} position={[px, h / 2 + 0.16, -depth + 0.15]} castShadow>
          <boxGeometry args={[0.16, h, 0.16]} />
          <meshStandardMaterial color={postColor} roughness={0.6} />
        </mesh>
      ))}
      {/* flat roof beam */}
      <mesh position={[0, h + 0.16, -depth / 2 + 0.05]} castShadow>
        <boxGeometry args={[width + 0.3, 0.16, depth + 0.1]} />
        <meshStandardMaterial color={postColor} roughness={0.6} />
      </mesh>
      {/* little gable roof on top */}
      <mesh position={[0, h + 0.4, -depth / 2 + 0.05]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.5, depth + 0.2]} />
        <meshStandardMaterial color={roofColor} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** A front-facing gable accent (siding-clad triangle) with a small vent. */
export function GableAccent({
  centerX,
  baseY,
  width,
  height,
  z,
  sidingColor,
}: {
  centerX: number;
  baseY: number;
  width: number;
  height: number;
  z: number;
  sidingColor: string;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(0, height);
    s.closePath();
    return s;
  }, [width, height]);
  return (
    <group position={[centerX, baseY, z]}>
      {/* siding-clad triangular gable face */}
      <mesh>
        <shapeGeometry args={[shape]} />
        <primitive object={mat.lapSiding(sidingColor)} attach="material" />
      </mesh>
      {/* louver gable vent */}
      <mesh position={[0, height * 0.45, 0.06]}>
        <boxGeometry args={[0.55, 0.36, 0.05]} />
        <meshStandardMaterial color="#3a3026" roughness={0.85} />
      </mesh>
    </group>
  );
}
