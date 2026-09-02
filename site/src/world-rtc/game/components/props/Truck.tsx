// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/Truck.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface TruckProps {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}

/**
 * Full-size pickup (F-150 style), real GLB. The model ships a white body texture;
 * `color` is multiplied onto the material so each house's paint still varies and
 * the hero's bright-blue truck reads correctly. Nose authored to local -Z to match
 * the driving controller (RiddenBike sets group.rotation.y = heading directly).
 */
export function Truck({ position, rotation = 0, color = '#1a3a5e' }: TruckProps) {
  const cfg = MODELS.truck;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} rotationY={cfg.rotationY} tint={color} />
    </group>
  );
}
