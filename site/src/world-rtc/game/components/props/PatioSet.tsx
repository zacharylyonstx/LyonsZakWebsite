// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/PatioSet.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface PatioProps {
  position: [number, number, number];
  rotation?: number;
}

/** A round table + 4 chairs + market umbrella (real GLB). */
export function PatioSet({ position, rotation = 0 }: PatioProps) {
  const cfg = MODELS.patioset;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} />
    </group>
  );
}
