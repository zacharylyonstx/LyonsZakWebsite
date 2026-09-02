// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/TrashBins.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface BinsProps {
  position: [number, number, number];
  rotation?: number;
}

export function TrashBins({ position, rotation = 0 }: BinsProps) {
  const cfg = MODELS.trashbins;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} />
    </group>
  );
}
