// THE DAD's rig — Scene 3, [0.24, 0.36]. Same discipline as THE DRUMMER's and
// THE BUILDER's rigs: every number the scene draws from is a PURE function of
// journey position + viewport, nothing here reads a clock, and the scene
// components write these values straight to uniforms/DOM each frame.
// frames = f(scroll) holds by construction.
//
// Composition (docs/v2-direction.md §3 + the scene brief): two of the
// archive's strongest father/kid frames, given the same depth-mesh treatment
// as THE DRUMMER's opening portrait (graded photo + depth displacement +
// feathered edges) but WITHOUT that scene's type-occlusion half — there is no
// name card fighting these photographs for space, so the fragment shader only
// needs the edge feather (see patchDadMaterial.ts).
//
//   SPARKLER (blue hour, Zak lighting a sparkler in toddler Luke's hand) —
//   the dusk THE BUILDER hands off already matches this photo's own palette
//   (it's literally where the film's amber accent comes from), so the
//   entrance is light-led, not a hard cut: an amber glow (the shared
//   panelMaterial.ts glowTexture, anchored at the sparkler's own brightest
//   pixel) blooms first, and the photo grows out of it a beat later.
//
//   ROPE-SWING (Zak standing on a rope swing in a cowboy hat, both kids
//   riding it, magnolia + lake behind — graded warmer to sit in the same
//   world; see grade.mjs's per-frame override, documented in
//   scene3-report.md) — arrives through a second, brighter bloom at the
//   midpoint of the transition: sparkler fades under the light, the light
//   alone holds the screen for a beat, then the swing photo resolves out of
//   it. Camera continues its push/pan from BUILDER_END throughout, plus a
//   small scroll-driven "breathing" dolly during each hold (a pure bump
//   function of progress, zero at both edges of its own window BY
//   CONSTRUCTION — see windowPulse — so it can never introduce a seam) that
//   lets each photo's own depth parallax read even while the visitor holds
//   still at one scroll position and nudges back and forth.
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import { FOV_DEG, REST_Z } from '../drummer/drummerRig';
import { BUILDER_END } from '../builder/builderRig';
import featherJson from './feather.json';

export { FOV_DEG, REST_Z };

const DAD = SEGMENTS.dad;

/** Small exit tail past the segment's own end during which the (already
 *  converged, p=1) camera pose keeps being written — mirrors THE BUILDER's
 *  own TAIL, a short dusk breath before Scene 4 takes the camera. */
const TAIL = 0.02;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** A smooth pulse: 0 at and outside [lo, hi], rising to exactly 1 at the
 *  midpoint, falling back to 0 — the same "fadeIn/fadeOut, take the min"
 *  shape Subtitle.tsx's subtitleStateAt uses for voice-line windows, reused
 *  here for the glow blooms and the depth-breathing gates. Being exactly 0
 *  at both edges (not just close to it) is what makes it safe to ADD to a
 *  continuous camera path without creating a seam at the window boundary. */
export function windowPulse(p: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  if (p <= lo || p >= hi) return 0;
  const mid = (lo + hi) / 2;
  const rise = smooth((p - lo) / (mid - lo));
  const fall = smooth((hi - p) / (hi - mid));
  return Math.min(rise, fall);
}

/** Local progress through the dad segment (0..1; 1 past its end). */
export function dadProgress(t: number): number {
  return segmentProgress(t, DAD);
}

/** Whether the scene renders/writes the camera at all. A plain t-range check
 *  (THE BUILDER's style, not THE DRUMMER's opacity-gated one) so ownership of
 *  [0.24, 0.36] is exact — the camera's pose is mathematically continuous
 *  with THE BUILDER's own cameraPose(DAD_START) regardless (see EXIT below),
 *  so there is nothing to blend at the seam. */
