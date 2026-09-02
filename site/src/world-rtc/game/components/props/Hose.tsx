// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/Hose.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
interface HoseProps {
  position: [number, number, number];
  rotation?: number;
}

export function Hose({ position, rotation = 0 }: HoseProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* mounted reel housing */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.4]} />
        <meshStandardMaterial color="#3a5a3e" />
      </mesh>
      {/* reel disc */}
      <mesh position={[0, 0.5, 0.21]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
        <meshStandardMaterial color="#2a2a2c" />
      </mesh>
      {/* spigot */}
      <mesh position={[0.32, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.18, 6]} />
        <meshStandardMaterial color="#a08a4a" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}
