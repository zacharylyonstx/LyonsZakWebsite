// THE WEIRD ONES's rig — Scene 6, [0.74, 0.86]. Same discipline as every
// rig before it: every number the scene draws from is a PURE function of
// journey position + viewport; nothing reads a clock; frames = f(scroll) by
// construction. The one wall-clock element this scene owns (the EAS
// broadcast's playing video texture) never touches this file — it lives
// entirely in the <video> element's own decode state, exactly the
// desksweep.mjs precedent (v1 archive) of pinning/excluding a playing video
// from byte-determinism checks rather than pretending it doesn't exist.
//
// Composition (the scene brief + docs/v2-direction.md §6): the model-break
// beat. The stranger thinks they've mapped Zak (engineer, dad, drummer) —
// this scene breaks the model twice.
//
//   BEAT 1 — CENTEX (b in [0, CENTEX_END], t in [0.74, 0.79]). The MF-1 PCB
//   macro arrives as a beautiful object floating in the dusk (primary, near,
//   large — builderRig's kaelbot convention); the CenTex banner selfie
//   arrives smaller/secondary (builderRig's milieuos convention — further,
//   smaller, softer). A small mono museum label ("MF-1 — CENTEX PARANORMAL,
//   2015" — the year is real: IMG_1056's own capture date, osxphotos-
//   verified) tracks the MF-1 panel exactly like THE BUILDER's own
//   panel-caption. Voice line 1.
//
//   BEAT 2 — THE BROADCAST (b in [CENTEX_END, 1], t in [0.79, 0.86]). A
//   period TV set (tvMaterial.ts's own bezel+screen shader — a rounded-rect
//   CRT-style frame, not a 3D model) sits in the dark, playing Zak's
//   fabricated EAS broadcast silently on loop (the signed wall-clock
//   exception — see tvMaterial.ts/WeirdScene.tsx headers). Voice line 2.
//   The TV glints; opening the pocket plays the real payoff (tinfoil hats +
//   Luke's punchline, WITH sound) — see pockets/alienPrank.ts. Camera
//   converges on WEIRD_END, documented for THE KEEPER to compose from.
//
// NO DEPTH MESH: like THE BAND, none of these four visuals (MF-1, banner,
// TV) have a matching depth map, so all are flat panels at different world
// depths — builderRig's own "stills + parallax" physics (a moving camera
// against fixed depth-SEPARATED geometry produces real parallax without any
// per-vertex displacement).
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import { FOV_DEG, REST_Z } from '../drummer/drummerRig';
import { TEASPANKS_END } from '../teaspanks/teaspanksRig';
import featherJson from './feather.json';

export { FOV_DEG, REST_Z };

const WEIRD = SEGMENTS.weird;

/** Small exit tail past the segment's own end — mirrors every prior scene's
 *  TAIL: THE KEEPER composes from WEIRD_END, a real converged pose. */
const TAIL = 0.02;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Local progress through the weird segment (0..1; 1 past its end). */
export function weirdProgress(t: number): number {
  return segmentProgress(t, WEIRD);
}

/** Whether the scene renders/writes the camera at all. */
export function sceneActive(t: number): boolean {
  return t >= WEIRD[0] && t < WEIRD[1] + TAIL;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE BAND's exact exit pose — composing from this (not a hand-copied
 *  number) makes the seam exact: at b=0 every drift term below is zero and
 *  cameraPose(WEIRD_START) collapses to precisely this value (pinned in
 *  weirdRig.test.ts). */
const EXIT: CameraPose = TEASPANKS_END; // (was BAND_END before the 2026-09-01 TEASPANKS chapter)

/** Reference viewing distance for this segment's panel sizing (every prior
 *  rig's REF_Z convention: the camera's own actual arrival distance). */
const REF_Z = EXIT.z;

/** Beat boundary, in segment-local progress b — chosen so it lands exactly
 *  on the brief's own t=0.79 (mirrors bandRig's GIG_END convention: 5/12 of
 *  a 0.12-wide segment is exactly 0.05, i.e. t = 0.74 + 0.05 = 0.79). */
export const CENTEX_END = 5 / 12; // t = 0.79