export function sceneActive(t: number): boolean {
  return t >= DAD[0] && t < DAD[1] + TAIL;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE BUILDER's exact exit pose — the handoff constant. Composing from this
 *  (rather than a hand-copied number) is what makes the seam exact: at
 *  p=0 every drift/breathing term below is zero and cameraPose(DAD_START)
 *  collapses to precisely this value (pinned in dadRig.test.ts). */
const EXIT: CameraPose = BUILDER_END;

/** Reference viewing distance for THIS segment's photo sizing (see
 *  photoLayout below) — the camera's own actual position as THE DAD opens,
 *  not the generic REST_Z=5 THE DRUMMER's layout uses (which is correct
 *  there because ITS camera actually starts at REST_Z at progress 0). Using
 *  EXIT.z here means "heightFrac" reads as "the fraction of the viewport
 *  this photo occupies at the camera distance the visitor actually arrives
 *  at," not at a distance the camera never visits during this scene. */
const REF_Z = EXIT.z;

/** Camera drift, in three phases, mirroring THE BUILDER's own two-phase
 *  drift/exit pattern but with one more segment (a "look toward the swing"
 *  pan mid-scene) plus a retreat that composes toward THE KEEPER-side of
 *  darkness for Scene 4 to hand off from. All deltas are ADDED to EXIT, so
 *  at p=0 the sum is exactly EXIT (drift1=drift2=retreat=0). */
const MID = 0.48; // aligned with the transition bloom's own peak (TRANS below)
const RETREAT_START = 0.9; // aligned with the swing hold's own fade-out start

/** p in [0, MID]: a slow push + slight left pan while the sparkler holds —
 *  the depth mesh turns that into Zak (near, left) parting from the tent
 *  curtains (far, right). */
const D1 = { x: -0.1, y: 0.008, z: -0.14 };
/** p in [MID, RETREAT_START]: the camera swings back past center and a
 *  touch right, continuing its forward push — the swing photo's own
 *  parallax (kids near/low-left, Zak far/high-right) reads through this
 *  pan the same way THE BUILDER's own pan reveals kaelbot vs milieuos. */
const D2 = { x: 0.16, y: -0.02, z: -0.16 };
/** p in [RETREAT_START, 1]: pull back and settle upward — composing toward
 *  the darkness Scene 4 (the playhouse build, at night) opens on. */
const RETREAT = { x: -0.02, y: 0.03, z: 0.34 };

/** Depth-breathing: a single gentle push-closer-then-back within EACH hold,
 *  driven by windowPulse (so it is exactly 0 at both edges of its own
 *  window — it can never perturb the drift path's own continuity at a phase
 *  boundary). A small lateral sway rides with it so the parallax it reveals
 *  isn't purely a straight-in dolly. Opposite sway sign per photo so the
 *  gesture doesn't feel identical twice in a row. */
const BREATH_Z = 0.1;
const BREATH_X = 0.045;
const SPARKLER_BREATHE: readonly [number, number] = [0.12, 0.4];
const SWING_BREATHE: readonly [number, number] = [0.58, 0.9];

/**
 * The scene camera as f(journey t). reducedMotion pins it at the shared
 * rest pose (0, 0, REST_Z) — identical to THE DRUMMER/THE BUILDER's own
 * reduced-motion behavior, so there is never a discontinuity: under reduced
 * motion the camera never leaves rest for the whole film.
 */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const p = dadProgress(t);
  const drift1 = smooth(p / MID);
  const drift2 = smooth((p - MID) / (RETREAT_START - MID));
  const retreat = smooth((p - RETREAT_START) / (1 - RETREAT_START));

  const breatheSparkler = -windowPulse(p, SPARKLER_BREATHE[0], SPARKLER_BREATHE[1]);
  const breatheSwing = -windowPulse(p, SWING_BREATHE[0], SWING_BREATHE[1]);
  const breatheZ = BREATH_Z * (breatheSparkler + breatheSwing); // windows never overlap
  const breatheX = BREATH_X * (-breatheSparkler + breatheSwing); // opposite sway per photo

  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(EXIT.x + D1.x * drift1 + D2.x * drift2 + RETREAT.x * retreat + breatheX),
    y: nz(EXIT.y + D1.y * drift1 + D2.y * drift2 + RETREAT.y * retreat),
    z: EXIT.z + D1.z * drift1 + D2.z * drift2 + RETREAT.z * retreat + breatheZ,
  };
}

/** The pose Scene 4 should compose from — cameraPose at journey position
 *  DAD[1] (p=1: drift1=drift2=retreat=1, both breathe windows already
 *  closed). Documented precisely (not "≈") because this scene composes
 *  itself from BUILDER_END the same exact way — see scene3-report.md. */
export const DAD_END: CameraPose = cameraPose(DAD[1], false);

/** Edge feather widths in photo-UV fractions — single source (feather.json)
 *  shared with prepare-assets.mjs's fallback bake, the same anti-drift
 *  pattern THE DRUMMER's FEATHER established. Both photos share one feather
 *  shape (they're both "a photo floating in the dusk," centered, no text to
 *  avoid) — a per-photo override would be easy to add if a future pass
 *  wants one. */
