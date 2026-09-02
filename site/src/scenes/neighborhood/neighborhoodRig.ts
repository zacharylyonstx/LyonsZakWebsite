// THE NEIGHBORHOOD's rig — Scene 4, [0.31, 0.65]. The film's center and its
// jewel. Same discipline as every rig before it: every number the scene draws
// from is a PURE function of journey position + viewport; nothing reads a
// clock; frames = f(scroll) by construction.
//
// INTEGRATION RETUNE (2026-08-30): segment widened 0.26 → 0.34 and the
// CONTINUITY RE-CUT (2026-09-01): every journey-absolute constant below is
// now NBHD[0] + px(offset) — the same pixel positions as the 15,000px cut,
// stable under the 17,000px journey (segments.ts owns the weights).
// journey lengthened 10000 → 15000px so the crossing's own window grew from
// ~1,040px to ~2,895px of scroll (see segments.ts's retune note). Every
// journey-absolute constant below was re-derived for the new bounds at the
// same LOCAL positions; the beat t≈ values in this header are the new ones.
//
// The arc (docs/v2-direction.md §4 + the scene brief):
//
//   BEAT 1 — THE BUILD (t ≈ 0.31–0.372). Out of THE DAD's exit darkness, the
//   playhouse-build frame arrives: night, raw studs, one work light, Penny in
//   the red velvet dress standing inside the framing, drills on the plywood.
//   Depth-breathing hold (the dad-scene grammar), voice line 1. This frame
//   arms everything that follows — the crossing lands harder because the
//   visitor has SEEN the thing being built by hand first.
//
//   BEAT 2 — THE BACKYARD (t ≈ 0.372–0.412). A light-led transition (the work
//   light blooms, the bloom resolves into daylight — same light-bridges
//   grammar as THE DAD's two blooms): the finished backyard photograph, the
//   same '68' plaque now painted white, trampoline mid-jump, HOLD still while
//   voice line 2 lands ("Then we moved away."). This is the crossing's own
//   phase-0 held photograph — the hero layer carrying CrossingScene has
//   faded in over the shell canvas.
//
//   BEAT 3 — THE CROSSING (t ≈ 0.412–0.605). The proven choreography mapped
//   linearly onto this window: depth-dolly breath → invisible swap at
//   crossing p=0.2 (t≈0.4506) → the authored per-region peel → departure
//   along the cine path. NO captions anywhere in this range.
//
//   BEAT 4 — THE STREET (t ≈ 0.605–0.65). The departure resolves to street
//   level (arrival.ts's settle), travel toward the LYONS mailbox, the ONE
//   line (voice.ts [0.613, 0.6465]), the game-invitation pocket glinting at the
//   mailbox once the camera lands, then dusk falls over Royal Tara Cove and
//   the frame dissolves toward the darkness THE BAND opens on.
//
// COORDINATES: beat-1 envelopes use neighborhood-LOCAL progress n (the
// dadRig convention); the crossing mapping and hero-layer envelopes are
// JOURNEY-ABSOLUTE constants (they are the contract scripts/qa.mjs reads
// through crossingDebug.heroMap, and the numbers the scene brief speaks in).
// neighborhoodRig.test.ts pins the ordering + containment of all of them.
import { SEGMENTS, SEGMENT_PX, px, segmentProgress } from '../../timeline/segments';
import { FOV_DEG, REST_Z } from '../drummer/drummerRig';
import { DAD_END } from '../dad/dadRig';
import featherJson from './feather.json';

export { FOV_DEG, REST_Z };

const NBHD = SEGMENTS.neighborhood;

/** Camera tail past the segment end — THE BAND composes from
 *  NEIGHBORHOOD_END the same way this scene composes from DAD_END. */
const TAIL = 0.02;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** dadRig's windowPulse, re-created (tiny pure function; scenes stay
 *  dependency-light): 0 at and outside [lo, hi], 1 at the midpoint, exactly
 *  0 at both edges BY CONSTRUCTION — safe to add to a continuous path. */
export function windowPulse(p: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  if (p <= lo || p >= hi) return 0;
  const mid = (lo + hi) / 2;
  const rise = smooth((p - lo) / (mid - lo));
  const fall = smooth((hi - p) / (hi - mid));
  return Math.min(rise, fall);
}

/** Local progress through the neighborhood segment (0..1; 1 past its end). */
export function nbhdProgress(t: number): number {
  return segmentProgress(t, NBHD);
}

