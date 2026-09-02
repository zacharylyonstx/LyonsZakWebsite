// THE BAND's rig — Scene 5, [0.62, 0.74]. Same discipline as every rig
// before it: every number the scene draws from is a PURE function of
// journey position + viewport; nothing reads a clock; frames = f(scroll) by
// construction.
//
// Composition (the scene brief + docs/v2-direction.md §5): three beats, one
// reveal — the engineer-dad has been drumming in a working band with the
// same friends for over a decade.
//
//   BEAT 1 — THE GIG (b ≈ 0-0.417, t ≈ 0.62-0.67). Out of THE NEIGHBORHOOD's
//   dissolving dusk street, the barn-porch night gig arrives: three
//   bandmates under string lights, an empty drum kit between them (Zak is
//   behind the camera/the kit, not in the frame — the same "he's the one
//   filming this" reading the practice photo uses in beat 3). Voice line 1.
//
//   BEAT 2 — THE RECORD (b ≈ 0.417-0.75, t ≈ 0.67-0.71). The gig image
//   yields to the "Lost in Austin" sleeve, presented as a real object at its
//   own world depth (nearer the camera than the flat photo plane, a slight
//   tilt) — not a full-bleed photograph. This is the scene's audio
//   discovery: a quiet, amber play affordance (recordPlayer.ts + the DOM
//   half in BandScene.tsx) that is never autoplayed and never holds scroll.
//
//   BEAT 3 — THE PRACTICE (b ≈ 0.75-1, t ≈ 0.71-0.74). The band-practice
//   photo — his own kids in the foreground of a living-room rehearsal — the
//   crossover frame. Voice line 2. Camera converges on BAND_END, the
//   documented handoff pose for THE WEIRD ONES.
//
// NO DEPTH MESH: unlike THE DAD/THE NEIGHBORHOOD, none of this scene's three
// images have a matching depth map (see scene5-report.md's asset notes), so
// all three are flat photo planes — the brief's explicitly sanctioned
// "stills + parallax" path. Parallax here comes the same way THE BUILDER's
// two panels get theirs: a single continuous camera drift against planes
// fixed at DIFFERENT world z distances (the record sits nearer the camera
// than the gig/practice photos), never per-vertex depth. Layout math below
// mirrors dadRig.ts's photoLayout (full-bleed photos) and builderRig.ts's
// panelLayout (the record's own depth-positioned object) respectively.
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import { FOV_DEG, REST_Z } from '../drummer/drummerRig';
import { NEIGHBORHOOD_END } from '../neighborhood/neighborhoodRig';
import featherJson from './feather.json';

export { FOV_DEG, REST_Z };

const BAND = SEGMENTS.band;

/** Small exit tail past the segment's own end — mirrors every prior scene's
 *  TAIL: THE WEIRD ONES composes from BAND_END, a real converged pose, not
 *  wherever the last visible frame left it. */
const TAIL = 0.02;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** The standing "0 at both edges, 1 at the midpoint" pulse (dadRig's
 *  windowPulse, re-created per the house convention of small pure-function
 *  duplication across rigs rather than cross-scene imports). */
export function windowPulse(p: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  if (p <= lo || p >= hi) return 0;
  const mid = (lo + hi) / 2;
  const rise = smooth((p - lo) / (mid - lo));
  const fall = smooth((hi - p) / (hi - mid));
  return Math.min(rise, fall);
}

/** Local progress through the band segment (0..1; 1 past its end). */
export function bandProgress(t: number): number {
  return segmentProgress(t, BAND);
}

/** Whether the scene renders/writes the camera at all — a plain t-range
 *  check (THE BUILDER/THE DAD's style), so ownership of [0.62, 0.74] is
 *  exact at the literal boundary. */