/** Camera drift, two phases, deltas ADDED to EXIT (so at b=0 the sum is
 *  exactly EXIT). Beat 1 pushes gently in and left toward the MF-1 panel;
 *  beat 2 pulls back and settles center for the TV in the dark room,
 *  converging on WEIRD_END. */
const D1: CameraPose = { x: -0.05, y: 0.014, z: -0.12 };
const D2: CameraPose = { x: 0.05, y: -0.026, z: -0.08 };

/**
 * The scene camera as f(journey t). reducedMotion pins it at the shared
 * rest pose — identical to every prior scene's reduced-motion behavior.
 */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const b = weirdProgress(t);
  const drift1 = smooth(b / CENTEX_END);
  const drift2 = smooth((b - CENTEX_END) / (1 - CENTEX_END));
  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(EXIT.x + D1.x * drift1 + D2.x * drift2),
    y: nz(EXIT.y + D1.y * drift1 + D2.y * drift2),
    z: EXIT.z + D1.z * drift1 + D2.z * drift2,
  };
}

/** The pose THE KEEPER should compose from — cameraPose at the segment's
 *  end (both drift terms at 1). */
export const WEIRD_END: CameraPose = cameraPose(WEIRD[1], false);

/** Edge feather widths (UV fractions) for the two beat-1 photo planes —
 *  single source (feather.json), the standing anti-drift pattern. */
export const FEATHER: { left: number; right: number; top: number; bottom: number } =
  featherJson;

/** Half the vertical FOV, in radians. */
const HALF_FOV_RAD = (FOV_DEG * Math.PI) / 360;

