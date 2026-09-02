// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/Bike.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { usePlayStore } from '../../state/playStore';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface BikeProps {
  position: [number, number, number];
  rotation?: number;
  /** Frame color (tints the white GLB frame). */
  color?: string;
  /** Scale: kid-sized = 0.7, adult = 1 */
  scale?: number;
  /** Registered bike id; when set and someone is riding it, this prop hides. */
  id?: string;
}

/**
 * BMX bike (real GLB). White frame tinted by `color` for the kids' pink/green
 * bikes. The ridden copy is drawn by RiddenBike, so this parked prop hides while
 * its id is being ridden (unchanged). Forward travel is +X (see RiddenBike's
 * +PI/2 yaw offset); MODELS.bike.rotationY aligns the model to that axis.
 */
export function Bike({ position, rotation = 0, color = '#c8392a', scale = 1, id }: BikeProps) {
  const ridden = usePlayStore((s) =>
    id != null && Object.values(s.riding).some((r) => r?.bikeId === id),
  );
  if (ridden) return null;
  const cfg = MODELS.bike;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} rotationY={cfg.rotationY} tint={color} />
    </group>
  );
}
