// THE DRUMMER's rig — every number the scene draws from, as PURE functions
// of journey position + viewport. The site's law (frames = f(scroll)) is
// enforced here by construction: nothing in this module reads a clock, and
// the scene components write these values straight to uniforms/DOM each
// frame. The one legal exception — the one-time load settle — lives in
// DrummerScene.tsx and CONVERGES onto these values, never replaces them.
//
// Composition contract (docs/v2-direction.md, Scene 1):
//   - the Texas-flag drum portrait sits right-of-center, feathered into the
//     dusk ground (no hard rectangle edges), bleeding off the right edge;
//   - ZAK / LYONS set huge at the left, staggered, with LYONS' tail passing
//     BEHIND Zak's chest/shoulder (the depth-mask occlusion — the signature
//     move). The occlusion itself is per-pixel from the depth map, so the
//     type only needs to LAND in his region; registration is automatic.
//   - portrait viewports stack the name ABOVE him, his hair/forehead
//     overlapping the type's lower edge — occlusion preserved.
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import featherJson from './feather.json';
import { VOICE_LINES } from '../../film/voice';

/** portrait.jpg's aspect (1484 x 1024) — layout math depends on it. */
export const PHOTO_ASPECT = 1484 / 1024;

/** Perspective camera the scene renders through (both canvases). */
export const FOV_DEG = 38;
/** The rest camera distance — also the depth mesh's uDisplaceOrigin.z, so
 *  progress 0 stays byte-identical to the flat photo (makeDepthMesh's
 *  identity property). */
export const REST_Z = 5;

/** Edge feather widths in photo-UV fractions (left, right, top, bottom).
 *  SINGLE SOURCE: feather.json, a plain no-TS-syntax file both this module
 *  (resolveJsonModule/ESM) and scripts/prepare-assets.mjs (Node's
 *  `with { type: 'json' }`) import directly — the no-WebGL fallback bakes
 *  the identical feather with zero risk of the two drifting apart. */
export const FEATHER: { left: number; right: number; top: number; bottom: number } =
  featherJson;

/** Foreground/occlusion depth thresholds (NEAR = BRIGHT, 0..1): depth above
 *  uFgHi is "him and the kit" (occludes the type), below uFgLo is flag.
 *  The portrait's histogram is bimodal with a gap at ~0.3..0.5 — the band
 *  sits inside the gap, tight enough that the smoothstep edge spans ~1-2px
 *  at the silhouette. */
export const FG_LO = 0.4;
export const FG_HI = 0.47;

/** World-unit depth relief as a fraction of the mesh's world width — tied to
 *  scale so the breath reads the same at every viewport size. */
export const DEPTH_SCALE_FRACTION = 0.085;

const DRUMMER = SEGMENTS.drummer;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Quantize to 1/10 px — keeps DOM transforms deterministic-stable for the
 *  byte sweep without visible stepping. */
const q = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return r === 0 ? 0 : r; // never -0 (byte-stable style strings)
};

export interface DrummerLayout {
  /** Photo rect in CSS px (may bleed off-viewport — deliberate). */
  rect: { left: number; top: number; width: number; height: number };
  /** World units per CSS px at the rest plane (z=0). */
  worldPerPx: number;
  /** Mesh world transform: scale (world width) + center position. */
  meshScale: number;
  meshX: number;
  meshY: number;
  /** uDepthScale in world units for this layout. */
  depthScale: number;
  portrait: boolean;
}

/** Where the portrait sits for a given viewport. Pure. */
export function layout(w: number, h: number): DrummerLayout {
  const portrait = h > w * 1.05 || w < 720;
  let width: number;
  let left: number;
  let top: number;
  if (portrait) {
    // Bleed both sides; his hairline rises INTO the stacked name's lower
    // line (the occlusion canvas tucks LYONS' tail behind his head), his
    // grin clear just below it.
    width = 1.58 * w;
    left = 0.56 * w - width / 2;
    const height = width / PHOTO_ASPECT;
    top = 0.365 * h - 0.185 * height;
  } else {
    // Right-of-center, bleeding off the right edge, generous dusk left of
    // him for the name to own — the photo floats IN the world.
    const height = 0.88 * h;
    width = height * PHOTO_ASPECT;
    left = 0.66 * w - width / 2;
    top = 0.53 * h - height / 2;
  }
  const height = width / PHOTO_ASPECT;
  const worldPerPx = (2 * REST_Z * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
  const meshScale = width * worldPerPx;
  const cx = left + width / 2;
  const cy = top + height / 2;
  return {
    rect: { left, top, width, height },
    worldPerPx,
    meshScale,
    meshX: (cx - w / 2) * worldPerPx,
    meshY: (h / 2 - cy) * worldPerPx,
    depthScale: DEPTH_SCALE_FRACTION * meshScale,
    portrait,
  };
}

/** Local progress through the drummer segment (0..1; 1 past its end). */
export function drummerProgress(t: number): number {
  return segmentProgress(t, DRUMMER);
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/**
 * The scene camera as f(journey t). Rest = (0,0,REST_Z) — the identity pose.
 * Two movements:
 *   drift  (p 0..0.62)  — a slow push-in with a slight leftward slide; the
 *                         depth mesh turns the photo alive (his shoulder
 *                         parts from the flag, cymbals from his shirt).
 *   exit   (p 0.62..0.94) — the camera keeps going PAST him: deeper dolly,
 *                         stronger slide, while the frame dissolves into the
 *                         dusk breath that hands off to Scene 2.
 * reducedMotion: the camera never leaves rest (the low-motion edition is
 * dissolve-only).
 */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const p = drummerProgress(t);
  const drift = smooth(p / 0.62);
  const exit = smooth((p - 0.62) / 0.32);
  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(-0.07 * drift - 0.26 * exit),
    y: nz(0.022 * drift + 0.05 * exit),
    z: REST_Z - 0.22 * drift - 0.9 * exit,
  };
}

