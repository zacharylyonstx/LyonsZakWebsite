// THE BUILDER's rig — Scene 2, [0.12, 0.24]. Same discipline as THE
// DRUMMER's rig (drummerRig.ts): every number the scene draws from is a PURE
// function of journey position + viewport, nothing here reads a clock, and
// the scene components write these values straight to uniforms/DOM each
// frame. frames = f(scroll) holds by construction.
//
// Composition (docs/v2-direction.md §2 + the scene brief): two luminous
// screens emerge out of THE DRUMMER's exit breath — Kaelbot (primary, near,
// large) and MilieuOS (secondary, far, smaller/softer) — as real planes at
// different world depths. The shared camera (the SAME camera object/Canvas
// THE DRUMMER drives) continues its push from exactly where THE DRUMMER's
// pure function leaves it at t=BUILDER_START — no snap, because at p=0 every
// drift/exit term below is zero and the pose collapses to that exact
// constant (pinned in builderRig.test.ts). The panels themselves never
// move; camera translation against their fixed, DIFFERENT z distances is
// what produces true parallax between them (the same trick THE DRUMMER uses
// against its depth mesh — a moving camera against fixed depth-varying
// geometry), so "panels translate at depth-appropriate rates" falls out of
// the physics rather than being hand-animated per panel.
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import { cameraPose as drummerCameraPose, FOV_DEG, REST_Z } from '../drummer/drummerRig';

export { FOV_DEG, REST_Z };

const BUILDER = SEGMENTS.builder;

/** Small exit tail past the segment's own end (t) during which the camera
 *  pose (already at its p=1 constant) keeps being written — a short dusk
 *  breath before Scene 3 takes the camera, mirroring THE DRUMMER's own
 *  small tail past its nominal segment end. */
const TAIL = 0.02;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Local progress through the builder segment (0..1; 1 past its end). */
export function builderProgress(t: number): number {
  return segmentProgress(t, BUILDER);
}

/** Whether the scene renders/writes the camera at all. A plain t-range
 *  check (not opacity-gated, unlike THE DRUMMER) so ownership of
 *  [0.12, 0.24] is exact and unambiguous at the literal boundary — the
 *  camera's pose is mathematically continuous with THE DRUMMER's own
 *  cameraPose(BUILDER_START) regardless, so there is nothing to blend. */
export function sceneActive(t: number): boolean {
  return t >= BUILDER[0] && t < BUILDER[1] + TAIL;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE DRUMMER's exact exit pose, evaluated once at this module's load —
 *  the mathematical endpoint of drummerRig's cameraPose as p -> 1, which is
 *  well-defined regardless of whether THE DRUMMER is still actively
 *  rendering there (its own sceneActive gate stops it slightly earlier,
 *  once its photo has fully dissolved — see scene1-report.md's handoff
 *  note). Composing from this constant is what makes the handoff exact. */
const EXIT = drummerCameraPose(BUILDER[0], false);

/** Full-motion drift (p 0..0.6) and exit (p 0.6..1) deltas, added to EXIT.
 *  The camera pans left then swings back through center — a "look from one
 *  screen to the other" gesture — while continuing THE DRUMMER's forward
 *  push (z keeps decreasing), never far enough to cross either panel's own
 *  z (see PANEL_KAELBOT/PANEL_MILIEUOS below + builderRig.test.ts). Ends
 *  centered (x~0, y~EXIT.y, z~2.68) — a clean, near-neutral pose for
 *  Scene 3 (documented as BUILDER_END below). */
const DRIFT_D = { x: -0.22, y: -0.015, z: -0.26 };
const EXIT_D = { x: 0.55, y: 0.02, z: -0.24 };

/**
 * The scene camera as f(journey t). reducedMotion pins it at the site-wide
 * rest pose (0, 0, REST_Z) — identical to THE DRUMMER's own reduced-motion
 * behavior, so there is no discontinuity: under reduced motion the camera
 * never leaves rest for the whole film, and every scene's "reduced motion"
 * edition is a pure opacity crossfade at that one fixed pose.
 */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const p = builderProgress(t);
  const drift = smooth(p / 0.6);
  const exit = smooth((p - 0.6) / 0.4);
  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(EXIT.x + DRIFT_D.x * drift + EXIT_D.x * exit),
    y: nz(EXIT.y + DRIFT_D.y * drift + EXIT_D.y * exit),
    z: EXIT.z + DRIFT_D.z * drift + EXIT_D.z * exit,
  };
}

