// TEASPANKS — the scene's pure math (the continuity re-cut's new chapter,
// 2026-09-01). One frame from the music video Zak shot for the song he made
// from Luke's HTeaO drive-through improv: Luke on a real kit, Penny on a toy
// mic, his own B&W/orange grade — held as a panel that quietly plays a
// silent excerpt of the video (the EAS-TV precedent), with a museum label
// and a WATCH pill (the pocket carries the real thing, sound on).
//
// Everything here is a pure function of journey position + viewport;
// nothing reads a clock; frames = f(scroll) by construction. The video
// loop is a signed determinism exception exactly like THE WEIRD ONES's TV
// (DETERMINISM.md §1) — pinned by the qa harness's --pinvideo.
import { SEGMENTS, segmentProgress } from '../../timeline/segments';
import { FOV_DEG, REST_Z } from '../drummer/drummerRig';
import { BAND_END, windowPulse } from '../band/bandRig';
import featherJson from './feather.json';

export { FOV_DEG, REST_Z };

const TS = SEGMENTS.teaspanks;

/** Past the segment end the scene keeps writing the camera for this long
 *  (journey-t) so the seam into THE WEIRD ONES composes from a converged
 *  pose (every prior scene's TAIL convention). */
const TAIL = 0.02;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

export function teaspanksProgress(t: number): number {
  return segmentProgress(t, TS);
}

export function sceneActive(t: number): boolean {
  return t >= TS[0] && t < TS[1] + TAIL;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
}

/** THE BAND's exact exit pose — composing from this (never a hand-copied
 *  number) makes the seam exact (pinned in teaspanksRig.test.ts). */
const EXIT: CameraPose = BAND_END;
const REF_Z = EXIT.z;

/** One slow push-in across the chapter (the frame is a video; the camera
 *  leans in to watch), plus a breath inside the hold. */
const D1 = { x: 0.03, y: 0.012, z: -0.16 };
const BREATHE: readonly [number, number] = [0.12, 0.72];
const BREATH_Z = 0.05;
const BREATH_X = -0.02;

export function cameraPose(t: number, reducedMotion = false): CameraPose {
  if (reducedMotion) return { x: 0, y: 0, z: REST_Z };
  const b = teaspanksProgress(t);
  const drift = smooth(b);
  const breathe = -windowPulse(b, BREATHE[0], BREATHE[1]);
  const nz = (v: number) => (v === 0 ? 0 : v); // never -0
  return {
    x: nz(EXIT.x + D1.x * drift + BREATH_X * breathe),
    y: nz(EXIT.y + D1.y * drift),
    z: EXIT.z + D1.z * drift + BREATH_Z * breathe,
  };
}

/** The pose THE WEIRD ONES composes from. */
export const TEASPANKS_END: CameraPose = cameraPose(TS[1], false);

export const FEATHER: { left: number; right: number; top: number; bottom: number } =
  featherJson;

/** The master is 3840x2158. */
export const PANEL_ASPECT = 3840 / 2158;

const HALF_FOV_RAD = (FOV_DEG * Math.PI) / 360;

function worldPerPxAt(distance: number, viewportHeight: number): number {
  return (2 * distance * Math.tan(HALF_FOV_RAD)) / viewportHeight;
}

export function isPortrait(w: number, h: number): boolean {
  return h > w * 1.05 || w < 720;
}

export interface PanelLayout {
  rect: { left: number; top: number; width: number; height: number };
  worldPerPx: number;
  meshScale: number;
  meshX: number;
  meshY: number;
  portrait: boolean;
}

const COMPOSITION = {
  // Sized so the label, the WATCH pill, and the subtitle stack under the
  // frame without touching (checked at 1600x1000: frame bottom ≈ 720px,
  // label ≈ 750, pill ≈ 800, subtitle ≈ 890).
  landscapeHeightFrac: 0.62,
  landscapeXFrac: 0.5,
  landscapeYFrac: 0.41,
  portraitWidthFrac: 0.92,
  portraitXFrac: 0.5,
  portraitYFrac: 0.4,
};

/** The frame at world z=0, laid out at the reference distance. */
export function panelLayout(w: number, h: number): PanelLayout {
  const portrait = isPortrait(w, h);
  let width: number;
  let height: number;
  let left: number;
  let top: number;
  if (portrait) {
    width = COMPOSITION.portraitWidthFrac * w;
    height = width / PANEL_ASPECT;
    left = COMPOSITION.portraitXFrac * w - width / 2;
    top = COMPOSITION.portraitYFrac * h - height / 2;
  } else {
    height = COMPOSITION.landscapeHeightFrac * h;
    width = height * PANEL_ASPECT;
    left = COMPOSITION.landscapeXFrac * w - width / 2;
    top = COMPOSITION.landscapeYFrac * h - height / 2;
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
    portrait,
  };
}

