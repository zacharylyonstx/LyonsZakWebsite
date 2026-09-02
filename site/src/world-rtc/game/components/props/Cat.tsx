// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/props/Cat.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (a2, fix round 1): the wake/breathe/tail-wag useFrame
// is removed. It read wall-clock time (state.clock.elapsedTime, tail wag +
// breathing) AND accumulated a per-frame exponential head-position lerp
// (frame-count-dependent, not scroll-dependent either) — gated only by
// isNearPlayer(…,40) against the sandbox's FIXED player spawn (this sandbox
// has no player controller, so "awake" would in fact be a constant for the
// whole crossing — but the tail/breathing motion is genuinely continuous and
// wall-clock-driven). This cat is only placed at the hero house (10600),
// right where the crossing happens. Breaks "every frame is a pure function
// of scrollY" (byte-exact scrub-reversibility is verified for the crossing).
// Same rationale as Atmosphere.tsx's clouds/motes removal. Renders static,
// asleep, at its authored pose.
import { useRef } from 'react';
import type { Group } from 'three';

interface CatProps {
  position: [number, number, number];
  rotation?: number;
  furColor?: string;
}

/** A sleeping orange tabby that wakes (head up, tail flicks) when player approaches. */
export function Cat({ position, rotation = 0, furColor = '#d68a3a' }: CatProps) {
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const body = useRef<Group>(null);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* body */}
      <group ref={body}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.5, 0.22, 0.85]} />
          <meshStandardMaterial color={furColor} roughness={0.95} />
        </mesh>
        {/* leg humps (visible while curled) */}
        {[
          [-0.18, 0.08, -0.3],
          [0.18, 0.08, -0.3],
          [-0.18, 0.08, 0.3],
          [0.18, 0.08, 0.3],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={furColor} roughness={0.95} />
          </mesh>
        ))}
      </group>
      {/* head */}
      <group ref={head} position={[0, 0, -0.45]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color={furColor} roughness={0.95} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.1, 0.13, 0.02]} rotation={[0, 0, -0.3]} castShadow>
          <coneGeometry args={[0.06, 0.12, 6]} />
          <meshStandardMaterial color={furColor} />
        </mesh>
        <mesh position={[0.1, 0.13, 0.02]} rotation={[0, 0, 0.3]} castShadow>
          <coneGeometry args={[0.06, 0.12, 6]} />
          <meshStandardMaterial color={furColor} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.06, 0.02, -0.13]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1a8a3a" emissive="#3a8a3a" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.06, 0.02, -0.13]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#1a8a3a" emissive="#3a8a3a" emissiveIntensity={0.3} />
        </mesh>
        {/* nose */}
        <mesh position={[0, -0.04, -0.155]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <meshStandardMaterial color="#3a1818" />
        </mesh>
      </group>
      {/* tail */}
      <group ref={tail} position={[0, 0.2, 0.4]}>
        <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 6, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.5, 6]} />
          <meshStandardMaterial color={furColor} />
        </mesh>
      </group>
    </group>
  );
}
