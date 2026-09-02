// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/hero/Trampoline.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import * as THREE from 'three';

/** Height of the jump mat above local ground. Shared with the floor/bounce logic. */
export const TRAMPOLINE_PAD_Y = 0.55;
/** Half-side of the (square) bouncy floor inscribed in the round mat. */
export const trampolinePadHalf = (radius: number) => (radius - 0.35) * 0.72;

/**
 * Backyard trampoline: green padded rim, black jump mat, blue safety-net poles +
 * a see-through net, and a little ladder. The jump MAT is registered as a bouncy
 * floor (see HeroHouse10600.buildHeroFloors + PlayerController) so standing on it
 * and pressing jump sends you higher and higher.
 *
 * `position` is house-local; `radius` is the outer (rim) radius.
 */
export function Trampoline({ position, radius = 3 }: { position: [number, number, number]; radius?: number }) {
  const padY = TRAMPOLINE_PAD_Y;
  const matR = radius - 0.35;
  const netH = 2.3;
  const poleCount = 6;
  const legCount = 6;
  return (
    <group position={position}>
      {/* Splayed legs */}
      {Array.from({ length: legCount }, (_, i) => {
        const a = (i / legCount) * Math.PI * 2 + 0.3;
        const r = radius - 0.5;
        return (
          <mesh key={`leg${i}`} position={[Math.cos(a) * r, padY / 2, Math.sin(a) * r]} rotation={[0, -a, 0.18]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, padY + 0.08, 8]} />
            <meshStandardMaterial color="#9aa0a6" metalness={0.5} roughness={0.4} />
          </mesh>
        );
      })}
      {/* Green padded spring rim */}
      <mesh position={[0, padY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[radius - 0.18, 0.2, 12, 30]} />
        <meshStandardMaterial color="#7cc24a" roughness={0.85} />
      </mesh>
      {/* Black jump mat (the bouncy surface) */}
      <mesh position={[0, padY + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[matR, 36]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.95} />
      </mesh>
      {/* Net poles */}
      {Array.from({ length: poleCount }, (_, i) => {
        const a = (i / poleCount) * Math.PI * 2;
        const r = radius - 0.12;
        return (
          <group key={`pole${i}`} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh position={[0, padY + netH / 2, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, netH, 8]} />
              <meshStandardMaterial color="#3a6db0" metalness={0.3} roughness={0.5} />
            </mesh>
            {/* foam cap */}
            <mesh position={[0, padY + netH - 0.05, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#2a4f82" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
      {/* See-through safety net (open cylinder) */}
      <mesh position={[0, padY + netH / 2, 0]}>
        <cylinderGeometry args={[radius - 0.12, radius - 0.12, netH, 28, 1, true]} />
        <meshStandardMaterial color="#101012" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Ladder on the front (-Z) side */}
      <group position={[0.4, 0, -(radius - 0.1)]}>
        {[0.18, 0.42].map((y, i) => (
          <mesh key={`lr${i}`} position={[0, y, 0]} castShadow>
            <boxGeometry args={[0.5, 0.04, 0.04]} />
            <meshStandardMaterial color="#b8bcc0" metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
        {[-0.25, 0.25].map((x, i) => (
          <mesh key={`lp${i}`} position={[x, 0.3, 0]} castShadow>
            <boxGeometry args={[0.04, 0.62, 0.04]} />
            <meshStandardMaterial color="#b8bcc0" metalness={0.4} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