/** The pose Scene 3 (THE DAD) should compose from — the mathematical
 *  endpoint of cameraPose as t -> BUILDER_END, i.e. p=1 (drift=exit=1). */
export const BUILDER_END: CameraPose = cameraPose(BUILDER[1], false);

export type PanelId = 'kaelbot' | 'milieuos';

interface PanelSpec {
  /** World z — depth behind/ahead of the origin. Kaelbot sits nearer the
   *  REST camera (larger, primary); MilieuOS sits further (smaller,
   *  secondary, softer) — see docs/v2-direction.md §2. */
  z: number;
  /** Static tilt around Y, radians — "monitors glowing at dusk", not a
   *  flat pasted rectangle facing the camera dead-on. */
  rotY: number;
  /** Source image aspect (width / height) of the staged panel texture. */
  aspect: number;
  /** Landscape rest composition (fractions of viewport). */
  screenHeightFrac: number;
  screenXFrac: number;
  screenYFrac: number;
  /** Portrait rest composition — panels stack vertically instead. */
  portraitHeightFrac: number;
  portraitXFrac: number;
  portraitYFrac: number;
  /** Fade envelope (in journey-progress p through the segment). */
  fadeInEnd: number;
  fadeOutStart: number;
  fadeOutEnd: number;
}

export const PANEL_SPECS: Record<PanelId, PanelSpec> = {
  kaelbot: {
    z: 0.5,
    rotY: -0.135,
    aspect: 3024 / 1980,
    screenHeightFrac: 0.32,
    screenXFrac: 0.4,
    screenYFrac: 0.48,
    portraitHeightFrac: 0.11,
    // Taste-gate fix (scene2-report.md Finding 1's "re-check portrait" —
    // this panel's own bug, distinct from milieuos's landscape one below):
    // at portraitXFrac 0.5 (geometric center) kaelbot's crisp right edge
    // ran past the viewport's right edge through the WHOLE segment core,
    // from ~30px over at the very top of the core to well over 100px over
    // by its end — because the shared BUILDER camera already carries
    // persistent leftward x-drift (baked in from THE DRUMMER's own exit
    // pose, then its own further drift), which pushes screen content right
    // in EVERY orientation, not just landscape (where it was tuned/tested;
    // portrait never was). 0.5 was never actually "centered" once that
    // drift is live — shifted left to compensate; portraitHeightFrac/
    // portraitYFrac untouched (no shrink needed here). See
    // builderRig.test.ts's "both panels stay wholly inside the portrait
    // frame" suite.
    portraitXFrac: 0.24,
    portraitYFrac: 0.335,
    fadeInEnd: 0.1,
    fadeOutStart: 0.62,
    fadeOutEnd: 0.92,
  },
  milieuos: {
    z: -1.3,
    rotY: 0.155,
    aspect: 1280 / 700,
    // Taste-gate fix (scene2-report.md Finding 1): at 0.2/0.755 the camera's
    // own leftward drift (DRIFT_D.x) pushed this panel's crisp right edge
    // past the right viewport edge through the segment's core — a
    // half-amputated bright card, not a composed one (confirmed both at
    // rest t=0.140 and worse at mid-drift t=0.190, at both 1600x1000 and
    // 1280x800). Recomposed smaller and shifted left; z/rotY/screenYFrac
    // untouched. Margins verified by direct projection through the LIVE
    // camera across t=[0.12,0.24] step 0.005 at {1600x1000, 1280x800,
    // 2200x1238}: the panel's own right edge never exceeds the viewport
    // (worst case ~30px inside, at 1280x800/t=0.19), and its bbox never
    // overlaps kaelbot's through the segment core [0.135, 0.20] at any
    // sampled viewport — see builderRig.test.ts's "milieuos stays wholly
    // inside the frame" + reused overlap suite.
    screenHeightFrac: 0.17,
    screenXFrac: 0.705,
    screenYFrac: 0.415,
    portraitHeightFrac: 0.15,
    // Same portrait fix as kaelbot's above (same shared-camera drift, same
    // "0.5 wasn't actually centered" root cause) — shifted left, no shrink.
    portraitXFrac: 0.28,
    portraitYFrac: 0.585,
    fadeInEnd: 0.16,
    fadeOutStart: 0.56,
    fadeOutEnd: 0.88,
  },
};