/** Portrait opacity as f(journey t): full through the scene's heart, gone
 *  by p=0.92 so the segment's last stretch is pure dusk breath. */
export function photoOpacity(t: number): number {
  const p = drummerProgress(t);
  if (t >= DRUMMER[1] + 0.005) return 0;
  return 1 - smooth((p - 0.7) / 0.22);
}

/** Whether the scene renders at all (skip work outside + a small margin). */
export function sceneActive(t: number): boolean {
  return t < DRUMMER[1] + 0.005 && photoOpacity(t) > 0.0005;
}

export interface NameState {
  /** CSS translate in px (quantized). */
  x: number;
  y: number;
  opacity: number;
}

/** The segment-exit dissolve shared by the whole name card (title + tag):
 *  full through the scene's heart, gone by the handoff to Scene 2. Factored
 *  out so nameTagDip can compose with it without recomputing nameState. */
function exitOpacity(p: number): number {
  return 1 - smooth((p - 0.64) / 0.24);
}

/**
 * The name block's motion — the DOM layer of the depth stack. It rides
 * between the flag (WebGL, far) and Zak (WebGL cutout, near): during the
 * drift it eases upward a touch faster than the background's parallax; on
 * exit it slides up-left harder than the photo and fades first — three
 * layers visibly parting.
 */
export function nameState(t: number, reducedMotion = false): NameState {
  const p = drummerProgress(t);
  const opacity = exitOpacity(p);
  if (reducedMotion) return { x: 0, y: 0, opacity };
  const drift = smooth(p / 0.62);
  const exit = smooth((p - 0.6) / 0.3);
  return {
    x: q(-34 * exit),
    y: q(-26 * drift - 130 * exit),
    opacity,
  };
}

/** THE DRUMMER's spoken lines, read directly off film/voice.ts's own
 *  inventory (every line whose window closes inside this segment — two
 *  since the 2026-09-01 re-cut; voice.test.ts pins the sort) — never
 *  duplicated as a second literal, the same anti-drift reasoning as
 *  FEATHER's single-source fix above. The tag dips for the whole span. */
const DRUMMER_LINES = VOICE_LINES.filter((l) => l.window[1] <= DRUMMER[1]);
const VOICE_START = DRUMMER_LINES[0].window[0];
const VOICE_END = DRUMMER_LINES[DRUMMER_LINES.length - 1].window[1];

/** Fade width (journey-t) at each edge of the tag's voice dip. Sized so the
 *  fade-OUT finishes exactly as the window opens (it starts at t=0, the
 *  first legal instant) and the fade-IN mirrors it on the way out. */
const VOICE_DIP_FADE = VOICE_START;

/**
 * The identity plate's ("Senior software engineer. Texas.") OWN opacity
 * multiplier — composes with nameState(t).opacity via nested DOM opacity
 * (`.name-tag` is a child of `.name-display`; CSS opacity multiplies down
 * the tree), so callers set it directly on `.name-tag` and never multiply
 * it by hand.
 *
 * FINDING 1 fix: the plate and Zak's own voice line (film/Subtitle.tsx,
 * this same window) must never be simultaneously opaque, at any viewport —
 * portrait stacks them ~20-30px apart with no layout room to spare. Rather
 * than reshuffle the portrait layout per breakpoint, the plate YIELDS: it
 * fades to fully transparent just before the line opens, stays invisible
 * for the line's entire window, then fades back once the line has fully
 * closed. That is disjoint BY CONSTRUCTION (this function is exactly 0
 * everywhere `t` is inside [VOICE_START, VOICE_END], where the subtitle's
 * own fade-in/out lives), so there is no opacity value for either envelope
 * at which both can render pixels — no per-size tuning needed, and the
 * fix holds automatically if the voice line's window is ever retimed.
 *
 * Runs IDENTICALLY under reduced motion (no `reducedMotion` param): this is
 * a scroll-position crossfade, not autonomous animation — the site's own
 * law is that motion tied to the visitor's own scroll is always in bounds
 * (see styles.css's reduced-motion note). Suppressing the dip under reduced
 * motion would silently restore the exact collision this fixes for exactly
 * the visitors least equipped to be confused by overlapping text; showing
 * the dip and hiding the line instead would remove real content (his own
 * words) for a motion preference that has nothing to do with them. So
 * reduced motion gets the identical yield-and-return.
 */
