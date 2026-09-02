// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/vegetation/Wildflowers.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { isTouchDevice } from '../../systems/touchInput';

// Texas wildflowers — bluebonnets (mostly) with a few Indian paintbrush — a
// little Austin authenticity scattered along the greenbelt. Fully static and
// instanced (2 draw calls per patch, zero per-frame cost). Stems + blossoms
// are separate InstancedMeshes; blossom color is per-instance.

const BLUEBONNET = ['#43569e', '#5566c4', '#7080d6'];
const PAINTBRUSH = ['#d4502a', '#e2683a'];
const TOUCH = isTouchDevice();

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
const STEM_BASE_H = 0.4;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Patch({ center, radius, count, seed }: { center: [number, number]; radius: number; count: number; seed: number }) {
  const n = TOUCH ? Math.round(count * 0.5) : count;
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const bloomRef = useRef<THREE.InstancedMesh>(null);

  const flowers = useMemo(() => {
    const rng = mulberry32(seed * 7919 + 1);
    const arr: { x: number; z: number; h: number; color: string; lean: number; yaw: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const x = center[0] + Math.cos(a) * r;
      const z = center[1] + Math.sin(a) * r;
      const h = 0.3 + rng() * 0.3;
      const palette = rng() < 0.8 ? BLUEBONNET : PAINTBRUSH;
      arr.push({
        x, z, h,
        color: palette[Math.floor(rng() * palette.length)],
        lean: (rng() - 0.5) * 0.3,
        yaw: rng() * Math.PI * 2,
      });
    }
    return arr;
  }, [n, radius, seed, center]);

  useLayoutEffect(() => {
    const stem = stemRef.current;
    const bloom = bloomRef.current;
    if (!stem || !bloom) return;
    flowers.forEach((f, i) => {
      dummy.position.set(f.x, f.h / 2, f.z);
      dummy.rotation.set(f.lean, f.yaw, f.lean * 0.5);
      dummy.scale.set(1, f.h / STEM_BASE_H, 1);
      dummy.updateMatrix();
      stem.setMatrixAt(i, dummy.matrix);

      dummy.position.set(f.x + Math.sin(f.lean) * f.h * 0.4, f.h, f.z);
      dummy.rotation.set(0, f.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bloom.setMatrixAt(i, dummy.matrix);
      bloom.setColorAt(i, tmpColor.set(f.color));
    });
    stem.instanceMatrix.needsUpdate = true;
    bloom.instanceMatrix.needsUpdate = true;
    if (bloom.instanceColor) bloom.instanceColor.needsUpdate = true;
  }, [flowers]);

  return (
    <group>
      <instancedMesh ref={stemRef} args={[undefined, undefined, n]} castShadow>
        <cylinderGeometry args={[0.012, 0.02, STEM_BASE_H, 4]} />
        <meshStandardMaterial color="#4a7a3e" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bloomRef} args={[undefined, undefined, n]} castShadow>
        <coneGeometry args={[0.06, 0.24, 6]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}

// Curated grass patches: along the greenbelt tree line that frames the street
// (these spots are known grass). Hidden in munchies (night interior).
const PATCHES: { center: [number, number]; radius: number; count: number; seed: number }[] = [
  { center: [-39, -38], radius: 4.5, count: 46, seed: 3 },
  { center: [39, -38], radius: 4.5, count: 46, seed: 8 },
  { center: [-41, -74], radius: 5, count: 52, seed: 15 },
  { center: [41, -74], radius: 5, count: 52, seed: 21 },
  { center: [-41, -110], radius: 5, count: 50, seed: 26 },
  { center: [41, -110], radius: 5, count: 50, seed: 33 },
  // Continue the greenbelt ladder along the tree line — NOT on the road. (The
  // old [0,-158] patch sat dead-center on the driving lane.)
  { center: [-41, -146], radius: 5, count: 52, seed: 40 },
  { center: [41, -146], radius: 5, count: 52, seed: 41 },
];

export function NeighborhoodWildflowers() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode === 'munchies') return null;
  return (
    <>
      {PATCHES.map((p, i) => (
        <Patch key={i} center={p.center} radius={p.radius} count={p.count} seed={p.seed} />
      ))}
    </>
  );
}
