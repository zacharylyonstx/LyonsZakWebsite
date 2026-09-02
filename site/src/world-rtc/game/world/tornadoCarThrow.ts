// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/tornadoCarThrow.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
// Which parked cars the tornado has grabbed. A plain mutable singleton (like
// tornadoDamage) so TornadoController can flag a car the instant the funnel
// reaches it and ParkedCar can read it in its useFrame without React churn.
// Once thrown, a car is gone for the rest of the storm.

/** Funnel must come this close (m) to a parked car to rip it off the driveway. */
export const CAR_THROW_RADIUS = 12;

/** carId → wall-clock seconds (perf.now()/1000) the throw began. */
const thrown = new Map<string, number>();

export function throwCar(id: string, at: number): void {
  if (!thrown.has(id)) thrown.set(id, at);
}
export function getCarThrow(id: string): number | undefined {
  return thrown.get(id);
}
export function resetCarThrow(): void {
  thrown.clear();
}

// DEV-only: inspect thrown cars during screenshot verification.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __carThrow?: unknown }).__carThrow = {
    list: () => Array.from(thrown.keys()),
    count: () => thrown.size,
    reset: resetCarThrow,
  };
}
