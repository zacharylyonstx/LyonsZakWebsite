// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Street.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import {
  STREET_RADIUS,
  SIDEWALK_WIDTH,
  STRAIGHT_START_Z,
  STRAIGHT_END_Z,
  STRAIGHT_HALF_ROAD,
} from '../world/streetLayout';
import { mat } from '../world/materials';
import { Text } from '@react-three/drei';

export function Street() {
  const straightLen = Math.abs(STRAIGHT_END_Z - STRAIGHT_START_Z);
  const straightCenterZ = (STRAIGHT_START_Z + STRAIGHT_END_Z) / 2;
  const sidewalkOuter = STRAIGHT_HALF_ROAD + SIDEWALK_WIDTH;
  const sidewalkCenter = STRAIGHT_HALF_ROAD + SIDEWALK_WIDTH / 2;

  const avenueZ = STRAIGHT_END_Z - 4;
  const avenueWidth = 12;

  return (
    <group>
      {/* Cul-de-sac bulb pavement */}
      <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[STREET_RADIUS, 64]} />
        <primitive object={mat.asphalt()} attach="material" />
      </mesh>

      {/* Sidewalk ring around the bulb */}
      <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[STREET_RADIUS, STREET_RADIUS + SIDEWALK_WIDTH, 64]} />
        <primitive object={mat.sidewalk()} attach="material" />
      </mesh>

      {/* Straight road section */}
      <mesh position={[0, 0.018, straightCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[STRAIGHT_HALF_ROAD * 2, straightLen]} />
        <primitive object={mat.asphalt()} attach="material" />
      </mesh>

      {/* Sidewalks flanking the straight section */}
      <mesh position={[-sidewalkCenter, 0.022, straightCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIDEWALK_WIDTH, straightLen]} />
        <primitive object={mat.sidewalk()} attach="material" />
      </mesh>
      <mesh position={[sidewalkCenter, 0.022, straightCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIDEWALK_WIDTH, straightLen]} />
        <primitive object={mat.sidewalk()} attach="material" />
      </mesh>

      {/* Yellow center stripe (broken into segments for realism) */}
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i + 0.5) / 12;
        const z = STRAIGHT_START_Z + (STRAIGHT_END_Z - STRAIGHT_START_Z) * t;
        return (
          <mesh key={i} position={[0, 0.020, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.18, 2.5]} />
            <meshStandardMaterial color="#f0d040" emissive="#f0d040" emissiveIntensity={0.05} />
          </mesh>
        );
      })}

      {/* Curb returns where straight section meets the bulb */}
      <mesh position={[0, 0.018, STRAIGHT_START_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[sidewalkOuter * 2, 0.5]} />
        <primitive object={mat.asphalt()} attach="material" />
      </mesh>

      {/* Avery Ranch Blvd stub */}
      <mesh position={[0, 0.016, avenueZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, avenueWidth]} />
        <primitive object={mat.asphalt()} attach="material" />
      </mesh>
      <mesh position={[0, 0.020, avenueZ + avenueWidth / 2 + SIDEWALK_WIDTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, SIDEWALK_WIDTH]} />
        <primitive object={mat.sidewalk()} attach="material" />
      </mesh>
      <mesh position={[0, 0.020, avenueZ - avenueWidth / 2 - SIDEWALK_WIDTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, SIDEWALK_WIDTH]} />
        <primitive object={mat.sidewalk()} attach="material" />
      </mesh>
      {/* Avery Ranch yellow double-line */}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={`av${i}`} position={[-65 + i * 8.5, 0.019, avenueZ - 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 0.18]} />
          <meshStandardMaterial color="#f0d040" />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={`av${i}b`} position={[-65 + i * 8.5, 0.019, avenueZ + 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 0.18]} />
          <meshStandardMaterial color="#f0d040" />
        </mesh>
      ))}

      {/* "Royal Tara Cv" street sign at the entry corner */}
      <group position={[7, 0, STRAIGHT_END_Z + 1]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 2.8, 6]} />
          <meshStandardMaterial color="#2c2c2c" />
        </mesh>
        <mesh position={[0, 2.7, 0]} castShadow>
          <boxGeometry args={[2.8, 0.5, 0.06]} />
          <meshStandardMaterial color="#2a5d8f" />
        </mesh>
        <Text position={[0, 2.7, 0.04]} fontSize={0.3} color="#f5ecd9" anchorX="center" anchorY="middle">
          ROYAL TARA CV
        </Text>
        {/* readable from the other side too */}
        <Text position={[0, 2.7, -0.04]} rotation={[0, Math.PI, 0]} fontSize={0.3} color="#f5ecd9" anchorX="center" anchorY="middle">
          ROYAL TARA CV
        </Text>
      </group>

      {/* Stop sign near the entry */}
      <group position={[5, 0, STRAIGHT_END_Z - 1]}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.0, 6]} />
          <meshStandardMaterial color="#2c2c2c" />
        </mesh>
        {/* octagon stood UPRIGHT to face the road (was lying flat) */}
        <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, Math.PI / 8, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 8]} />
          <meshStandardMaterial color="#c8392a" />
        </mesh>
        <Text position={[0, 2.1, 0.04]} fontSize={0.18} color="#f5ecd9" anchorX="center" anchorY="middle">
          STOP
        </Text>
        <Text position={[0, 2.1, -0.04]} rotation={[0, Math.PI, 0]} fontSize={0.18} color="#f5ecd9" anchorX="center" anchorY="middle">
          STOP
        </Text>
      </group>
    </group>
  );
}
