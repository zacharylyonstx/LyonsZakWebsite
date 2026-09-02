// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/houseDestruction.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useGameStore } from '../state/gameStore';

// Helper for the tornado game-mode's house destruction animation.
// Components read `destructionProgress(address, now)` each frame and apply
// the resulting 0..1 value to their visual transforms.

export const DESTRUCTION_DURATION = 2.2; // seconds from collapse start to rubble — extended for dramatic debris fountain + dust burst

export function destructionProgress(address: string, now: number): number {
  const at = useGameStore.getState().destroyedHouses[address];
  if (at == null) return 0;
  return Math.max(0, Math.min(1, (now - at) / DESTRUCTION_DURATION));
}

/** Phases of the destruction animation given a 0..1 progress value.
 *  - roofDrop: 0 at start → 1 by 30% (roof falls/rotates)
 *  - wallShrink: 0 by 30% → 1 by 70% (walls scale down)
 *  - rubble: 0 by 70% → 1 by 100% (low rubble pile fades in) */
export function destructionPhases(progress: number) {
  return {
    roofDrop: Math.max(0, Math.min(1, progress / 0.3)),
    wallShrink: Math.max(0, Math.min(1, (progress - 0.3) / 0.4)),
    rubble: Math.max(0, Math.min(1, (progress - 0.7) / 0.3)),
  };
}
