// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/vegetation/Hedge.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
interface HedgeProps {
  position: [number, number, number];
  rotation?: number;
  length?: number;
}

export function Hedge({ position, rotation = 0, length = 3 }: HedgeProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.8, 0.6]} />
        <meshStandardMaterial color="#3a6e30" roughness={0.95} flatShading />
      </mesh>
      {/* bumpy top */}
      {(() => {
        const n = Math.max(2, Math.round(length / 0.6));
        return Array.from({ length: n }, (_, i) => {
          const x = -length / 2 + (length / n) * (i + 0.5);
          return (
          <mesh key={i} position={[x, 0.85, 0]} castShadow>
              <icosahedronGeometry args={[0.34, 0]} />
              <meshStandardMaterial color="#3a7a32" roughness={0.95} flatShading />
            </mesh>
          );
        });
      })()}
    </group>
  );
}