/** Whether the SHELL-canvas half writes the camera. Unlike THE DAD, this
 *  covers the whole segment + tail even though the hero layer hides the
 *  shell canvas from t≈0.434: the camera keeps flying (cheap — one position
 *  write) so NEIGHBORHOOD_END is a real, converged pose THE BAND can compose
 *  from, not wherever the last visible frame left it. */
export function sceneActive(t: number): boolean {
  return t >= NBHD[0] && t < NBHD[1] + TAIL;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE DAD's exact exit pose — the handoff constant (zero-jump by
 *  construction: at n=0 every drift/breath term below is exactly 0). */
const EXIT: CameraPose = DAD_END;

/** Reference viewing distance for photo sizing — the camera's actual arrival
 *  distance (dadRig's REF_Z reasoning, verbatim). */
const REF_Z = EXIT.z;

// Camera drift: a slow push into the build frame while it holds, then —
// hidden beneath the hero layer — a long retreat that converges on a calm,
// slightly-raised dusk pose for THE BAND to open from.
/** Local fraction of this segment for a pixel offset — the build beat's
 *  windows were composed in pixels (the 5,100px cut) and keep them. */
const nl = (n: number) => n / SEGMENT_PX.neighborhood;

const MID = nl(1198.5); // ≈ t 0.39 — the push ends as the hero layer covers
const D1 = { x: -0.05, y: -0.012, z: -0.16 };
const D2 = { x: 0.01, y: 0.032, z: 0.3 };

/** Depth-breathing inside the build hold (dad grammar, opposite sway). */
const BREATH_Z = 0.09;
const BREATH_X = -0.04;
const BUILD_BREATHE: readonly [number, number] = [nl(306), nl(1147.5)];

/** The shell camera as f(journey t). reducedMotion pins the shared rest pose
 *  (the whole-film reduced-motion law). */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const n = nbhdProgress(t);
  const drift1 = smooth(n / MID);
  const drift2 = smooth((n - MID) / (1 - MID));
  const breathe = -windowPulse(n, BUILD_BREATHE[0], BUILD_BREATHE[1]);
  const nz = (v: number) => (v === 0 ? 0 : v);
  return {
    x: nz(EXIT.x + D1.x * drift1 + D2.x * drift2 + BREATH_X * breathe),
    y: nz(EXIT.y + D1.y * drift1 + D2.y * drift2),
    z: EXIT.z + D1.z * drift1 + D2.z * drift2 + BREATH_Z * breathe,
  };
}

/** The pose THE BAND composes from — cameraPose at the segment's end
 *  (drift1 = drift2 = 1, breath closed). */
export const NEIGHBORHOOD_END: CameraPose = cameraPose(NBHD[1], false);

/** Edge feather (feather.json — single source shared with prepare-assets'
 *  fallback bake, the standing anti-drift pattern). */
export const FEATHER: { left: number; right: number; top: number; bottom: number } =
  featherJson;

// ---------------------------------------------------------------------------
// Beat 1 — the build frame (neighborhood-local n).
// ---------------------------------------------------------------------------

/** build.jpg's aspect (2048 x 1536 — landscape 4:3). */
export const BUILD_ASPECT = 2048 / 1536;

/** Depth relief as a fraction of mesh world width. The build frame's stud
 *  framing has clean, layered depth (Penny mid, studs near, fence far) —
 *  between the sparkler's 0.055 and the swing's 0.095. */
const BUILD_DEPTH_SCALE_FRACTION = 0.075;

const BUILD_FADE_IN: readonly [number, number] = [nl(76.5), nl(510)];
const BUILD_FADE_OUT: readonly [number, number] = [nl(928.2), nl(1183.2)];

/** BUILD opacity: rises out of THE DAD's exit darkness, holds, then yields
 *  under the work-light bloom as the hero layer arrives. */
export function buildOpacity(t: number): number {
  const n = nbhdProgress(t);
  const fadeIn = smooth((n - BUILD_FADE_IN[0]) / (BUILD_FADE_IN[1] - BUILD_FADE_IN[0]));
  const fadeOut = 1 - smooth((n - BUILD_FADE_OUT[0]) / (BUILD_FADE_OUT[1] - BUILD_FADE_OUT[0]));
  return Math.min(fadeIn, fadeOut);
}

export interface PhotoLayout {
  rect: { left: number; top: number; width: number; height: number };
  worldPerPx: number;
  meshScale: number;
  meshX: number;
  meshY: number;
  depthScale: number;
  portrait: boolean;
}

