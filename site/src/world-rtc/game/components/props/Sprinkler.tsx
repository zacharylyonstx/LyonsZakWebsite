// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/props/Sprinkler.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (a2, fix round 1): the per-frame useFrame that
// re-simulated the water-particle fan from state.clock.elapsedTime (gated
// only by isNearPlayer(…,40) against the sandbox's FIXED player spawn — this
// sandbox has no player controller, so that point never moves) is removed.
// It was a continuous wall-clock animation, breaking "every frame is a pure
// function of scrollY" (byte-exact scrub-reversibility is verified for the
// crossing). Same rationale as Atmosphere.tsx's clouds/motes removal. The
// exact same per-particle math now runs ONCE at t=0 (each particle keeps its
// own random t0 offset, so the frozen frame still reads as a spray fanned
// across its arc, just motionless — a photo of a sprinkler, not a video).
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Points } from 'three';

interface SprinklerProps {
  position: [number, number, number];
}

/**
 * A pop-up sprinkler with a procedurally animated water fan. The water is
 * a Points cloud where each particle has its own t-offset and respawns when
 * it hits the ground.
 */
export function Sprinkler({ position }: SprinklerProps) {
  const N = 80;
  const pointsRef = useRef<Points>(null);

  // Per-particle initial state
  const init = useMemo(() => {
    const arr: { t0: number; ang: number; speed: number; radius: number }[] = [];
    for (let i = 0; i < N; i++) {
      arr.push({
        t0: Math.random() * 2,
        ang: (i / N) * Math.PI * 2,
        speed: 4 + Math.random() * 1.6,
        radius: 0.05 + Math.random() * 0.05,
      });
    }
    return arr;
  }, []);

  // CROSSING MODIFICATION: computed once at a frozen t=0 (see file header),
  // not per-frame from wall-clock time.
  const positionsArr = useMemo(() => {
    const arr = new Float32Array(N * 3);
    const t = 0;
    for (let i = 0; i < N; i++) {
      const p = init[i];
      const localT = (t + p.t0) % 1.4;
      const v = p.speed;
      const angle = p.ang + t * 0.4; // sweep
      const vx = Math.cos(angle) * v * 0.7;
      const vz = Math.sin(angle) * v * 0.7;
      const vy = v * 0.7;
      const x = vx * localT;
      const y = vy * localT - 0.5 * 9.81 * localT * localT;
      const z = vz * localT;
      arr[i * 3] = x;
      arr[i * 3 + 1] = Math.max(y, 0);
      arr[i * 3 + 2] = z;
    }
    return arr;
  }, [init]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positionsArr, 3));
    return g;
  }, [positionsArr]);

  return (
    <group position={position}>
      {/* sprinkler head */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#3a3a3c" />
      </mesh>
      <points ref={pointsRef} geometry={geom}>
        <pointsMaterial color="#aedfff" size={0.06} sizeAttenuation transparent opacity={0.85} />
      </points>
    </group>
  );
}
