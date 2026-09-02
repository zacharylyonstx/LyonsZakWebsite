// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/Sedan.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface SedanProps {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}

/**
 * Four-door sedan, real GLB. White body texture tinted by `color` so per-house
 * paint variety survives. Nose authored to local -Z to match the drive controller.
 */
export function Sedan({ position, rotation = 0, color = '#a8a8a8' }: SedanProps) {
  const cfg = MODELS.sedan;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} rotationY={cfg.rotationY} tint={color} />
    </group>
  );
}
