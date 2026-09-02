// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/vegetation/CrepeMyrtle.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (a2, fix round 1): the wind/breeze useFrame is
// removed. Its "gentle everyday breeze" branch (state.clock.elapsedTime-driven
// trunk sway) ran UNCONDITIONALLY whenever a myrtle was within 60m of the
// sandbox's FIXED player spawn (this sandbox has no player controller, so
// that point never moves, and no tornado is ever triggered here either —
// windStrength/tornadoOpacity stay at their zero defaults for the sandbox's
// whole lifetime, per tornadoStore.ts, so the wind-lean branch was always
// dead code, but the breeze branch was live and continuous). Confirmed live
// both by code reading and by an in-browser byte-diff at fixed scrollY
// (p=0.85) that showed every visible crepe myrtle's canopy silhouette
// shifting between two screenshots taken seconds apart with no scroll
// change. Breaks "every frame is a pure function of scrollY" (byte-exact
// scrub-reversibility is verified for the crossing). Same rationale as
// Atmosphere.tsx's clouds/motes removal. Renders static, at rest.
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface CrepeMyrtleProps {
  position: [number, number, number];
  scale?: number;
  /** Retained for API compatibility; the GLB ships its own pink blooms. */
  bloomColor?: string;
  seed?: number;
}

/**
 * Crepe myrtle (real GLB model) wrapped in `trunkGroup` so the existing breeze /
 * storm-wind sway still bends it. Per-seed spin keeps instances from matching.
 */
export function CrepeMyrtle({ position, scale = 1, seed = 0 }: CrepeMyrtleProps) {
  const trunkGroup = useRef<Group>(null);

  const { spin, jitter } = useMemo(() => {
    const rng = mulberry32(seed * 31 + 7);
    return { spin: rng() * Math.PI * 2, jitter: 0.88 + rng() * 0.24 };
  }, [seed]);

  return (
    <group position={position} scale={scale * jitter}>
      <group ref={trunkGroup}>
        <GLBModel url={MODELS.crepemyrtle.url} fitHeight={MODELS.crepemyrtle.fitHeight} rotationY={spin} />
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
