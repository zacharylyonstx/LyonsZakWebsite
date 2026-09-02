// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Gate.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
interface GateProps {
  position: [number, number, number];
  rotation?: number;
  width?: number;
  height?: number;
  open?: boolean;
  color?: string;
}

// A garden gate. When `open`, the panel swings inward 90° on its left hinge.
export function Gate({
  position,
  rotation = 0,
  width = 1.6,
  height = 1.7,
  open = false,
  color = '#a08560',
}: GateProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* hinge / latch posts (slightly taller than the panel) */}
      <mesh position={[-width / 2, (height + 0.2) / 2, 0]} castShadow>
        <boxGeometry args={[0.12, height + 0.2, 0.12]} />
        <meshStandardMaterial color="#6f543a" />
      </mesh>
      <mesh position={[width / 2, (height + 0.2) / 2, 0]} castShadow>
        <boxGeometry args={[0.12, height + 0.2, 0.12]} />
        <meshStandardMaterial color="#6f543a" />
      </mesh>
      {/* panel — pivots from the left post */}
      <group
        position={[-width / 2 + 0.06, height / 2, 0]}
        rotation={[0, open ? -Math.PI / 2 : 0, 0]}
      >
        <mesh position={[width / 2 - 0.06, 0, 0]} castShadow>
          <boxGeometry args={[width - 0.18, height - 0.1, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
}
