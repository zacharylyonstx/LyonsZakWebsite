// ARRIVAL — beat 4's camera + the mailbox glint anchor, as pure math.
// PORTED from archive/2026-08-29-slice-attempt-1 (site/src/scenes/
// arrivalChoreography.ts), the settle that shipped in the proven v1 slice:
// keyframe 0 is the departure path's final keyframe VERBATIM (continuity by
// construction — pinned in neighborhoodRig.test.ts), the deceleration curls
// back and sinks to street level on the lawn of 10600, the LYONS mailbox a
// few meters ahead at the curb, the straight street running 165m north past
// it. The portrait settle is the archive's re-COMPOSITION (not a crop): the
// tall frame rests nearer the mailbox's own bearing so it reads mid-frame on
// a phone. What changed for v2: the segment/settle constants live in
// neighborhoodRig.ts (STREET, ARRIVAL_SETTLE_AT), the ONE line lives in
// film/voice.ts like every other voice line (no separate hero-line layer),
// and stillGlintAt serves the static edition's captured settle frames.
import { PerspectiveCamera, Vector3 } from 'three';
import {
  CINE_PLACEHOLDER_PATH,
  sampleCinePath,
  type CineKeyframe,
} from '../../world-rtc/game/cine/cameraRig';
import type { WorldCamState } from '../../crossing/choreography';
import { ARRIVAL_SETTLE_AT } from './neighborhoodRig';

const DEPARTURE_END: CineKeyframe =
  CINE_PLACEHOLDER_PATH[CINE_PLACEHOLDER_PATH.length - 1];

/** The archive's landscape settle, verbatim (Task 7 + Task 11's foreground
 *  re-compose — see the archived module's own history note). */
const ARRIVAL_PATH: CineKeyframe[] = [
  { t: 0, pos: DEPARTURE_END.pos, look: DEPARTURE_END.look, fov: DEPARTURE_END.fov },
  { t: 2.4, pos: [7.6, 2.9, 5.8], look: [7, 1.3, -26], fov: 48 },
  { t: 6, pos: [9.4, 1.66, 14.2], look: [5.9, 1.08, -35], fov: 46 },
];

/** The archive's portrait re-composition (Task 9), verbatim. */
const ARRIVAL_PATH_PORTRAIT: CineKeyframe[] = [
  { t: 0, pos: DEPARTURE_END.pos, look: DEPARTURE_END.look, fov: DEPARTURE_END.fov },
  { t: 2.4, pos: [8.4, 2.9, 5.8], look: [9.2, 1.3, -26], fov: 55 },
  { t: 6, pos: [10.2, 1.7, 13.8], look: [10.6, 1.05, -30], fov: 57 },
];

const ARRIVAL_DURATION = ARRIVAL_PATH[ARRIVAL_PATH.length - 1].t;

