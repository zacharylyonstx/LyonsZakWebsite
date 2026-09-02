// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/GardenBed.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
interface BedProps {
  position: [number, number, number];
  rotation?: number;
  width?: number;
  depth?: number;
}

export function GardenBed({ position, rotation = 0, width = 3.0, depth = 0.7 }: BedProps) {
  // mulch bed with little flower clusters
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* mulch */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.95} />
      </mesh>
      {/* edging */}
      <mesh position={[0, 0.13, depth / 2 - 0.04]} receiveShadow>
        <boxGeometry args={[width, 0.16, 0.08]} />
        <meshStandardMaterial color="#7a4a30" />
      </mesh>
      <mesh position={[0, 0.13, -depth / 2 + 0.04]} receiveShadow>
        <boxGeometry args={[width, 0.16, 0.08]} />
        <meshStandardMaterial color="#7a4a30" />
      </mesh>
      {/* flower clusters */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = -width / 2 + (width / 6) * (i + 0.5);
        const colors = ['#c8392a', '#e6b94a', '#9a3aa6', '#3a8a4a', '#c8392a', '#e6b94a'];
        return (
          <group key={i} position={[x, 0.16, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshStandardMaterial color="#3a7a3a" />
            </mesh>
            <mesh position={[0, 0.12, 0]} castShadow>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color={colors[i]} emissive={colors[i]} emissiveIntensity={0.15} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