export function sceneActive(t: number): boolean {
  return t >= BAND[0] && t < BAND[1] + TAIL;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE NEIGHBORHOOD's exact exit pose — the handoff constant. Composing
 *  from this (not a hand-copied number) makes the seam exact: at b=0 every
 *  drift/breathe term below is zero and cameraPose(BAND_START) collapses to
 *  precisely this value (pinned in bandRig.test.ts). */
const EXIT: CameraPose = NEIGHBORHOOD_END;

/** Reference viewing distance for this segment's photo sizing (dadRig's
 *  REF_Z reasoning, verbatim): the camera's own actual arrival distance,
 *  not a generic constant. */
const REF_Z = EXIT.z;

/** Beat boundaries, in segment-local progress b. Chosen so each beat's own
 *  span matches the scene brief's t-ranges exactly:
 *    beat 1 (gig)      b in [0, GIG_END]        -> t in [0.62, 0.67]
 *    beat 2 (record)   b in [GIG_END, RECORD_END] -> t in [0.67, 0.71]
 *    beat 3 (practice) b in [RECORD_END, 1]      -> t in [0.71, 0.74]
 */
export const GIG_END = 5 / 12; // 0.41666..., t = 0.67
export const RECORD_END = 0.75; // t = 0.71

/** Camera drift, three phases (one per beat), deltas ADDED to EXIT — so at
 *  b=0 the sum is exactly EXIT (every drift term is 0 there). Beat 1 pushes
 *  gently into the gig; beat 2 pulls back and drifts right/up toward where
 *  the record floats; beat 3 settles back in for the practice photo and
 *  converges on BAND_END. */
const D1 = { x: -0.06, y: -0.012, z: -0.1 };
const D2 = { x: 0.11, y: 0.05, z: 0.2 };
const D3 = { x: -0.06, y: -0.032, z: -0.15 };

/** Depth-breathing inside each PHOTO hold (the dad/neighborhood grammar) —
 *  the record gets none of its own (a static object, not a breathing
 *  photograph); its held stillness is the contrast. Windows are exactly 0
 *  at both edges by construction (windowPulse), so they can never perturb
 *  the drift path's own continuity at a phase boundary. */
const BREATH_Z = 0.055;
const BREATH_X = 0.022;
const GIG_BREATHE: readonly [number, number] = [0.08, 0.34];
const PRACTICE_BREATHE: readonly [number, number] = [0.8, 0.97];

/**
 * The scene camera as f(journey t). reducedMotion pins it at the shared
 * rest pose (0, 0, REST_Z) — identical to every prior scene's reduced-motion
 * behavior: under reduced motion the camera never leaves rest for the whole
 * film.
 */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const b = bandProgress(t);
  const drift1 = smooth(b / GIG_END);
  const drift2 = smooth((b - GIG_END) / (RECORD_END - GIG_END));
  const drift3 = smooth((b - RECORD_END) / (1 - RECORD_END));

  const breatheGig = -windowPulse(b, GIG_BREATHE[0], GIG_BREATHE[1]);
  const breathePractice = -windowPulse(b, PRACTICE_BREATHE[0], PRACTICE_BREATHE[1]);
  const breatheZ = BREATH_Z * (breatheGig + breathePractice); // windows never overlap
  const breatheX = BREATH_X * (-breatheGig + breathePractice); // opposite sway per photo

  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(EXIT.x + D1.x * drift1 + D2.x * drift2 + D3.x * drift3 + breatheX),
    y: nz(EXIT.y + D1.y * drift1 + D2.y * drift2 + D3.y * drift3),
    z: EXIT.z + D1.z * drift1 + D2.z * drift2 + D3.z * drift3 + breatheZ,
  };
}

/** The pose THE WEIRD ONES should compose from — cameraPose at the
 *  segment's end (drift1=drift2=drift3=1, both breathe windows closed). */
export const BAND_END: CameraPose = cameraPose(BAND[1], false);

/** Edge feather widths (UV fractions) shared by all three photo planes —
 *  single source (feather.json) with prepare-assets.mjs's fallback bake,
 *  the standing anti-drift pattern every scene uses. */
export const FEATHER: { left: number; right: number; top: number; bottom: number } =
  featherJson;

// ---------------------------------------------------------------------------
// Beat 1 — THE GIG. A flat photo plane at world z=0 (dadRig's convention:
// the CAMERA moves, the plane doesn't) sized against REF_Z.
// ---------------------------------------------------------------------------

/** barn-gig-porch-251s.jpg's aspect (1280 x 720 — the source video frame's
 *  native resolution; see scene5-report.md for why no higher-res master
 *  exists for the real filmed gig). */
export const GIG_ASPECT = 1280 / 720;

export interface PhotoLayout {
  rect: { left: number; top: number; width: number; height: number };
  worldPerPx: number;
  meshScale: number;
  meshX: number;
  meshY: number;
  portrait: boolean;
}

interface PhotoComposition {
  aspect: number;
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
    portrait,
  };
}

const GIG_COMPOSITION: PhotoComposition = {
  aspect: GIG_ASPECT,
  landscapeHeightFrac: 0.86,
  landscapeXFrac: 0.5,
  landscapeYFrac: 0.48,
  portraitWidthFrac: 0.92,
  portraitXFrac: 0.5,
  portraitYFrac: 0.4,
};

export function gigLayout(w: number, h: number): PhotoLayout {
  return photoLayout(w, h, GIG_COMPOSITION);
}