export const FEATHER: { left: number; right: number; top: number; bottom: number } =
  featherJson;

/** World-unit depth relief as a fraction of the mesh's world width. Two
 *  values, not one: the sparkler's two subjects sit close together at a
 *  narrow depth range (a strong relief would warp their faces during the
 *  dolly), while the swing's four-figure depth spread was rated "excellent"
 *  separation and can carry more without artifacting. Tuned by eye against
 *  screenshots at the hold's own breathing extremes. */
const SPARKLER_DEPTH_SCALE_FRACTION = 0.055;
const SWING_DEPTH_SCALE_FRACTION = 0.095;

export interface PhotoLayout {
  rect: { left: number; top: number; width: number; height: number };
  worldPerPx: number;
  meshScale: number;
  meshX: number;
  meshY: number;
  depthScale: number;
  portrait: boolean;
}

interface PhotoComposition {
  aspect: number;
  depthScaleFraction: number;
  landscapeHeightFrac: number;
  landscapeXFrac: number;
  landscapeYFrac: number;
  portraitWidthFrac: number;
  portraitXFrac: number;
  portraitYFrac: number;
}

function photoLayout(w: number, h: number, comp: PhotoComposition): PhotoLayout {
  const portrait = h > w * 1.05 || w < 720;
  let width: number;
  let height: number;
  let left: number;
  let top: number;
  if (portrait) {
    width = comp.portraitWidthFrac * w;
    height = width / comp.aspect;
    left = comp.portraitXFrac * w - width / 2;
    top = comp.portraitYFrac * h - height / 2;
  } else {
    height = comp.landscapeHeightFrac * h;
    width = height * comp.aspect;
    left = comp.landscapeXFrac * w - width / 2;
    top = comp.landscapeYFrac * h - height / 2;
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
    depthScale: comp.depthScaleFraction * meshScale,
    portrait,
  };
}

/** sparkler.jpg's aspect (3024 x 4032, after EXIF-rotate — grade.mjs's
 *  stage 1 bakes the orientation the depth map already ships in). */
export const SPARKLER_ASPECT = 3024 / 4032;
/** swing.jpg's aspect AFTER the mother-exclusion crop (2732 x 3024) — see
 *  scene3-report.md for why this frame is pre-cropped, unlike every other
 *  scene's photo, before it ever reaches grade.mjs. */
export const SWING_ASPECT = 2732 / 3024;

const SPARKLER_COMPOSITION: PhotoComposition = {
  aspect: SPARKLER_ASPECT,
  depthScaleFraction: SPARKLER_DEPTH_SCALE_FRACTION,
  landscapeHeightFrac: 0.82,
  landscapeXFrac: 0.5,
  landscapeYFrac: 0.52,
  portraitWidthFrac: 0.86,
  portraitXFrac: 0.5,
  portraitYFrac: 0.46,
};

const SWING_COMPOSITION: PhotoComposition = {
  aspect: SWING_ASPECT,
  depthScaleFraction: SWING_DEPTH_SCALE_FRACTION,
  landscapeHeightFrac: 0.82,
  landscapeXFrac: 0.5,
  landscapeYFrac: 0.52,
  portraitWidthFrac: 0.86,
  portraitXFrac: 0.5,
  portraitYFrac: 0.46,
};

export function sparklerLayout(w: number, h: number): PhotoLayout {
  return photoLayout(w, h, SPARKLER_COMPOSITION);
}

export function swingLayout(w: number, h: number): PhotoLayout {
  return photoLayout(w, h, SWING_COMPOSITION);
}

/** The sparkler's own brightest pixel (UV fraction, top-left origin —
 *  measured directly off the graded frame, see scene3-report.md), used to
 *  anchor the glow sprite so "the light leads the image" arrives from
 *  exactly where the flare itself sits, not an arbitrary screen center. */
const SPARKLER_FLARE_UV = { u: 0.362, v: 0.39 };

/** The glow's fixed world anchor for a given viewport — computed once from
 *  the SPARKLER's own rest layout (never the live camera), the same
 *  convention builderRig's captionAnchor uses: a point tied to a photo's own
 *  composition, tracked through projection by whoever draws it. Both the
 *  arrival bloom and the transition bloom share this anchor — the light
 *  that leads the sparkler in is the same light the transition resolves
 *  through, never repositioned mid-scene. */
