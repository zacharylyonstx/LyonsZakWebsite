// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/HouseInterior.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (G1.1 Task 3, cinematicWorld.ts GAMEPLAY_ONLY_CUTS):
// neighbor interiors are a gameplay import the cinematic can never show —
// every door/garage/window is closed opaque geometry and there is no player
// to walk inside; the isNearPlayer(24 m) gate here is measured against a
// FIXED spawn in this sandbox, leaving 24/25 interiors visible=false forever
// and one (10604) drawn-but-fully-occluded every frame. When the cinematic
// kill flag is on (ship default), the component renders nothing and its five
// furniture GLBs are never cloned. `?opt=` without `kill` restores the
// original behavior for A/B measurement.
import { cinematicOpts } from '../../cinematicWorld';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { isNearPlayer } from '../systems/distance';
import { mat } from '../world/materials';
import { GLBModel } from './GLBModel';
import { MODELS } from '../world/models';

// Top of the inset wood floor (y 0.13 center, 0.06 thick) — furniture sits here.
const FLOOR_Y = 0.16;
const SOFA_COLORS = ['#5f7184', '#8a6a58', '#6f8466', '#86708f', '#9a8a64', '#558486'];
const RUG_COLORS = ['#9c4a4a', '#46689c', '#9c8a46', '#468c6a', '#7a4a8c', '#b06a3a'];
const WALLART = ['#c2603a', '#3a6ec2', '#3aa06a', '#c2a03a'];

/**
 * A simple, cozy living room for a neighbor house — floor + a few furniture
 * pieces (sofa, rug, coffee table, TV, lamp). Rendered in house-LOCAL space
 * (placed inside the house group) and only when the player is nearby, so 24
 * of these stay cheap. Colours vary by seed.
 */
interface HouseInteriorProps {
  width: number;
  depth: number;
  worldX: number;
  worldZ: number;
  seed: number;
}

// CROSSING MODIFICATION (see header): gameplay-only in the cinematic.
export function HouseInterior(props: HouseInteriorProps) {
  if (cinematicOpts.kill) return null;
  return <HouseInteriorInner {...props} />;
}

function HouseInteriorInner({
  width,
  depth,
  worldX,
  worldZ,
  seed,
}: HouseInteriorProps) {
  const ref = useRef<Group>(null);
  const halfW = width / 2;
  const halfD = depth / 2;
  const sofa = SOFA_COLORS[seed % SOFA_COLORS.length];
  const rug = RUG_COLORS[(seed >> 2) % RUG_COLORS.length];
  const art = WALLART[(seed >> 1) % WALLART.length];

  // Render only when the player is close (perf — there are 24 of these).
  useFrame(() => {
    const g = ref.current;
    if (g) g.visible = isNearPlayer(worldX, worldZ, 24);
  });

  // Sofa sits against the back wall facing the front (-Z); TV on the front wall.
  const sofaZ = halfD - 0.85;
  const tvZ = -halfD + 0.4;

  return (
    <group ref={ref} visible={false}>
      {/* Floor (wood) inset from the walls — above the foundation slab (y≈0.1) */}
      <mesh position={[0, 0.13, 0]} receiveShadow>
        <boxGeometry args={[width - 0.5, 0.06, depth - 0.5]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>

      {/* Rug */}
      <mesh position={[0, 0.085, halfD - 2.4]}>
        <boxGeometry args={[2.8, 0.02, 2.2]} />
        <meshStandardMaterial color={rug} roughness={0.95} />
      </mesh>

      {/* Sofa (GLB) against the back wall, facing the front (-Z); tinted per house. */}
      <GLBModel
        url={MODELS.sofa.url}
        fitHeight={MODELS.sofa.fitHeight}
        rotationY={Math.PI}
        position={[0, FLOOR_Y, sofaZ]}
        tint={sofa}
      />

      {/* Coffee table (GLB) */}
      <GLBModel
        url={MODELS.coffeetable.url}
        fitHeight={MODELS.coffeetable.fitHeight}
        position={[0, FLOOR_Y, halfD - 2.5]}
      />

      {/* TV + console (GLB) against the front wall, facing the sofa (+Z). */}
      <group position={[0, FLOOR_Y, tvZ]}>
        <GLBModel url={MODELS.tv.url} fitHeight={MODELS.tv.fitHeight} />
        {/* keep the warm screen glow the box TV had */}
        <mesh position={[0, 1.0, 0.16]}>
          <planeGeometry args={[1.25, 0.7]} />
          <meshStandardMaterial color="#26323e" emissive="#1a2630" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Floor lamp (GLB) in a back corner + a warm emissive bulb for the glow. */}
      <group position={[-halfW + 0.7, FLOOR_Y, halfD - 0.7]}>
        <GLBModel url={MODELS.floorlamp.url} fitHeight={MODELS.floorlamp.fitHeight} />
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.11, 8, 8]} />
          <meshStandardMaterial color="#fff0c0" emissive="#ffdf90" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Potted plant (GLB) in the other corner */}
      <GLBModel
        url={MODELS.houseplant.url}
        fitHeight={MODELS.houseplant.fitHeight}
        position={[halfW - 0.7, FLOOR_Y, halfD - 0.7]}
      />

      {/* Framed wall art on the back wall, above the sofa */}
      <mesh position={[0, 1.9, halfD - 0.18]}>
        <boxGeometry args={[1.3, 0.85, 0.05]} />
        <meshStandardMaterial color="#e8e0cc" />
      </mesh>
      <mesh position={[0, 1.9, halfD - 0.15]}>
        <boxGeometry args={[1.1, 0.65, 0.02]} />
        <meshStandardMaterial color={art} roughness={0.7} />
      </mesh>
    </group>
  );
}
