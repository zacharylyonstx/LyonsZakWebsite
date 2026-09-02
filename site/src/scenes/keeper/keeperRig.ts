// THE KEEPER's rig — Scene 7, [0.86, 1.0]. The final scene and the film's
// cadence. Same discipline as every rig before it: every number the scene
// draws from is a PURE function of journey position + viewport; nothing
// reads a clock; frames = f(scroll) by construction. The ONE wall-clock
// element this scene owns (the candle-lit plaque's playing video texture)
// never touches this file — it lives entirely in the <video> element's own
// decode state, THE WEIRD ONES's own signed-exception pattern, second and
// last use in the film (see KeeperScene.tsx's header + scene7-report.md).
//
// Composition (the scene brief + docs/v2-direction.md §7) — the thesis
// lands here: the same hands that write software carve wood, tend the
// archive, and keep things from vanishing. Four beats:
//
//   BEAT 1 — THE SIGN (b in [0, SIGN_END], t ≈ 0.86–0.90). The hand-built
//   TEXAS sign at dusk — backlit carved lettering, the UT tower model, the
//   longhorn cutout, string lights: the film's best pure light. Given the
//   full depth-mesh treatment (its depth map rated "Excellent" —
//   finalization.md: sign / longhorn / tower / tree / angel separate into
//   distinct bands), breathing slowly on THE DAD's own windowPulse dolly.
//
//   BEAT 2 — THE KEEPING (b in [SIGN_END, KEEP_END], t ≈ 0.90–0.94). The
//   candle-lit plaque for Luke (2026 — the library's most recent maker
//   artifact: current, not archival) as a small glowing object in the dark:
//   an 8s silent excerpt where the carving reads, played as a video texture
//   through the standard panel material — the real flame's flicker is the
//   point (the brief's own cost-benefit call, decided FOR the video).
//   Penny's keepsake box rides secondary/deeper (the CenTex two-panel
//   convention) — "notes to my kids," plural, made visually true.
//
//   BEAT 3 — THEN/NOW (b in [KEEP_END, THEN_END], t ≈ 0.94–0.97). Zak's
//   finale pair (day one → now; the friend diptych was removed 2026-09-01)
//   person, ~15 years apart (zak-himself.md's own catalog entry), a
//   composition HE already made. Staged as-is (the album-art precedent: an
//   already-composed artifact keeps its author's own grade). It holds in
//   silence first; one deadpan line lands late.
//
//   BEAT 4 — THE SIGNATURE (b in [THEN_END, 1], t ≈ 0.97–1.0). Dusk deepens
//   back to the site's ground; the display type returns once, small and
//   calm, and the contact block arrives as real DOM (KeeperScene.tsx's
//   KeeperEndCard — endCardOpacity below is its only animation input). The
//   scrollbar ends here; the t=1 frame must be beautiful at rest.
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import { FOV_DEG, REST_Z } from '../drummer/drummerRig';
import { windowPulse } from '../dad/dadRig';
import { WEIRD_END } from '../weird/weirdRig';
import featherJson from './feather.json';

export { FOV_DEG, REST_Z };

const KEEPER = SEGMENTS.keeper;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Local progress through the keeper segment (0..1; 1 past its end). */
export function keeperProgress(t: number): number {
  return segmentProgress(t, KEEPER);
}

/** Whether the scene renders/writes the camera at all. No exit TAIL — this
 *  is the film's last scene: active from its own start through t=1 and any
 *  overscroll clamp beyond it (segmentProgress saturates at 1, so the t=1
 *  frame is the terminal state by construction). */
export function sceneActive(t: number): boolean {
  return t >= KEEPER[0];
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE WEIRD ONES's exact exit pose — composing from this (never a
 *  hand-copied number) makes the seam exact: at b=0 every drift term below
 *  is zero and cameraPose(KEEPER_START) collapses to precisely this value
 *  (pinned in keeperRig.test.ts). */
const EXIT: CameraPose = WEIRD_END;

/** Reference viewing distance for this segment's layout math (every prior
 *  rig's REF_Z convention: the camera's own actual arrival distance). */
const REF_Z = EXIT.z;

/** Beat boundaries, in segment-local progress b — chosen so they land
 *  exactly on the brief's own t=0.90 / 0.94 / 0.97 (the segment is 0.14
 *  wide: 2/7 -> 0.90, 4/7 -> 0.94, 11/14 -> 0.97). */