/** GIG opacity: arrives out of THE NEIGHBORHOOD's dissolving dusk street
 *  (fade-in starts at b=0, overlapping the tail-end of that scene's own
 *  hero-layer dissolve — see scene4-report.md's HERO_CLEAR_T handoff note),
 *  holds through the beat, then yields to the record with a brief
 *  cross-dissolve overlap. */
const GIG_FADE_IN: readonly [number, number] = [0, 0.07];
const GIG_FADE_OUT: readonly [number, number] = [0.33, 0.4];

export function gigOpacity(t: number): number {
  const b = bandProgress(t);
  const fadeIn = smooth((b - GIG_FADE_IN[0]) / (GIG_FADE_IN[1] - GIG_FADE_IN[0]));
  const fadeOut = 1 - smooth((b - GIG_FADE_OUT[0]) / (GIG_FADE_OUT[1] - GIG_FADE_OUT[0]));
  return Math.min(fadeIn, fadeOut);
}

// ---------------------------------------------------------------------------
// Beat 2 — THE RECORD. A physical object at its own world depth (nearer the
// camera than the flat photos), builderRig's panelLayout convention.
// ---------------------------------------------------------------------------

/** lost-in-austin-album-art.jpg's aspect (1425 x 1425 — square). */
export const RECORD_ASPECT = 1;

/** World z the record sits at — nearer the camera than the gig/practice
 *  planes (z=0), so the same camera drift that pushes/pulls through the
 *  scene produces real parallax between "the record you're holding" and
 *  "the photographs behind it", the same trick THE BUILDER's two panels
 *  use against each other. */
export const RECORD_WORLD_Z = 0.85;

/** Static tilt around Y, radians — "a sleeve leaning", not a rectangle
 *  facing the camera dead-on. Tuned up from an initial -0.11 (screenshot
 *  self-critique, scene5-report.md: at -0.11 the tilt read as barely
 *  perceptible, closer to "a card" than "an object someone is holding at
 *  an angle") — -0.17 keeps the album art fully legible while giving the
 *  panel material's own edge feather + rim highlight visibly more edge to
 *  catch, the strongest available "this has depth" cue on a flat plane. */
export const RECORD_ROT_Y = -0.17;

interface RecordComposition {
  heightFrac: number;
  xFrac: number;
  yFrac: number;
}

const RECORD_LANDSCAPE: RecordComposition = { heightFrac: 0.4, xFrac: 0.58, yFrac: 0.5 };
const RECORD_PORTRAIT: RecordComposition = { heightFrac: 0.3, xFrac: 0.5, yFrac: 0.4 };

function worldPerPxAt(distance: number, viewportHeight: number): number {
  return (2 * distance * Math.tan((FOV_DEG * Math.PI) / 360)) / viewportHeight;
}

export interface RecordLayout {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotY: number;
  portrait: boolean;
}

/** Where the record sits in WORLD space for a given viewport — computed
 *  against the REST reference distance (REF_Z - RECORD_WORLD_Z), mirroring
 *  builderRig.panelLayout's convention: the object's world transform only
 *  reacts to viewport size; the live camera's own motion is what then
 *  produces its on-screen parallax. */
export function recordLayout(w: number, h: number): RecordLayout {
  const portrait = h > w * 1.05 || w < 720;
  const comp = portrait ? RECORD_PORTRAIT : RECORD_LANDSCAPE;
  const wpp = worldPerPxAt(REF_Z - RECORD_WORLD_Z, h);
  const height = comp.heightFrac * h * wpp;
  const width = height * RECORD_ASPECT;
  const x = (comp.xFrac - 0.5) * wpp * w;
  const y = (0.5 - comp.yFrac) * wpp * h;
  return { x, y, z: RECORD_WORLD_Z, width, height, rotY: RECORD_ROT_Y, portrait };
}

/** RECORD opacity: resolves in as the gig fades out (a short overlap, never
 *  a hard cut), holds through the beat (long enough for the excerpt's own
 *  first several seconds to land before anyone could scroll past it), then
 *  yields to the practice photo with the same overlap grammar. */
const RECORD_FADE_IN: readonly [number, number] = [0.36, 0.47];
const RECORD_FADE_OUT: readonly [number, number] = [0.7, 0.78];

export function recordOpacity(t: number): number {
  const b = bandProgress(t);
  const fadeIn = smooth((b - RECORD_FADE_IN[0]) / (RECORD_FADE_IN[1] - RECORD_FADE_IN[0]));
  const fadeOut = 1 - smooth((b - RECORD_FADE_OUT[0]) / (RECORD_FADE_OUT[1] - RECORD_FADE_OUT[0]));
  return Math.min(fadeIn, fadeOut);
}