/** Half the vertical FOV, in radians — the one trig call every distance
 *  conversion below is built from. */
const HALF_FOV_RAD = (FOV_DEG * Math.PI) / 360;

/** World units per screen px at a given distance from the camera along its
 *  view axis (the camera looks down -Z with no rotation, exactly like THE
 *  DRUMMER's). Identical in x and y (a standard, non-anamorphic
 *  perspective camera). */
function worldPerPxAt(distance: number, viewportHeight: number): number {
  return (2 * distance * Math.tan(HALF_FOV_RAD)) / viewportHeight;
}

export interface PanelLayout {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotY: number;
}

/** Where a panel sits in WORLD space for a given viewport — a pure function
 *  of (w, h), computed against the REST camera position (0, 0, REST_Z),
 *  exactly mirroring drummerRig.layout()'s convention: the panel's world
 *  transform only reacts to viewport SIZE; the live camera's own motion
 *  (cameraPose above) is what then produces its on-screen parallax. */
export function panelLayout(id: PanelId, w: number, h: number): PanelLayout {
  const spec = PANEL_SPECS[id];
  const portrait = h > w * 1.05 || w < 720;
  const heightFrac = portrait ? spec.portraitHeightFrac : spec.screenHeightFrac;
  const xFrac = portrait ? spec.portraitXFrac : spec.screenXFrac;
  const yFrac = portrait ? spec.portraitYFrac : spec.screenYFrac;
  const wpp = worldPerPxAt(REST_Z - spec.z, h);
  const height = heightFrac * h * wpp;
  const width = height * spec.aspect;
  const x = (xFrac - 0.5) * wpp * w;
  const y = (0.5 - yFrac) * wpp * h;
  return { x, y, z: spec.z, width, height, rotY: spec.rotY };
}

/** True for the stacked-vertical (portrait/narrow) composition — exported
 *  so the caption layer's own layout stays in lockstep with the panels'. */
export function isPortrait(w: number, h: number): boolean {
  return h > w * 1.05 || w < 720;
}

/** Generic fade envelope in journey-progress p: smooth in, full through the
 *  middle, smooth out. Mirrors drummerRig's photoOpacity shape. */
function fadeEnvelope(p: number, inEnd: number, outStart: number, outEnd: number): number {
  const fadeIn = smooth(p / inEnd);
  const fadeOut = 1 - smooth((p - outStart) / (outEnd - outStart));
  return Math.min(fadeIn, fadeOut);
}

/** A panel's own opacity as f(journey t) — kaelbot (primary) lingers a
 *  touch longer; milieuos (secondary) both arrives and recedes first, so
 *  the two never feel like a single synchronized cut. */
export function panelOpacity(id: PanelId, t: number): number {
  const spec = PANEL_SPECS[id];
  const p = builderProgress(t);
  return fadeEnvelope(p, spec.fadeInEnd, spec.fadeOutStart, spec.fadeOutEnd);
}