export const SIGN_END = 2 / 7; // t = 0.90
export const KEEP_END = 4 / 7; // t = 0.94
export const THEN_END = 11 / 14; // t = 0.97

/** Camera drift, four phases, deltas ADDED to EXIT (so at b=0 the sum is
 *  exactly EXIT). Beat 1 pushes gently up toward the sign's lettering;
 *  beat 2 leans down-left toward the small glowing plaque; beat 3
 *  recenters and starts easing back; beat 4 is the exhale — a slow pull
 *  back as everything dissolves to the ground and the end card arrives. */
const D1: CameraPose = { x: 0.04, y: 0.018, z: -0.1 };
const D2: CameraPose = { x: -0.07, y: -0.024, z: -0.09 };
const D3: CameraPose = { x: 0.03, y: 0.01, z: 0.12 };
const D4: CameraPose = { x: 0, y: -0.004, z: 0.16 };

/** Depth-breathing inside the sign's own hold (THE DAD's windowPulse dolly
 *  — exactly 0 at both window edges BY CONSTRUCTION, so it can never seam
 *  against the phase drifts), plus a much smaller breath on the diptych
 *  hold so "let it breathe" is literal without ever calling attention to
 *  itself. */
const SIGN_BREATHE: readonly [number, number] = [0.05, 0.24];
const SIGN_BREATH_Z = 0.08;
const SIGN_BREATH_X = 0.03;
const THEN_BREATHE: readonly [number, number] = [0.6, 0.76];
const THEN_BREATH_Z = 0.05;

/**
 * The scene camera as f(journey t). reducedMotion pins it at the shared
 * rest pose — identical to every prior scene's reduced-motion behavior.
 */
export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const b = keeperProgress(t);
  const drift1 = smooth(b / SIGN_END);
  const drift2 = smooth((b - SIGN_END) / (KEEP_END - SIGN_END));
  const drift3 = smooth((b - KEEP_END) / (THEN_END - KEEP_END));
  const drift4 = smooth((b - THEN_END) / (1 - THEN_END));
  const breatheSign = -windowPulse(b, SIGN_BREATHE[0], SIGN_BREATHE[1]);
  const breatheThen = -windowPulse(b, THEN_BREATHE[0], THEN_BREATHE[1]);
  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(
      EXIT.x +
        D1.x * drift1 +
        D2.x * drift2 +
        D3.x * drift3 +
        D4.x * drift4 +
        SIGN_BREATH_X * -breatheSign,
    ),
    y: nz(EXIT.y + D1.y * drift1 + D2.y * drift2 + D3.y * drift3 + D4.y * drift4),
    z:
      EXIT.z +
      D1.z * drift1 +
      D2.z * drift2 +
      D3.z * drift3 +
      D4.z * drift4 +
      SIGN_BREATH_Z * breatheSign +
      THEN_BREATH_Z * breatheThen,
  };
}

/** The film's final camera pose — cameraPose at t=1 (all four drifts at 1,
 *  both breathe windows closed). Documented for completeness: nothing
 *  composes FROM it, but the t=1 frame is the page's terminal state and
 *  this is where the camera rests in it. */
export const KEEPER_END: CameraPose = cameraPose(KEEPER[1], false);