export function glowAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = sparklerLayout(w, h);
  // lay.meshScale is the mesh's WORLD-space width (the plane's local width=1
  // uniformly scaled by meshScale, mirroring drummerRig.layout's own
  // "meshScale = world width" convention); world height follows from the
  // photo's own aspect the same way makeDepthMesh builds the plane's local
  // geometry (width=1, height=1/aspect).
  const worldWidth = lay.meshScale;
  const worldHeight = lay.meshScale / SPARKLER_ASPECT;
  const localX = (SPARKLER_FLARE_UV.u - 0.5) * worldWidth;
  const localY = (0.5 - SPARKLER_FLARE_UV.v) * worldHeight;
  return { x: lay.meshX + localX, y: lay.meshY + localY, z: 0 };
}

/** Phase windows (journey progress p through [0.24, 0.36]) — see the file
 *  header for the beat-by-beat narrative these drive. */
const ARRIVAL_GLOW: readonly [number, number] = [0, 0.16];
const SPARKLER_FADE_IN: readonly [number, number] = [0.02, 0.12];
const SPARKLER_FADE_OUT: readonly [number, number] = [0.4, 0.5];
const TRANS_GLOW: readonly [number, number] = [0.38, 0.58];
const SWING_FADE_IN: readonly [number, number] = [0.46, 0.58];
const SWING_FADE_OUT: readonly [number, number] = [0.9, 1.0];

/** SPARKLER opacity: the light arrives first (see glowState below), the
 *  photo grows out of it a beat later (FADE_IN starts 0.02 after the glow
 *  bloom's own window opens), holds full through the scene's first half,
 *  then yields under the transition's own brighter bloom. */
export function sparklerOpacity(t: number): number {
  const p = dadProgress(t);
  const fadeIn = smooth((p - SPARKLER_FADE_IN[0]) / (SPARKLER_FADE_IN[1] - SPARKLER_FADE_IN[0]));
  const fadeOut = 1 - smooth((p - SPARKLER_FADE_OUT[0]) / (SPARKLER_FADE_OUT[1] - SPARKLER_FADE_OUT[0]));
  return Math.min(fadeIn, fadeOut);
}

/** SWING opacity: resolves OUT of the transition bloom (fade-in starts
 *  after the bloom's own peak at p=0.48), holds full through the scene's
 *  second half, then dissolves into the exit dusk. */
export function swingOpacity(t: number): number {
  const p = dadProgress(t);
  const fadeIn = smooth((p - SWING_FADE_IN[0]) / (SWING_FADE_IN[1] - SWING_FADE_IN[0]));
  const fadeOut = 1 - smooth((p - SWING_FADE_OUT[0]) / (SWING_FADE_OUT[1] - SWING_FADE_OUT[0]));
  return Math.min(fadeIn, fadeOut);
}

/** Glow sprite scale multiplier per bloom — the arrival bloom reads as "a
 *  spark appearing" (small, contained); the transition bloom reads as "a
 *  wash of light" (larger — the signature move, the film's center-of-scene
 *  moment where light alone briefly holds the frame). */
const ARRIVAL_GLOW_SCALE = 2.2;
const TRANS_GLOW_SCALE = 4.2;

export interface GlowState {
  opacity: number;
  scale: number;
}

/** The glow sprite's opacity + scale as f(journey t). The two blooms never
 *  overlap in time (ARRIVAL_GLOW ends at p=0.16, TRANS_GLOW starts at
 *  p=0.38), so at any instant at most one is nonzero — Math.max is exact,
 *  not an approximation, and the scale pick (whichever bloom is currently
 *  driving) is inert when both are 0 (opacity masks it). */
export function glowState(t: number): GlowState {
  const p = dadProgress(t);
  const arrival = windowPulse(p, ARRIVAL_GLOW[0], ARRIVAL_GLOW[1]);
  const trans = windowPulse(p, TRANS_GLOW[0], TRANS_GLOW[1]);
  return {
    opacity: Math.max(arrival, trans),
    scale: arrival >= trans ? ARRIVAL_GLOW_SCALE : TRANS_GLOW_SCALE,
  };
}

/** Either photo (or the glow) still has visible pixels — the R3F layer's
 *  own cheap early-out, independent of sceneActive's camera-ownership
 *  range (mirrors builderRig's anyPanelVisible). */
export function anyDadVisible(t: number): boolean {
  return (
    sparklerOpacity(t) > 0.0005 ||
    swingOpacity(t) > 0.0005 ||
    glowState(t).opacity > 0.0005
  );
}
