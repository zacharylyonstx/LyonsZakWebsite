// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/GolfCart.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface GolfCartProps {
  position: [number, number, number];
  rotation?: number;
  /** Accepted for parity with Truck/Sedan; the cart keeps its natural paint
   *  (tinting would wash the canopy + tires to one flat color). */
  color?: string;
}

/** Golf-club cart, real GLB. Nose at local -Z to match the drive controller. */
export function GolfCart({ position, rotation = 0 }: GolfCartProps) {
  const cfg = MODELS.golfcart;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} rotationY={cfg.rotationY} />
    </group>
  );
}
