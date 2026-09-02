// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/BasketballHoop.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
interface HoopProps {
  position: [number, number, number];
  rotation?: number;
}

export function BasketballHoop({ position, rotation = 0 }: HoopProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* base — black plastic with sand */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.0, 0.4, 0.7]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {/* pole */}
      <mesh position={[0, 1.7, 0.05]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 3.0, 10]} />
        <meshStandardMaterial color="#aaa" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* backboard */}
      <mesh position={[0, 3.1, 0.4]} castShadow>
        <boxGeometry args={[1.4, 0.9, 0.06]} />
        <meshStandardMaterial color="#f5ecd9" />
      </mesh>
      {/* red square on backboard */}
      <mesh position={[0, 3.0, 0.435]}>
        <boxGeometry args={[0.6, 0.4, 0.01]} />
        <meshStandardMaterial color="#c8392a" />
      </mesh>
      {/* rim */}
      <mesh position={[0, 2.85, 0.65]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.025, 8, 16]} />
        <meshStandardMaterial color="#d8662a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* net (cone-ish) */}
      <mesh position={[0, 2.7, 0.65]}>
        <cylinderGeometry args={[0.22, 0.13, 0.3, 12, 1, true]} />
        <meshStandardMaterial color="#f5ecd9" wireframe />
      </mesh>
    </group>
  );
}
