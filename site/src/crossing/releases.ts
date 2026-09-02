// REGION_RELEASE — the art-direction data of the peel (G1.1 Task 4).
// EXTRACTED from site/experiments/a2-crossing/src/timeline.ts (production-slice
// Task 2); every value verbatim. This is data, not code: the authored order IS
// the choreography of the crossing.
//
// Per-region release windows in crossing progress p: before `start` the region
// still wears the photograph (guards suppressed — it holds as one coherent
// piece); across [start, end] it crosses to the game's own material as a
// luminance-ordered wipe (see crossingDissolveKeep in crossing.frag.glsl);
// after `end` it is fully game. The authored order IS the choreography:
//   the floor becomes game first, the fence follows, the playhouse crosses
//   as one clean reveal, the canopy releases as a soft veil while the sky
//   resolves behind it — and the kids on the trampoline are the last
//   photograph pixels to leave.
// All windows start at/after PHASE1_END (0.2, see choreography.ts), so every
// region is exactly photo at the swap (the byte-exact identity is untouched
// by construction).

export type RegionName =
  | 'kids' | 'trampoline' | 'playhouse' | 'canopy' | 'sky' | 'ground' | 'rest';

export const REGION_RELEASE: Record<RegionName, [number, number]> = {
  ground: [0.205, 0.26],
  rest: [0.215, 0.3], // fence, patio overhang, swing set, unmasked scraps
  playhouse: [0.245, 0.295],
  canopy: [0.25, 0.4],
  sky: [0.215, 0.3], // pale photo sky -> pale game sky; early, before the rise
  // (the backstop's non-sky texels — the confetti source — ride this window too)

  // Trampoline and kids must finish while still FRAMED: the departure camera
  // crops the trampoline (and the kids with it) out of view past p≈0.33 — a
  // later "kids last" beat would play to nobody.
  trampoline: [0.27, 0.33],
  kids: [0.295, 0.35],
};

/** p at which every region (incl. the kids) has fully released. */
export const ALL_RELEASED_P = Math.max(
  ...Object.values(REGION_RELEASE).map(([, e]) => e),
);