type FadeWindow = readonly [inStart: number, inEnd: number, outStart: number, outEnd: number];

function smoothstep(edge0: number, edge1: number, x: number): number {
  return smooth((x - edge0) / (edge1 - edge0));
}

function windowOpacity(p: number, [inStart, inEnd, outStart, outEnd]: FadeWindow): number {
  const fadeIn = smoothstep(inStart, inEnd, p);
  const fadeOut = 1 - smoothstep(outStart, outEnd, p);
  return clamp01(Math.min(fadeIn, fadeOut));
}

/** THE CHAPTER'S THREE BEATS (2026-09-03, Zak's own retelling): the lyric
 *  Luke sang, alone on the dusk like a title card; the frame of the video
 *  arriving as the lyric leaves; the two pills (HEAR the song, WATCH the
 *  video) once the frame holds. The BAND's practice frame has already
 *  dissolved by the segment start, so the first 700px of this chapter is
 *  clean dusk + the lyric — the register break the model-expansion law
 *  asks for, staged as typography before it's staged as a video. */
const LYRIC_FADE: FadeWindow = [0.05, 0.13, 0.36, 0.44];
/** The frame arrives as the lyric goes, leaves before the segment end so
 *  THE WEIRD ONES's MF-1 rises into clean dusk. */
const PANEL_FADE: FadeWindow = [0.36, 0.48, 0.86, 0.96];
/** The label and the pills: on through the hold, off before the frame
 *  starts leaving (a pill must never be clickable mid-dissolve). */
const PILL_FADE: FadeWindow = [0.5, 0.58, 0.8, 0.86];

export function lyricOpacity(t: number): number {
  return windowOpacity(teaspanksProgress(t), LYRIC_FADE);
}

/** The lyric's rise (px): settles from +14 to 0 as it fades in, drifts on
 *  to −10 as it fades out — a pure function of progress, reversible. */
export function lyricRisePx(t: number): number {
  const p = teaspanksProgress(t);
  const arrive = smoothstep(LYRIC_FADE[0], LYRIC_FADE[1], p);
  const leave = smoothstep(LYRIC_FADE[2], LYRIC_FADE[3], p);
  return 14 * (1 - arrive) - 10 * leave;
}

export function panelOpacity(t: number): number {
  return windowOpacity(teaspanksProgress(t), PANEL_FADE);
}

export function pillOpacity(t: number): number {
  return windowOpacity(teaspanksProgress(t), PILL_FADE);
}

export function anyTeaspanksVisible(t: number): boolean {
  return panelOpacity(t) > 0.0005;
}

/** Museum-label anchor (world): under the frame's left edge in landscape;
 *  ABOVE the frame in portrait (the pill takes the room below). */
export function labelAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = panelLayout(w, h);
  const worldWidth = lay.meshScale;
  const worldHeight = lay.meshScale / PANEL_ASPECT;
  const x = lay.meshX - worldWidth / 2 + 0.015 * worldWidth;
  const y = lay.portrait
    ? lay.meshY + worldHeight / 2 + 0.07 * worldHeight
    : lay.meshY - worldHeight / 2 - 0.045 * worldHeight;
  return { x, y, z: 0 };
}

/** Pill-group anchor (world) — HEAR + WATCH ride one projected point.
 *  Landscape: the group's RIGHT edge sits under the frame's right edge, on
 *  the label's own row (the subtitle owns the lower third — a centered
 *  pill collided with it, caught live). Portrait: centered under the frame
 *  (the label is above it there), the pills stacked. The component applies
 *  the matching transform (see pillAlign). */
export function pillAnchor(w: number, h: number): { x: number; y: number; z: number } {
  const lay = panelLayout(w, h);
  const worldWidth = lay.meshScale;
  const worldHeight = lay.meshScale / PANEL_ASPECT;
  if (lay.portrait) {
    return { x: lay.meshX, y: lay.meshY - worldHeight / 2 - 0.16 * worldHeight, z: 0 };
  }
  return {
    x: lay.meshX + worldWidth / 2 - 0.01 * worldWidth,
    y: lay.meshY - worldHeight / 2 - 0.06 * worldHeight,
    z: 0,
  };
}

/** Which edge of the pill the anchor marks. */
export function pillAlign(w: number, h: number): 'center' | 'right' {
  return isPortrait(w, h) ? 'center' : 'right';
}

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
