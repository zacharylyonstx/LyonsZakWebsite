// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Roof.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mat } from '../world/materials';

interface RoofProps {
  width: number;
  depth: number;
  height: number;
  color: string;
  overhang?: number;
  /** Hipped roof: pyramid sloping inward from all four sides instead of pure gable. */
  hipped?: boolean;
}

/** A gable or hipped roof. The "front" of the house faces -Z locally. */
export function Roof({ width, depth, height, color, overhang = 0.45, hipped = false }: RoofProps) {
  if (hipped) return <HippedRoof width={width} depth={depth} height={height} color={color} overhang={overhang} />;
  return <GableRoof width={width} depth={depth} height={height} color={color} overhang={overhang} />;
}

function GableRoof({ width, depth, height, color, overhang }: Required<Omit<RoofProps, 'hipped'>>) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const half = depth / 2 + overhang;
    s.moveTo(-half, 0);
    s.lineTo(half, 0);
    s.lineTo(0, height);
    s.closePath();
    return s;
  }, [depth, height, overhang]);

  const extrudeWidth = width + overhang * 2;

  return (
    <mesh
      castShadow
      receiveShadow
      rotation={[0, Math.PI / 2, 0]}
      position={[-extrudeWidth / 2, 0, 0]}
    >
      <extrudeGeometry args={[shape, { depth: extrudeWidth, bevelEnabled: false, steps: 1 }]} />
      <primitive object={mat.shingles(color)} attach="material" />
    </mesh>
  );
}

function HippedRoof({ width, depth, height, color, overhang }: Required<Omit<RoofProps, 'hipped'>>) {
  const geom = useMemo(() => {
    const w = width / 2 + overhang;
    const d = depth / 2 + overhang;
    const h = height;
    // Base rectangle (4 corners), apex ridge along width axis.
    // Ridge length = the longer axis minus 2x the shorter axis half-pitch.
    // For our houses width >= depth, so ridge runs along X.
    const ridgeHalf = Math.max(0, w - d);
    // Winding is CCW-from-outside so every face normal points outward/up.
    // (The original array was wound inward, so the front/back slopes
    // backface-culled when viewed from above — you could see straight into
    // the house. Each triangle below has its 2nd/3rd vertices swapped to flip
    // the normal outward.)
    const verts = new Float32Array([
      // Front slope (normal -Z / +Y)
      -w, 0, -d,   ridgeHalf, h, 0,   w, 0, -d,
      -w, 0, -d,  -ridgeHalf, h, 0,  ridgeHalf, h, 0,
      // Back slope (normal +Z / +Y)
      w, 0, d,   -ridgeHalf, h, 0,   -w, 0, d,
      w, 0, d,    ridgeHalf, h, 0,   -ridgeHalf, h, 0,
      // Left hip (normal -X / +Y)
      -w, 0, -d,  -w, 0, d,  -ridgeHalf, h, 0,
      // Right hip (normal +X / +Y)
      w, 0, -d,    ridgeHalf, h, 0,    w, 0, d,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    // Generate planar UVs based on XZ extent for shingle texture wrapping
    const uv = new Float32Array(verts.length / 3 * 2);
    for (let i = 0; i < verts.length / 3; i++) {
      uv[i * 2] = (verts[i * 3] + w) / (2 * w);
      uv[i * 2 + 1] = (verts[i * 3 + 2] + d) / (2 * d);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }, [width, depth, height, overhang]);

  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <primitive object={mat.shingles(color)} attach="material" />
    </mesh>
  );
}