export interface FeatherShape {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Edge feather widths (UV fractions), single source (feather.json) shared
 *  with prepare-assets.mjs's fallback bakes — the standing anti-drift
 *  pattern, extended: this scene carries TWO shapes (the photo feather for
 *  sign/box/diptych, and a much wider one for the plaque video, whose
 *  near-black surround must dissolve into the dusk with no readable
 *  rectangle at all). */
export const FEATHER: FeatherShape = featherJson.photo;
export const PLAQUE_FEATHER: FeatherShape = featherJson.plaque;

/** Half the vertical FOV, in radians. */
const HALF_FOV_RAD = (FOV_DEG * Math.PI) / 360;

function worldPerPxAt(distance: number, viewportHeight: number): number {
  return (2 * distance * Math.tan(HALF_FOV_RAD)) / viewportHeight;
}

export function isPortrait(w: number, h: number): boolean {
  return h > w * 1.05 || w < 720;
}

// ---------------------------------------------------------------------------
// Fade windows — mug.ts's 4-point [inStart, inEnd, outStart, outEnd] shape in
// ABSOLUTE segment progress (weirdRig's own generalization), so every
// beat boundary is a real cross-dissolve, never a blank frame.
// ---------------------------------------------------------------------------

type FadeWindow = readonly [inStart: number, inEnd: number, outStart: number, outEnd: number];

function smoothstep(edge0: number, edge1: number, x: number): number {
  return smooth((x - edge0) / (edge1 - edge0));
}

function windowOpacity(p: number, [inStart, inEnd, outStart, outEnd]: FadeWindow): number {
  const fadeIn = smoothstep(inStart, inEnd, p);
  const fadeOut = 1 - smoothstep(outStart, outEnd, p);
  return clamp01(Math.min(fadeIn, fadeOut));
}

/** Arrives straight out of the TV's own dissolve (weirdRig's TV_FADE_WINDOW
 *  ends exactly at the segment boundary), fades out straddling SIGN_END
 *  (2/7 ≈ 0.286) into the plaque's fade-in — the standing cross-dissolve
 *  overlap. */
const SIGN_FADE: FadeWindow = [0, 0.055, 0.22, 0.31];
const PLAQUE_FADE: FadeWindow = [0.26, 0.35, 0.53, 0.61];
/** Arrives a touch after the plaque, leaves a touch before it (bandRig's
 *  own "the two never feel synchronized" reasoning). */
const PENNY_FADE: FadeWindow = [0.31, 0.4, 0.5, 0.575];
/** The finale triptych's shared window: day one arrives, Penny then Luke
 *  resolve through it (CARRY_MIX_1/2 below), and it leaves under the end
 *  card's own arrival — a true cross-dissolve, the film's last. */
const FINALE_FADE: FadeWindow = [0.56, 0.63, 0.81, 0.87];
/** The signature: the end card resolves out of the deepening dusk and holds
 *  through t=1 (outStart/outEnd past 1 — it never leaves). */
const ENDCARD_FADE: FadeWindow = [0.845, 0.925, 2, 3]; // (was [0.8, 0.885]: under the 2026-09-01 triptych the card's text was rising through Luke's frame on portrait)

export function signOpacity(t: number): number {
  return windowOpacity(keeperProgress(t), SIGN_FADE);
}

export function plaqueOpacity(t: number): number {
  return windowOpacity(keeperProgress(t), PLAQUE_FADE);
}

export function pennyOpacity(t: number): number {
  return windowOpacity(keeperProgress(t), PENNY_FADE);
}

/** The end card's opacity — the ONLY animation input KeeperEndCard has.
 *  Pure f(t), holds 1.0 at the journey's end (the terminal frame). */
export function endCardOpacity(t: number): number {
  return windowOpacity(keeperProgress(t), ENDCARD_FADE);
}

// ---------------------------------------------------------------------------
// Beat 1 — THE SIGN: dad-rig photoLayout convention (rect-first: the rect IS
// the composition; the mesh transform derives from it).
// ---------------------------------------------------------------------------

/** 08a-texas-sign-dusk-graded.jpg — 3024x4032 upright (finalization.md). */
export const SIGN_ASPECT = 3024 / 4032;

/** World-unit depth relief as a fraction of the mesh's world width. The
 *  sign's depth map separates cleanly into bands (sign / longhorn / tower /
 *  tree / angel), but the carved lettering is geometric — relief above this
 *  starts to warp the letterforms during the breathing dolly (tuned by eye
 *  against screenshots at the breath extremes, the dad-rig method). */
const SIGN_DEPTH_SCALE_FRACTION = 0.08;

export interface PhotoLayout {
  rect: { left: number; top: number; width: number; height: number };
  worldPerPx: number;
  meshScale: number;
  meshX: number;
  meshY: number;
  depthScale: number;
  portrait: boolean;
}

const SIGN_COMPOSITION = {
  // Sized so the photo's bottom edge (plus its feather) clears the
  // subtitle lower third — the voice line must never sit ON the sign's own
  // carved lettering (caught live at the first screenshot pass: at 0.85
  // height the film subtitle landed directly over the TEXAS letters, two
  // texts fighting — see scene7-report.md).
  landscapeHeightFrac: 0.78,
  landscapeXFrac: 0.5,
  landscapeYFrac: 0.47,
  portraitWidthFrac: 0.88,
  portraitXFrac: 0.5,
  portraitYFrac: 0.42,
};

export function signLayout(w: number, h: number): PhotoLayout {
  const portrait = isPortrait(w, h);
  let width: number;
  let height: number;
  let left: number;
  let top: number;
  if (portrait) {
    width = SIGN_COMPOSITION.portraitWidthFrac * w;
    height = width / SIGN_ASPECT;
    left = SIGN_COMPOSITION.portraitXFrac * w - width / 2;
    top = SIGN_COMPOSITION.portraitYFrac * h - height / 2;
  } else {
    height = SIGN_COMPOSITION.landscapeHeightFrac * h;
    width = height * SIGN_ASPECT;
    left = SIGN_COMPOSITION.landscapeXFrac * w - width / 2;
    top = SIGN_COMPOSITION.landscapeYFrac * h - height / 2;
  }
  const worldPerPx = worldPerPxAt(REF_Z, h);
  const meshScale = width * worldPerPx;
  const cx = left + width / 2;
  const cy = top + height / 2;
  return {
    rect: { left, top, width, height },
    worldPerPx,
    meshScale,
    meshX: (cx - w / 2) * worldPerPx,
    meshY: (h / 2 - cy) * worldPerPx,
    depthScale: SIGN_DEPTH_SCALE_FRACTION * meshScale,
    portrait,
  };
}

// ---------------------------------------------------------------------------
// Beats 2-3 — flat panels at depth (weirdRig's panel-spec convention: the
// plaque video primary/near, Penny's box secondary/far, the diptych alone
// and centered).
// ---------------------------------------------------------------------------

export type KeeperPanelId = 'plaque' | 'penny' | 'carry';

/** keeper-plaque-loop.mp4 / keeper-plaque-static.jpg — 608x1080. */
export const PLAQUE_ASPECT = 608 / 1080;
/** keeper-pennybox-still-graded.jpg — 2160x3000 (cropped at derive time —
 *  see prepare-assets.mjs's entry). */
export const PENNY_ASPECT = 2160 / 3000;
/** dayone.jpg / now-penny.jpg / now-luke.jpg — the finale triptych
 *  (continuity re-cut, 2026-09-01, Zak's call: the friend diptych is gone;
 *  the finale premieres his kids). DAY ONE is the 2017 delivery-room
 *  photograph (Zak holding newborn Penny); then Penny on his shoulders,
 *  arms out, and Luke on his shoulders, laughing — both January 2025, the
 *  same live-oak grove, all three 3:4 portraits (round2-archaeology.md
 *  §2). Two dissolves as keeper progress advances; scrubbing back rewinds. */
export const CARRY_ASPECT = 3 / 4;

interface KeeperPanelSpec {
  z: number;
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

export const KEEPER_PANEL_SPECS: Record<KeeperPanelId, KeeperPanelSpec> = {
  plaque: {
    z: 0.5,
    rotY: -0.05,
    aspect: PLAQUE_ASPECT,
    landscapeHeightFrac: 0.62,
    landscapeXFrac: 0.38,
    landscapeYFrac: 0.5,
    // Portrait: the two objects STACK (plaque above, box below-right) with
    // only feather-zone contact — iterated live at 390x844 until neither
    // wood-burned note hides behind the other and the two-line subtitle
    // keeps the lower third.
    portraitHeightFrac: 0.44,
    portraitXFrac: 0.5,
    portraitYFrac: 0.34,
    fadeWindow: PLAQUE_FADE,
  },
  penny: {
    z: -0.8,
    rotY: 0.12,
    aspect: PENNY_ASPECT,
    // Large enough that the wood-burned note actually READS at panel size
    // — the note is the payoff, not the box (bumped from 0.34 after the
    // first screenshot pass).
    landscapeHeightFrac: 0.4,
    landscapeXFrac: 0.7,
    landscapeYFrac: 0.44,
    // Portrait: see the plaque's portrait note above — below the plaque,
    // clear of the subtitle.
    portraitHeightFrac: 0.2,
    portraitXFrac: 0.62,
    portraitYFrac: 0.7,
    fadeWindow: PENNY_FADE,
  },
  // The finale frame: one portrait, DAY ONE beneath NOW (two stacked panels
  // share this layout; carryMix drives the dissolve). Every edition uses
  // it — reduced motion allows dissolves (docs/v2-direction.md), no-WebGL
  // crossfades two DOM images by the same math.
  carry: {
    z: 0.1,
    rotY: 0,
    aspect: CARRY_ASPECT,
    // Same subtitle-clearance reasoning as the sign: the closing lines sit
    // in the lower third; the frame stops above them.
    landscapeHeightFrac: 0.7,
    landscapeXFrac: 0.5,
    landscapeYFrac: 0.44,
    // Portrait: width = heightFrac * 844 * 0.75 must clear a 390px viewport
    // with margin (pinned in keeperRig.test.ts).
    portraitHeightFrac: 0.5,
    portraitXFrac: 0.5,
    portraitYFrac: 0.4,
    fadeWindow: FINALE_FADE,
  },
};

/** Two dissolves, one after the other, never overlapping: day one → Penny
 *  on his shoulders, then Penny → Luke on his shoulders (the same grove,
 *  the same January 2025 session — they cut as one moment). Each starts
 *  after the panel's fade-in (b 0.56-0.63) and the pair resolves before
 *  the panel's fade-out (0.81). Scrubbing backward rewinds both — the
 *  whole grammar. */
const CARRY_MIX_1: readonly [number, number] = [0.655, 0.715];
const CARRY_MIX_2: readonly [number, number] = [0.735, 0.795];

/** Day one → Penny (0 = the delivery room, 1 = Penny on his shoulders). */
export function carryMix(t: number): number {
  return smoothstep(CARRY_MIX_1[0], CARRY_MIX_1[1], keeperProgress(t));
}

/** Penny → Luke (0 until carryMix has fully resolved). */
export function carryMix2(t: number): number {
  return smoothstep(CARRY_MIX_2[0], CARRY_MIX_2[1], keeperProgress(t));
}

export interface KeeperPanelLayout {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotY: number;
}

/** Where a panel sits in WORLD space for a given viewport — a pure function
 *  of (w, h) against the arrival reference distance (weirdRig's
 *  weirdPanelLayout convention: the panel's world transform only reacts to
 *  viewport size; the live camera's own motion produces its parallax). */
export function keeperPanelLayout(id: KeeperPanelId, w: number, h: number): KeeperPanelLayout {
  const spec = KEEPER_PANEL_SPECS[id];
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

export function keeperPanelOpacity(id: KeeperPanelId, t: number): number {
  return windowOpacity(keeperProgress(t), KEEPER_PANEL_SPECS[id].fadeWindow);
}

// ---------------------------------------------------------------------------
// THE KEEPER'S EASTER EGG (ship-pass item 2b) — an invisible click region
// over the TEXAS lettering itself, in the sign photo's own UV space
// (top-left origin, matching `signLayout().rect`) — same approximation-of-
// depth-relief convention as drummerRig's own drum-kit hotspot (see that
// file's header comment).
// ---------------------------------------------------------------------------

export const SIGN_TEXT_FRAC = { x: 0.51, y: 0.865, halfW: 0.42, halfH: 0.085 };

export function signTextAnchorWorld(w: number, h: number): { x: number; y: number; z: number } {
  const lay = signLayout(w, h);
  const cx = lay.rect.left + SIGN_TEXT_FRAC.x * lay.rect.width;
  const cy = lay.rect.top + SIGN_TEXT_FRAC.y * lay.rect.height;
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

/** Screen-space projection — bandRig.projectPoint's math, duplicated per the
 *  house convention (see drummerRig's identical function for the same
 *  reasoning). */
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

/** The hotspot/glow's own CSS-px footprint at a given projected depth —
 *  drumKitHotspotSize's identical reasoning, anchored to the sign's own
 *  REF_Z reference distance rather than REST_Z (signLayout is built against
 *  REF_Z, THE WEIRD ONES's own arrival distance — see this file's REF_Z
 *  doc comment). */
export function signTextHotspotSize(
  w: number,
  h: number,
  depth: number,
): { width: number; height: number } {
  const lay = signLayout(w, h);
  const restWidth = SIGN_TEXT_FRAC.halfW * 2 * lay.rect.width;
  const restHeight = SIGN_TEXT_FRAC.halfH * 2 * lay.rect.height;
  const scale = REF_Z / Math.max(depth, 1e-4);
  return { width: restWidth * scale, height: restHeight * scale };
}

/** Whether the hotspot is interactive right now — only during the sign's
 *  own hold (drumKitHotspotActive's identical reasoning). */
export function signHotspotActive(t: number): boolean {
  return signOpacity(t) > 0.5;
}

/** Any of this scene's WebGL visuals still has visible pixels — the R3F
 *  layer's own cheap early-out (the standing anyXVisible convention). The
 *  end card is DOM and deliberately not part of this. */
export function anyKeeperVisible(t: number): boolean {
  return (
    signOpacity(t) > 0.0005 ||
    keeperPanelOpacity('plaque', t) > 0.0005 ||
    keeperPanelOpacity('penny', t) > 0.0005 ||
    keeperPanelOpacity('carry', t) > 0.0005
  );
}