export function nameTagDip(t: number): number {
  const pre = smooth((VOICE_START - t) / VOICE_DIP_FADE); // 1 well before the window, 0 at its start
  const post = smooth((t - VOICE_END) / VOICE_DIP_FADE); // 0 at the window's end, 1 well after
  return Math.max(pre, post);
}

/** The scroll cue dissolves the moment travel begins. */
export function cueOpacity(t: number): number {
  return 1 - smooth(t / 0.03);
}

// ---------------------------------------------------------------------------
// THE DRUMMER'S EASTER EGG (ship-pass item 2a) — an invisible click region
// over the drum kit itself. A fractional box in the PHOTO's own UV space
// (top-left origin, matching `layout().rect`), hand-picked from the source
// portrait to cover the toms/snare cluster at bottom-left while staying
// clear of Zak's own face/torso (so the cursor hint never competes with him
// for the pointer). The depth mesh's own vertex relief (±DEPTH_SCALE_
// FRACTION of mesh scale) is ignored for this projection — the same
// approximation every DOM affordance tracking a WebGL scene in this film
// already makes (bandRig's recordAffordanceAnchor projects the record's
// FLAT layout, not its rendered depth) — a click TARGET never needs pixel
// accuracy the way a rendered pixel does.
// ---------------------------------------------------------------------------

export const DRUM_KIT_FRAC = { x: 0.24, y: 0.77, halfW: 0.24, halfH: 0.23 };

/** The kit's anchor in WORLD space (z=0, the mesh's own rest plane) for a
 *  given viewport — reprojected live each frame against the actual camera
 *  pose (drumKitAnchorWorld + projectPoint below), the bandRig.
 *  recordAffordanceAnchor/projectPoint pattern exactly. */
export function drumKitAnchorWorld(w: number, h: number): { x: number; y: number; z: number } {
  const lay = layout(w, h);
  const cx = lay.rect.left + DRUM_KIT_FRAC.x * lay.rect.width;
  const cy = lay.rect.top + DRUM_KIT_FRAC.y * lay.rect.height;
  return {
    x: (cx - w / 2) * lay.worldPerPx,
    y: (h / 2 - cy) * lay.worldPerPx,
    z: 0,
  };
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

/** Screen-space projection of a world point through the given camera pose —
 *  bandRig.projectPoint's math, duplicated per the house convention (small,
 *  generically useful pure functions get duplicated across rigs rather than
 *  cross-imported). */
export function projectPoint(
  world: { x: number; y: number; z: number },
  cam: CameraPose,
  w: number,
  h: number,
): ScreenPoint {
  const depth = cam.z - world.z;
  const wpp = (2 * Math.max(depth, 1e-4) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
  return {
    x: w / 2 + (world.x - cam.x) / wpp,
    y: h / 2 - (world.y - cam.y) / wpp,
    depth,
  };
}

/** The hotspot's own CSS-px footprint at a given projected depth — scales
 *  with the live dolly exactly like the photo it sits on (perspective: size
 *  is inversely proportional to depth), anchored to how wide the kit region
 *  reads at REST_Z. */
export function drumKitHotspotSize(
  w: number,
  h: number,
  depth: number,
): { width: number; height: number } {
  const lay = layout(w, h);
  const restWidth = DRUM_KIT_FRAC.halfW * 2 * lay.rect.width;
  const restHeight = DRUM_KIT_FRAC.halfH * 2 * lay.rect.height;
  const scale = REST_Z / Math.max(depth, 1e-4);
  return { width: restWidth * scale, height: restHeight * scale };
}

/** Whether the hotspot is interactive right now — present through the
 *  photo's own hold, gone once it has visibly begun to dissolve (never
 *  invite a click on a frame that's already leaving — the standing
 *  affordance-fade convention every scene in this film uses). */
export function drumKitHotspotActive(t: number): boolean {
  return sceneActive(t) && photoOpacity(t) > 0.5;
}
