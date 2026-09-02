// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Fence.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useMemo } from 'react';
import { mat } from '../world/materials';

interface FenceProps {
  start: [number, number]; // XZ
  end: [number, number];
  height?: number;
}

/**
 * A privacy fence section between two world XZ points. Single planked panel
 * with a horizontal cap rail. Uses the shared wood-plank material.
 */
export function Fence({ start, end, height = 1.7 }: FenceProps) {
  const { length, midX, midZ, angle } = useMemo(() => {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    return {
      length: Math.hypot(dx, dz),
      midX: (start[0] + end[0]) / 2,
      midZ: (start[1] + end[1]) / 2,
      angle: Math.atan2(dz, dx),
    };
  }, [start, end]);

  if (length < 0.01) return null;

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, height, 0.12]} />
        <primitive object={mat.fenceWood()} attach="material" />
      </mesh>
      <mesh position={[0, height + 0.04, 0]} castShadow>
        <boxGeometry args={[length + 0.05, 0.08, 0.18]} />
        <meshStandardMaterial color="#7a5e3f" roughness={0.85} />
      </mesh>
    </group>
  );
}