function worldPerPxAt(distance: number, viewportHeight: number): number {
  return (2 * distance * Math.tan(HALF_FOV_RAD)) / viewportHeight;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

/** Screen-space projection of a world point through the given camera pose —
 *  the standing house convention (builderRig/bandRig's own projectPoint),
 *  re-created locally rather than cross-imported. */
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

// ---------------------------------------------------------------------------
// Beat 1 — CENTEX. Two panels at different world depths (builderRig's
// PANEL_SPECS/panelLayout convention): MF-1 primary/near/large, the banner
// selfie secondary/far/smaller.
// ---------------------------------------------------------------------------

export type WeirdPanelId = 'mf1' | 'banner';

/** Both source photos share the same 3:4 portrait aspect: MF-1 is
 *  2448x3264 post-EXIF-rotate, the banner selfie is 960x1280 — both
 *  0.75 exactly (verified via `sips` on the graded files). */
export const MF1_ASPECT = 2448 / 3264;
export const BANNER_ASPECT = 960 / 1280;

/** A [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] envelope in
 *  ABSOLUTE segment progress b (0..1 across the WHOLE [0.74, 0.86]
 *  segment) — mug.ts's PocketScreenAnchor.window shape, generalized here
 *  because (unlike bandRig's own 3-point fadeEnvelope, which always starts
 *  rising at b=0) THE TV's own fade-in must start WELL INSIDE the segment,
 *  overlapping beat 1's own fade-out, so the transition is a real
 *  cross-dissolve rather than a blank frame at CENTEX_END. */
type FadeWindow = readonly [inStart: number, inEnd: number, outStart: number, outEnd: number];

function smoothstep(edge0: number, edge1: number, x: number): number {
  return smooth((x - edge0) / (edge1 - edge0));
}

function windowOpacity(p: number, [inStart, inEnd, outStart, outEnd]: FadeWindow): number {
  const fadeIn = smoothstep(inStart, inEnd, p);
  const fadeOut = 1 - smoothstep(outStart, outEnd, p);
  return clamp01(Math.min(fadeIn, fadeOut));
}

interface WeirdPanelSpec {
  /** World z — MF-1 sits nearer the camera (primary, held-up-close macro
   *  reading, builderRig.kaelbot's convention); the banner sits further
   *  back (secondary, smaller, softer — builderRig.milieuos's convention). */
  z: number;
  /** Static tilt around Y, radians. */
  rotY: number;
  aspect: number;
  landscapeHeightFrac: number;
  landscapeXFrac: number;
  landscapeYFrac: number;
  portraitHeightFrac: number;
  portraitXFrac: number;
  portraitYFrac: number;
  fadeWindow: FadeWindow;
}

export const WEIRD_PANEL_SPECS: Record<WeirdPanelId, WeirdPanelSpec> = {
  mf1: {
    z: 0.55,
    rotY: -0.09,
    aspect: MF1_ASPECT,
    landscapeHeightFrac: 0.62,
    landscapeXFrac: 0.36,
    landscapeYFrac: 0.52,
    portraitHeightFrac: 0.34,
    portraitXFrac: 0.4,
    portraitYFrac: 0.36,
    // Arrives immediately out of THE BAND's own dissolve (in starts at
    // b=0, the gig-photo precedent); its own fade-OUT deliberately
    // straddles CENTEX_END (0.4167) so beat 1 cross-dissolves into beat
    // 2's TV instead of leaving a blank frame at the boundary — see
    // TV_FADE_WINDOW below for the other half of this overlap.
    fadeWindow: [0, 0.05, 0.37, 0.47],
  },
  banner: {
    z: -0.9,
    rotY: 0.13,
    aspect: BANNER_ASPECT,
    landscapeHeightFrac: 0.3,
    landscapeXFrac: 0.73,
    landscapeYFrac: 0.32,
    portraitHeightFrac: 0.2,
    portraitXFrac: 0.64,
    portraitYFrac: 0.68,
    // Arrives a touch after MF-1, leaves a touch before it (bandRig's own
    // "the two never feel synchronized" reasoning).
    fadeWindow: [0.06, 0.15, 0.32, 0.42],
  },
};

export function isPortrait(w: number, h: number): boolean {
  return h > w * 1.05 || w < 720;
}

export interface WeirdPanelLayout {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotY: number;
}

/** Where a beat-1 panel sits in WORLD space for a given viewport — a pure
 *  function of (w, h) against the REST reference distance, builderRig's
 *  panelLayout convention: the panel's world transform only reacts to
 *  viewport size; the live camera's own motion produces its parallax. */
export function weirdPanelLayout(id: WeirdPanelId, w: number, h: number): WeirdPanelLayout {
  const spec = WEIRD_PANEL_SPECS[id];
  const portrait = isPortrait(w, h);
  const heightFrac = portrait ? spec.portraitHeightFrac : spec.landscapeHeightFrac;
  const xFrac = portrait ? spec.portraitXFrac : spec.landscapeXFrac;
  const yFrac = portrait ? spec.portraitYFrac : spec.landscapeYFrac;
  const wpp = worldPerPxAt(REF_Z - spec.z, h);
  const height = heightFrac * h * wpp;
  const width = height * spec.aspect;
  const x = (xFrac - 0.5) * wpp * w;
  const y = (0.5 - yFrac) * wpp * h;
  return { x, y, z: spec.z, width, height, rotY: spec.rotY };
}

/** A beat-1 panel's own opacity as f(journey t) — envelope in absolute
 *  segment progress (see WEIRD_PANEL_SPECS's own comment on why: its
 *  fadeOut deliberately straddles CENTEX_END so beat 1 cross-dissolves
 *  into beat 2's TV rather than leaving a blank frame at the boundary). */
export function weirdPanelOpacity(id: WeirdPanelId, t: number): number {
  return windowOpacity(weirdProgress(t), WEIRD_PANEL_SPECS[id].fadeWindow);
}

/** The museum-label anchor for the MF-1 panel — its bottom-left corner in
 *  world space, rotated by the panel's own static tilt (builderRig's
 *  captionAnchor convention exactly, this scene's own single label). */
export function mf1CaptionAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = weirdPanelLayout('mf1', w, h);
  const localX = -lay.width / 2;
  const localY = -lay.height / 2 - lay.height * 0.045;
  return {
    x: lay.x + localX * Math.cos(lay.rotY),
    y: lay.y + localY,
    z: lay.z - localX * Math.sin(lay.rotY),
  };
}

// ---------------------------------------------------------------------------
// Beat 2 — THE BROADCAST. A single TV object (tvMaterial.ts's bezel+screen
// shader), builderRig/bandRig's single-object-at-depth convention.
// ---------------------------------------------------------------------------