/** Same layout math as dadRig.photoLayout (landscape frame variant): the
 *  night frame floats in the dusk, generous but never full-bleed — the
 *  full-bleed moment is reserved for the crossing's photograph. */
export function buildLayout(w: number, h: number): PhotoLayout {
  const portrait = h > w * 1.05 || w < 720;
  let width: number;
  let height: number;
  let left: number;
  let top: number;
  if (portrait) {
    width = 0.92 * w;
    height = width / BUILD_ASPECT;
    left = 0.5 * w - width / 2;
    top = 0.44 * h - height / 2;
  } else {
    height = 0.78 * h;
    width = height * BUILD_ASPECT;
    left = 0.5 * w - width / 2;
    top = 0.52 * h - height / 2;
  }
  const worldPerPx = (2 * REF_Z * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
  const meshScale = width * worldPerPx;
  const cx = left + width / 2;
  const cy = top + height / 2;
  return {
    rect: { left, top, width, height },
    worldPerPx,
    meshScale,
    meshX: (cx - w / 2) * worldPerPx,
    meshY: (h / 2 - cy) * worldPerPx,
    depthScale: BUILD_DEPTH_SCALE_FRACTION * meshScale,
    portrait,
  };
}

/** The work light's pool on the plywood — the build frame's own brightest
 *  region (measured off the graded frame: blurred-luminance argmax at UV
 *  (0.494, 0.634); see scene4-report.md). The night→day bloom anchors here:
 *  the light that built the playhouse is the light the finished-backyard
 *  daylight resolves out of. */
export const WORKLIGHT_UV = { u: 0.494, v: 0.634 };

/** Screen-space (px) anchor of the work-light bloom for a viewport — the
 *  build photo's layout rect + the UV offset. Pure of everything but its
 *  arguments; the DOM bloom re-reads it on resize. */
export function bloomAnchorPx(w: number, h: number): { x: number; y: number } {
  const lay = buildLayout(w, h);
  return {
    x: lay.rect.left + WORKLIGHT_UV.u * lay.rect.width,
    y: lay.rect.top + WORKLIGHT_UV.v * lay.rect.height,
  };
}

// ---------------------------------------------------------------------------
// Beats 2–4 — journey-absolute contract constants.
// ---------------------------------------------------------------------------

/** Hero layer (the fixed stack carrying CrossingScene) fade-in window: the
 *  night frame dissolves under the bloom while the held photograph fades in
 *  beneath it. */
export const HERO_FADE: readonly [number, number] = [NBHD[0] + px(990), NBHD[0] + px(1200)];

/** Work-light bloom window (journey t) — covers the build fade-out AND the
 *  hero fade-in; peaks between them so the night→day cut happens inside the
 *  light (never a raw crossfade of two exposures). Ends just after the held
 *  photo settles and BEFORE voice line 2's own fade-in completes (the light
 *  must not haze the line). */
export const BLOOM_WINDOW: readonly [number, number] = [NBHD[0] + px(885), NBHD[0] + px(1260)];

/** The bloom envelope (windowPulse — exactly 0 outside its window). */
export function bloomOpacity(t: number): number {
  return windowPulse(t, BLOOM_WINDOW[0], BLOOM_WINDOW[1]);
}

/** Journey-t at which crossing progress p leaves 0 (the hold's end) and the
 *  journey-t at which p reaches exactly 1 (the departure path's end — the
 *  street settle takes the camera from here). The stretch [HERO_FADE[1],
 *  CROSS_P_START_T] is the pure hold: the real photograph, still, while
 *  voice line 2 plays. */
export const CROSS_P_START_T = NBHD[0] + px(1530);
export const CROSS_P_END_T = NBHD[0] + px(4425);

/** Crossing progress p for journey position t — pure, monotonic, clamped.
 *  The SINGLE source of truth for journey<->crossing mapping; qa.mjs reads
 *  it through crossingDebug.heroMap. */
export function journeyToCrossingP(t: number): number {
  return clamp01((t - CROSS_P_START_T) / (CROSS_P_END_T - CROSS_P_START_T));
}

/** Inverse (p in [0,1] → journey t; p=0 returns the hold's END — the last
 *  still-photograph t — matching the v1 harness semantics). */
export function crossingPToJourneyT(p: number): number {
  return CROSS_P_START_T + clamp01(p) * (CROSS_P_END_T - CROSS_P_START_T);
}

/** Journey-t at which the crossing's frameloop wakes (tested against BOTH
 *  the damped value and the raw target — a fling's target crosses this
 *  instantly, buying the damped-transit time as rendering head start) and
 *  past which it may sleep again (the hero layer is long gone; scrubbing
 *  back re-arms with the same damped-transit headroom). */
export const CROSSING_ACTIVE_RANGE: readonly [number, number] = [NBHD[0] + px(600), NBHD[0] + px(5700)];

export function crossingActive(value: number, target: number): boolean {
  const hi = Math.max(value, target);
  const lo = Math.min(value, target);
  return hi >= CROSSING_ACTIVE_RANGE[0] && lo <= CROSSING_ACTIVE_RANGE[1];
}

/** Hero-layer opacity: fades in across HERO_FADE, owns the screen through
 *  the crossing and the street, then dissolves across the segment boundary
 *  so THE BAND's darkness receives a fading dusk street — never a cut. */
export const HERO_CLEAR_T = NBHD[1] + px(135);
/** Where the hero layer starts dissolving toward HERO_CLEAR_T (anchored to
 *  the segment END like HERO_CLEAR_T itself: the dusk street dissolves into
 *  THE BAND across the seam, however long the street settle is). */
const HERO_CLEAR_START_T = NBHD[1] - px(120);

export function heroLayerOpacity(t: number): number {
  const fadeIn = smooth((t - HERO_FADE[0]) / (HERO_FADE[1] - HERO_FADE[0]));
  const fadeOut = 1 - smooth((t - HERO_CLEAR_START_T) / (HERO_CLEAR_T - HERO_CLEAR_START_T));
  return Math.min(fadeIn, fadeOut);
}

// ---------------------------------------------------------------------------
// Beat 4 — the street (street-local q) + the dusk close.
// ---------------------------------------------------------------------------

/** The street window: CROSS_P_END_T → segment end. q = 0 exactly where the
 *  departure path ends (arrival.ts keyframe 0 is the path's final keyframe
 *  VERBATIM, so the handoff has no camera pop in either direction). */
export const STREET: readonly [number, number] = [CROSS_P_END_T, NBHD[1]];

export function streetProgress(t: number): number {
  return segmentProgress(t, STREET as [number, number]);
}

/** Street-local q by which the camera has fully landed (arrival.ts eases
 *  across [0, ARRIVAL_SETTLE_AT] and is perfectly still after). */
export const ARRIVAL_SETTLE_AT = 0.75;

/** Street-local glint window for the mailbox pocket (the game invitation,
 *  formerly the Luke-clip pocket — see rtcInvite.ts) [fadeInStart,
 *  fadeInEnd, fadeOutStart, fadeOutEnd]: opens once the camera has landed,
 *  bows out with the dusk so the segment's last frame is quiet. */
export const RTC_GLINT_WINDOW = [0.7, 0.8, 0.93, 1.0] as const;

/** Street-local window for the visible PLAY ROYAL TARA COVE link pill
 *  (2026-09-01 — Zak: "there should be a link to it"): arrives with the
 *  settle, a hair after the glint, and STAYS through the dusk — it rides
 *  the hero layer's own dissolve out (RtcPlayLink multiplies by
 *  heroLayerOpacity), so the invitation is the last thing standing on the
 *  street. */
export const RTC_PLAY_WINDOW = [0.74, 0.86, 2, 3] as const;

/** Dusk-veil opacity (0..~0.82): night falls over Royal Tara Cove after the
 *  camera settles — the "quiet street-dusk frame" THE BAND dissolves from.
 *  A DOM layer INSIDE the hero layer (it inherits the hero fade-out). */
export function duskVeilOpacity(t: number): number {
  const q = streetProgress(t);
  return 0.82 * smooth((q - ARRIVAL_SETTLE_AT) / (1 - ARRIVAL_SETTLE_AT));
}

// ---------------------------------------------------------------------------
// The static edition (reduced motion / no WebGL) — the archive's proven
// before/after composition: photograph → world render, with the one line.
// ---------------------------------------------------------------------------

/** The photo→world dissolve window for the static edition: sits inside the
 *  live crossing's own peel range (swap p=0.2 at t≈0.4506, all regions
 *  released by t≈0.479), so both editions transform at the same scroll
 *  position. */
export const STILL_CROSS_FADE: readonly [number, number] = [NBHD[0] + px(2197.5), NBHD[0] + px(2977.5)];

/** Static-edition world-still opacity (the photograph's is 1 − this while
 *  the hero window is open). */
export function stillWorldOpacity(t: number): number {
  return smooth((t - STILL_CROSS_FADE[0]) / (STILL_CROSS_FADE[1] - STILL_CROSS_FADE[0]));
}