function easeOutCubic(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/**
 * The street camera as f(street-local q): fast out of the gate (the flight
 * is still moving at q=0), zero velocity at ARRIVAL_SETTLE_AT, exactly still
 * after. Fed to CrossingScene's worldCamOverride whenever the journey is in
 * the street window — the explicit camera-authority handoff.
 */
export function computeArrivalCamera(
  q: number,
  portrait = false,
): WorldCamState {
  const eased = easeOutCubic(q / ARRIVAL_SETTLE_AT);
  const sample = sampleCinePath(
    portrait ? ARRIVAL_PATH_PORTRAIT : ARRIVAL_PATH,
    eased * ARRIVAL_DURATION,
  );
  return { pos: sample.pos3, look: sample.look3, fovDeg: sample.fov };
}

/** A point just above the LYONS mailbox's head (name Text at local y≈1.0 —
 *  Mailbox.tsx), so the glint reads as "something about the mailbox". */
export const RTC_GLINT_WORLD: readonly [number, number, number] = [
  11, 1.45, 9.25,
];

/** Portrait settle stands ~4.6m from the box (vs ~7m) — a lower hover keeps
 *  "about the mailbox" true at the closer framing (archive Task 9). */
export const RTC_GLINT_WORLD_PORTRAIT: readonly [number, number, number] = [
  11, 1.3, 9.25,
];

const scratchCam = new PerspectiveCamera();
const scratchVec = new Vector3();

/** Projects a world point through a settled WorldCamState at an arbitrary
 *  frustum aspect → frame fractions (origin top-left). */
function projectThroughSettled(
  cam: WorldCamState,
  aspect: number,
  point: readonly [number, number, number],
): { x: number; y: number; behind: boolean } {
  scratchCam.fov = cam.fovDeg;
  scratchCam.aspect = aspect;
  scratchCam.near = 0.1;
  scratchCam.far = 600;
  scratchCam.updateProjectionMatrix();
  scratchCam.position.copy(cam.pos);
  scratchCam.lookAt(cam.look);
  scratchCam.updateMatrixWorld(true);
  scratchVec.set(...point).project(scratchCam);
  return {
    x: (scratchVec.x + 1) / 2,
    y: (1 - scratchVec.y) / 2,
    behind: scratchVec.z >= 1,
  };
}

const inMargin = (v: number) => v > 0.04 && v < 0.96;

/**
 * Viewport-fraction glint position under the SETTLED arrival camera at the
 * given viewport aspect (Pocket.tsx's PocketGlintAt convention), plus the
 * honesty guard: `inFrame` false means the glint stays inert rather than
 * glinting somewhere that isn't the mailbox. Pure of its argument; the
 * mounting scene recomputes on resize only (the window only opens once the
 * camera has landed, where this static projection is exact).
 */
export function arrivalGlintAt(viewportAspect: number): {
  x: number;
  y: number;
  inFrame: boolean;
} {
  const portrait = viewportAspect < 1;
  const cam = computeArrivalCamera(1, portrait);
  const p = projectThroughSettled(
    cam,
    viewportAspect,
    portrait ? RTC_GLINT_WORLD_PORTRAIT : RTC_GLINT_WORLD,
  );
  const inFrame = !p.behind && inMargin(p.x) && inMargin(p.y);
  return { x: p.x, y: p.y, inFrame };
}

// ---------------------------------------------------------------------------
// Static-edition glint anchor: the reduced-motion / no-WebGL editions hold a
// CAPTURED render of this exact settle (public/nbhd-world-still*.jpg,
// landscape 4:3 / portrait 3:4), cover-fitted — so the anchor is the same
// settled-pose projection through the CAPTURE frustum, then mapped through
// the cover-fit crop (the archive's essentialGlintAt math, verbatim).
// ---------------------------------------------------------------------------

/** Capture aspects of the two staged stills (see prepare-assets.mjs). */
export const STILL_CAPTURE_ASPECT = { landscape: 4 / 3, portrait: 3 / 4 };

export function stillGlintAt(viewportAspect: number): {
  x: number;
  y: number;
  inFrame: boolean;
} {
  const portrait = viewportAspect < 1;
  const imgAspect = portrait
    ? STILL_CAPTURE_ASPECT.portrait
    : STILL_CAPTURE_ASPECT.landscape;
  const cam = computeArrivalCamera(1, portrait);
  const img = projectThroughSettled(
    cam,
    imgAspect,
    portrait ? RTC_GLINT_WORLD_PORTRAIT : RTC_GLINT_WORLD,
  );
  let sx = 1;
  let sy = 1;
  if (viewportAspect > imgAspect) sy = imgAspect / viewportAspect;
  else sx = viewportAspect / imgAspect;
  const ox = (1 - sx) / 2;
  const oy = (1 - sy) / 2;
  const x = (img.x - ox) / sx;
  const y = (img.y - oy) / sy;
  const inFrame = !img.behind && inMargin(x) && inMargin(y);
  return { x, y, inFrame };
}