/** The TV's own outer-plane aspect (bezel included) — chosen so the SCREEN
 *  region inside it (after SCREEN_MARGIN below) reproduces the broadcast
 *  video's real 16:9 aspect without stretching. See tvMaterial.ts's header
 *  for the derivation: Ao = videoAspect * (1 - mt - mb) / (1 - ml - mr). */
export const TV_VIDEO_ASPECT = 1280 / 720;
export const SCREEN_MARGIN = { left: 0.07, right: 0.07, top: 0.08, bottom: 0.14 };
export const TV_OUTER_ASPECT =
  (TV_VIDEO_ASPECT * (1 - SCREEN_MARGIN.top - SCREEN_MARGIN.bottom)) /
  (1 - SCREEN_MARGIN.left - SCREEN_MARGIN.right);

/** World z — a touch further than the beat-1 panels' "z=0" reference plane,
 *  "sitting back in a dark room" rather than held up close. */
export const TV_WORLD_Z = -0.15;
/** A near-imperceptible static tilt — a TV set sitting square in a room,
 *  not an object being held at an angle (contrast with the record's -0.17
 *  in bandRig.ts, which IS meant to read as "held"). */
export const TV_ROT_Y = 0.035;

/** Landscape sizes the TV by HEIGHT fraction (a wide-but-not-huge object in
 *  a wide frame). Portrait sizes it by WIDTH fraction instead — the TV's
 *  own outer aspect (~1.6, landscape-shaped) would overflow a narrow
 *  viewport's edges if sized by height the same way (caught live: a first
 *  pass at heightFrac 0.34 overflowed a 390px-wide phone viewport by
 *  ~70px total — see scene6-report.md). Same asymmetry every full-bleed
 *  photo layout in this film already has (photoLayout's own
 *  portraitWidthFrac vs landscapeHeightFrac split), applied here to an
 *  object instead of a full-bleed photo. */
interface TvLandscapeComposition {
  heightFrac: number;
  xFrac: number;
  yFrac: number;
}
interface TvPortraitComposition {
  widthFrac: number;
  xFrac: number;
  yFrac: number;
}

const TV_LANDSCAPE: TvLandscapeComposition = { heightFrac: 0.58, xFrac: 0.5, yFrac: 0.48 };
const TV_PORTRAIT: TvPortraitComposition = { widthFrac: 0.86, xFrac: 0.5, yFrac: 0.4 };

export interface TvLayout {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotY: number;
}

/** Where the TV sits in WORLD space for a given viewport — same REST-camera
 *  convention as weirdPanelLayout/bandRig.recordLayout. */
export function tvLayout(w: number, h: number): TvLayout {
  const wpp = worldPerPxAt(REF_Z - TV_WORLD_Z, h);
  let width: number;
  let height: number;
  let xFrac: number;
  let yFrac: number;
  if (isPortrait(w, h)) {
    width = TV_PORTRAIT.widthFrac * w * wpp;
    height = width / TV_OUTER_ASPECT;
    xFrac = TV_PORTRAIT.xFrac;
    yFrac = TV_PORTRAIT.yFrac;
  } else {
    height = TV_LANDSCAPE.heightFrac * h * wpp;
    width = height * TV_OUTER_ASPECT;
    xFrac = TV_LANDSCAPE.xFrac;
    yFrac = TV_LANDSCAPE.yFrac;
  }
  const x = (xFrac - 0.5) * wpp * w;
  const y = (0.5 - yFrac) * wpp * h;
  return { x, y, z: TV_WORLD_Z, width, height, rotY: TV_ROT_Y };
}

/** The TV's own fade-in STARTS at b=0.36 — before CENTEX_END (0.4167) —
 *  deliberately overlapping the beat-1 panels' own fade-out above, so the
 *  beat boundary is a real cross-dissolve (both partially visible at
 *  CENTEX_END itself: mf1 ~0.55, tv ~0.36 opacity — pinned in
 *  weirdRig.test.ts) rather than a blank frame.
 *
 *  INTEGRATION PASS (2026-08-30): the fade-out now runs PAST the segment's
 *  own end (outEnd 1.04 in UNCLAMPED local progress — sceneActive's 0.02
 *  TAIL covers it), so the TV's ghost is still dissolving as THE KEEPER's
 *  sign rises from t=0.87 — a true cross-dissolve across the 6→7 seam
 *  instead of two settle-stops of empty dusk (the neighborhood hero layer's
 *  own HERO_CLEAR_T precedent, and scene 7's plaque-under-diptych double
 *  exposure in miniature). */
