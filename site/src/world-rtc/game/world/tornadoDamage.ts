// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/tornadoDamage.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
// Per-house tornado damage — a plain mutable singleton (NOT a zustand store) so
// the TornadoController can ramp it every frame and House.tsx can read it in its
// useFrame hot path WITHOUT triggering React re-renders. Mirrors the touchInput
// singleton pattern. Damage ratchets UP only (a house never heals mid-storm) and
// is cleared on tornado start / replay.

// The funnel weaves the full width of the street (houses sit ~18m off the
// centerline), so the reach has to span that or houses it passes never feel it.
/** How close (m) the funnel center must come for a house to start shedding. */
export const DAMAGE_RADIUS = 26;
/** Within this radius the house takes a direct hit → full collapse. */
export const DIRECT_HIT_RADIUS = 9;

/** address → 0..1 accumulated damage (1 = funnel core passed through it). */
const damage = new Map<string, number>();

/** Raise a house's damage toward `v` (never lowers it). */
export function rampHouseDamage(address: string, v: number): void {
  const cur = damage.get(address) ?? 0;
  if (v > cur) damage.set(address, v);
}

export function getHouseDamage(address: string): number {
  return damage.get(address) ?? 0;
}

/** Wipe all damage (tornado mode start / replay / mode switch). */
export function resetHouseDamage(): void {
  damage.clear();
}

// DEV-only: drive house damage from the console / Playwright for screenshot
// verification (the real ramp only runs on the multiplayer host).
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __houseDamage?: unknown }).__houseDamage = {
    ramp: rampHouseDamage,
    get: getHouseDamage,
    reset: resetHouseDamage,
  };
}