/** Screen-space projection of a world point through the given camera pose —
 *  builderRig.projectPoint's math, re-created locally (house convention:
 *  small, generically useful pure functions get duplicated across rigs
 *  rather than cross-imported). Drives the record's DOM play affordance so
 *  it tracks the WebGL panel's own projected position frame to frame. */
export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

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

/** The play affordance's anchor: a point just below the record's own
 *  silhouette (in the record's local, pre-rotation space), rotated by its
 *  static tilt so the anchor tracks the VISUAL corner, not an unrotated
 *  approximation — captionAnchor's convention in builderRig.ts. */
export function recordAffordanceAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = recordLayout(w, h);
  const localY = -lay.height / 2 - lay.height * 0.16;
  return {
    x: lay.x,
    y: lay.y + localY,
    z: lay.z,
  };
}

/** Where the empty drum kit sits in the gig frame (UV fractions of the
 *  1280x720 source, read off the frame: the rack tom's dark shell, where a
 *  point of light actually reads — not the hi-hat's own highlight) — the glint
 *  for THE MUSIC VIDEO pocket rides this point through the camera drift so
 *  it always reads as "the kit". */
export const GIG_KIT_UV = { u: 0.46, v: 0.63 }; // the dark rack tom, not the cymbal highlight

export function gigGlintAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = gigLayout(w, h);
  const worldWidth = lay.meshScale;
  const worldHeight = lay.meshScale / GIG_ASPECT;
  return {
    x: lay.meshX + (GIG_KIT_UV.u - 0.5) * worldWidth,
    y: lay.meshY + (0.5 - GIG_KIT_UV.v) * worldHeight,
    z: 0,
  };
}

/** The glint is on only while the gig frame is fully present — never
 *  across its dissolves, so a sweep at the seams sees no pulsing dot. */
export function gigGlintOpacity(t: number): number {
  const o = gigOpacity(t);
  return o >= 0.999 ? 1 : 0;
}

/** Screen-px gap between the record's two pills (the 30-second excerpt
 *  above, THE JUKEBOX pocket below). */
export const RECORD_PILL_GAP_PX = 46;
/** Landscape: the two pills sit side by side, this many px apart. */
export const RECORD_PILL_SIDE_GAP_PX = 10;

// ---------------------------------------------------------------------------
// Beat 3 — THE PRACTICE. A second flat photo plane, same treatment as the
// gig (world z=0).
// ---------------------------------------------------------------------------

/** 06-bandpractice-photo-rotated.jpg's aspect AFTER the 90 CW rotation fix
 *  (the source file ships with no EXIF orientation tag at all — see
 *  scene5-report.md — so the correction is baked into the staged pixels
 *  rather than left to a `.rotate()` auto-orient that has nothing to read):
 *  3024 x 4032, a portrait phone photo. */
export const PRACTICE_ASPECT = 3024 / 4032;

const PRACTICE_COMPOSITION: PhotoComposition = {
  aspect: PRACTICE_ASPECT,
  landscapeHeightFrac: 0.8,
  landscapeXFrac: 0.5,
  landscapeYFrac: 0.53,
  portraitWidthFrac: 0.82,
  portraitXFrac: 0.5,
  portraitYFrac: 0.46,
};

export function practiceLayout(w: number, h: number): PhotoLayout {
  return photoLayout(w, h, PRACTICE_COMPOSITION);
}

/** PRACTICE opacity: resolves out of the record's own fade (overlap, same
 *  grammar), holds, then dissolves toward the dusk THE WEIRD ONES opens
 *  from — the swing/build convention of composing a soft exit rather than
 *  a hard stop at the segment boundary. */
const PRACTICE_FADE_IN: readonly [number, number] = [0.72, 0.82];
const PRACTICE_FADE_OUT: readonly [number, number] = [0.955, 1.0];

export function practiceOpacity(t: number): number {
  const b = bandProgress(t);
  const fadeIn = smooth((b - PRACTICE_FADE_IN[0]) / (PRACTICE_FADE_IN[1] - PRACTICE_FADE_IN[0]));
  const fadeOut = 1 - smooth((b - PRACTICE_FADE_OUT[0]) / (PRACTICE_FADE_OUT[1] - PRACTICE_FADE_OUT[0]));
  return Math.min(fadeIn, fadeOut);
}

/** Any of the three visuals still has visible pixels — the R3F layer's own
 *  cheap early-out, independent of sceneActive's camera-ownership range
 *  (mirrors builderRig's anyPanelVisible / dadRig's anyDadVisible). */
export function anyBandVisible(t: number): boolean {
  return (
    gigOpacity(t) > 0.0005 || recordOpacity(t) > 0.0005 || practiceOpacity(t) > 0.0005
  );
}
