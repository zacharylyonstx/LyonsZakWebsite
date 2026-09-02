// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/vegetation/LiveOak.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { isNearPlayer } from '../../systems/distance';
import { useTornadoStore } from '../../state/tornadoStore';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface LiveOakProps {
  position: [number, number, number];
  scale?: number;
  /** Seed for procedural variance (so trees aren't identical clones). */
  seed?: number;
}

/**
 * A big Texas live oak (real GLB model). The model is wrapped in `trunkGroup` so
 * the existing storm-wind lean still bends the whole tree from its base. Per-seed
 * spin + size jitter keep the ~39 instances from reading as identical clones.
 */
export function LiveOak({ position, scale = 1, seed = 0 }: LiveOakProps) {
  const trunkGroup = useRef<Group>(null);

  const { spin, jitter } = useMemo(() => {
    const rng = mulberry32(seed * 9301 + 1);
    return { spin: rng() * Math.PI * 2, jitter: 0.85 + rng() * 0.3 };
  }, [seed]);

  useFrame((state) => {
    if (!isNearPlayer(position[0], position[2], 60)) return;
    const t = state.clock.elapsedTime;

    // Storm wind bend — entire tree leans AWAY from the tornado.
    const trunk = trunkGroup.current;
    if (trunk) {
      const ts = useTornadoStore.getState();
      const windStrength = ts.windStrength;
      if (windStrength > 0.05 && ts.tornadoOpacity > 0.05) {
        const awayX = position[0] - ts.tornadoX;
        const awayZ = position[2] - ts.tornadoZ;
        const dist = Math.hypot(awayX, awayZ);
        if (dist > 0.1) {
          const falloff = 1 / Math.max(1, dist / 15);
          const gust = 0.85 + Math.sin(t * 2.4 + position[0] * 0.1) * 0.25;
          const amp = windStrength * falloff * 0.4 * gust;
          trunk.rotation.x = (awayZ / dist) * amp * -1;
          trunk.rotation.z = (awayX / dist) * amp;
        } else {
          trunk.rotation.x = 0;
          trunk.rotation.z = 0;
        }
      } else if (trunk.rotation.x !== 0 || trunk.rotation.z !== 0) {
        trunk.rotation.x *= 0.9;
        trunk.rotation.z *= 0.9;
      }
    }
  });

  return (
    <group position={position} scale={scale * jitter}>
      <group ref={trunkGroup}>
        <GLBModel url={MODELS.oak.url} fitHeight={MODELS.oak.fitHeight} rotationY={spin} />
      </group>
    </group>
  );
}

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