/** Either panel still has visible pixels — the R3F layer's own cheap
 *  early-out, independent of sceneActive's camera-ownership range. */
export function anyPanelVisible(t: number): boolean {
  return panelOpacity('kaelbot', t) > 0.0005 || panelOpacity('milieuos', t) > 0.0005;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** Distance from the camera along its view axis. <=0 means behind it. */
  depth: number;
}

/** Projects a WORLD point to screen px (top-left origin) through the given
 *  camera pose — the inverse of the conversions panelLayout/worldPerPxAt
 *  use, driven by the LIVE (possibly moving) camera instead of the REST
 *  reference. This is what lets a DOM caption track a WebGL plane's
 *  on-screen position frame-to-frame as the camera drifts (true depth
 *  separation between the two panels means they need two independently
 *  tracked captions, not one static overlay). */
export function projectPoint(
  world: { x: number; y: number; z: number },
  cam: CameraPose,
  w: number,
  h: number,
): ScreenPoint {
  const depth = cam.z - world.z;
  const wpp = worldPerPxAt(Math.max(depth, 1e-4), h);
  return {
    x: w / 2 + (world.x - cam.x) / wpp,
    y: h / 2 - (world.y - cam.y) / wpp,
    depth,
  };
}

/** The museum-label anchor for a panel: its bottom-left corner in world
 *  space, rotated by the panel's own static tilt (rotY) so the label tracks
 *  the VISUAL corner, not an unrotated approximation of it. A small extra
 *  drop (in local, pre-rotation Y) so the label clears the panel's own
 *  glow/edge feather rather than kissing it. */
export function captionAnchor(id: PanelId, w: number, h: number): { x: number; y: number; z: number } {
  const lay = panelLayout(id, w, h);
  const localX = -lay.width / 2;
  const localY = -lay.height / 2 - lay.height * 0.045;
  return {
    x: lay.x + localX * Math.cos(lay.rotY),
    y: lay.y + localY,
    z: lay.z - localX * Math.sin(lay.rotY),
  };
}

/** A panel's own corner in world space: `lxFrac`/`lyFrac` (each in
 *  [-0.5, 0.5]) select which corner in the panel's LOCAL, pre-rotation
 *  space (e.g. (0.5, 0.5) is top-right), rotated by the panel's own static
 *  tilt — the same convention captionAnchor/panelTopAnchor use, generalized
 *  so a caller (a composition test, most usefully) can get all four
 *  corners and build the panel's actual on-screen bounding box through the
 *  live camera, not just the two named anchors those track. */
export function panelCorner(
  id: PanelId,
  w: number,
  h: number,
  lxFrac: number,
  lyFrac: number,
): { x: number; y: number; z: number } {
  const lay = panelLayout(id, w, h);
  const localX = lxFrac * lay.width;
  const localY = lyFrac * lay.height;
  return {
    x: lay.x + localX * Math.cos(lay.rotY),
    y: lay.y + localY,
    z: lay.z - localX * Math.sin(lay.rotY),
  };
}

/** A panel's own top-center point in world space (including its glow's
 *  extra headroom, not just the panel plane) — used to keep it clear of the
 *  permanent fast lane at the top of the viewport across the whole segment,
 *  the same "no collision with a permanent chrome element" discipline as
 *  captionAnchor's subtitle check. */
export function panelTopAnchor(id: PanelId, w: number, h: number): { x: number; y: number; z: number } {
  const lay = panelLayout(id, w, h);
  return { x: lay.x, y: lay.y + (lay.height / 2) * GLOW_SCALE, z: lay.z };
}

/** How much larger than the panel itself the glow sprite renders (see
 *  BuilderScene.tsx) — panelTopAnchor uses this so the exclusion check
 *  covers the visible glow bleed, not just the crisp panel rectangle. */
export const GLOW_SCALE = 1.32;