const TV_FADE_WINDOW: FadeWindow = [0.36, 0.5, 0.92, 1.04];

/** UNCLAMPED local progress — lets the TV's fade-out window extend past the
 *  segment end (see TV_FADE_WINDOW's note). windowOpacity's own smoothsteps
 *  clamp internally, so values outside [0,1] are safe by construction. */
function weirdProgressUnclamped(t: number): number {
  return (t - WEIRD[0]) / (WEIRD[1] - WEIRD[0]);
}

/** The TV's own opacity as f(journey t). */
export function tvOpacity(t: number): number {
  return windowOpacity(weirdProgressUnclamped(t), TV_FADE_WINDOW);
}

/** The discovery glint's own window — narrower than the TV's full hold, so
 *  it arrives once the visitor has had a moment to register "there's a TV
 *  here" and departs before the TV itself starts dissolving toward THE
 *  KEEPER. */
const GLINT_FADE_WINDOW: FadeWindow = [0.55, 0.62, 0.83, 0.89];

export function tvGlintOpacity(t: number): number {
  return windowOpacity(weirdProgress(t), GLINT_FADE_WINDOW);
}

/** The glint's own anchor: a point on the TV's screen, offset toward its
 *  upper-right quadrant (a natural "there's something here" spot, clear of
 *  the screen's own visual center) — bandRig.recordAffordanceAnchor's
 *  convention, rotated by the TV's own (near-zero) static tilt. */
export function tvGlintAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = tvLayout(w, h);
  const localX = lay.width * 0.22;
  const localY = lay.height * 0.06;
  return {
    x: lay.x + localX * Math.cos(lay.rotY),
    y: lay.y + localY,
    z: lay.z - localX * Math.sin(lay.rotY),
  };
}

/**
 * The discovery glint's own screen-space anchor, in viewport FRACTIONS
 * (0..1) — mug.ts/arrival.ts's own convention: a resize-recomputed, NOT
 * per-frame-tracked, static anchor (the established house pattern for every
 * <Pocket>-based glint in this codebase; RecordAffordance's own per-frame
 * DOM tracking is a deliberately DIFFERENT, bespoke pattern reserved for
 * non-Pocket affordances that must never hold scroll — see BandScene.tsx's
 * header). `cam` lets the caller pick the right reference pose per edition:
 * the live camera's own near-settled end pose (WEIRD_END) for the full
 * edition, or the shared REST pose for reducedMotion/no-WebGL (where the
 * fallback TV is itself projected through REST — WeirdScene.tsx's
 * WeirdFallback, bandRig.BandFallback's own convention). Documented,
 * honest imprecision (mug.ts's own precedent): early in the glint's fade-in
 * window the live camera hasn't fully reached WEIRD_END yet, so the glint
 * can sit a few px off the TV's own screen there — negligible given how
 * small this segment's own camera drift is (D2 in cameraPose above), and
 * the glint is a small round marker, not text that must not overlap art.
 */
export function weirdGlintAt(w: number, h: number, cam: CameraPose): { x: number; y: number } {
  const anchor = tvGlintAnchor(w, h);
  const screen = projectPoint(anchor, cam, w, h);
  return { x: screen.x / w, y: screen.y / h };
}

/** Any of this scene's visuals still has visible pixels — the R3F layer's
 *  own cheap early-out (builderRig.anyPanelVisible/bandRig.anyBandVisible's
 *  convention). */
export function anyWeirdVisible(t: number): boolean {
  return (
    weirdPanelOpacity('mf1', t) > 0.0005 ||
    weirdPanelOpacity('banner', t) > 0.0005 ||
    tvOpacity(t) > 0.0005
  );
}
