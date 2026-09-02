// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/DistantScenery.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../state/gameStore';
import { isTouchDevice } from '../systems/touchInput';

// A ring of distant, hazy trees around the neighborhood so the now-drivable
// open edges (greenbelt, boulevard) have a believable backdrop instead of
// fading into empty grass. Fully static + instanced (2 draw calls), placed well
// beyond the drivable region and inside the fog far-plane so it reads as depth.

const COUNT = isTouchDevice() ? 90 : 150;
const CX = 0;
const CZ = -67; // rough center of the neighborhood (bulb at +z, blvd at -185)

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

export function DistantScenery() {
  const gameMode = useGameStore((s) => s.gameMode);
  const foliage = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);

  const data = useMemo(() => {
    const rng = mulberry32(7);
    const arr: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      // Two staggered rings of small trees so the line reads as a continuous,
      // hazy treeline on the horizon — never a single big blob looming close.
      const a = (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.05;
      const rad = (i % 2 === 0 ? 210 : 234) + rng() * 26;
      arr.push({
        x: CX + Math.cos(a) * rad,
        z: CZ + Math.sin(a) * rad * 0.92, // gentle ellipse to hug the long stick
        s: 2.4 + rng() * 1.9,
      });
    }
    return arr;
  }, []);

  useLayoutEffect(() => {
    const f = foliage.current;
    const tk = trunks.current;
    if (!f || !tk) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    data.forEach((d, i) => {
      p.set(d.x, d.s * 1.5, d.z);
      sc.set(d.s, d.s * 1.25, d.s);
      m.compose(p, q, sc);
      f.setMatrixAt(i, m);
      p.set(d.x, d.s * 0.6, d.z);
      sc.set(d.s * 0.16, d.s * 1.2, d.s * 0.16);
      m.compose(p, q, sc);
      tk.setMatrixAt(i, m);
    });
    f.instanceMatrix.needsUpdate = true;
    tk.instanceMatrix.needsUpdate = true;
  }, [data]);

  if (gameMode === 'munchies') return null; // night interior mode
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1.2, 1, 5]} />
        <meshStandardMaterial color="#46362a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={foliage} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#4c6b4e" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
