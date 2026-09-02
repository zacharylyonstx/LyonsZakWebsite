// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/cine/cameraRig.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
// Cine-mode camera math: URL <-> camera-state (de)serialization, yaw/pitch
// helpers (kept consistent with systems/CameraRig.tsx's 'YXZ' Euler + the
// -sin(yaw)/-cos(yaw) forward convention used throughout PlayerController.tsx
// and net/room.ts), and a simple CatmullRom-interpolated keyframe flythrough
// for capturing an authored camera path (the "R" key in CineApp).
//
// Pure math / data — no React, no three.js scene graph — so it's easy to unit
// reason about and reuse from both the CineApp scene (R3F, inside <Canvas>)
// and any future prerender/capture tooling outside it.

import { CatmullRomCurve3, Vector3 } from 'three';

/** A camera pose: where it sits, what point it looks at, and its FOV (deg). */
export interface CineCameraState {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

/** A pose plus a playback time (seconds) for the authored flythrough path. */
export interface CineKeyframe extends CineCameraState {
  t: number;
}

export const PITCH_LIMIT = Math.PI / 2 - 0.05;
/** How far ahead of the camera the `look` point sits when derived from yaw/pitch. */
const LOOK_DISTANCE = 20;

/** Sensible default: standing near the cul-de-sac bulb center looking south
 *  toward the hero house (10600, ~[0, _, 38] — see world/houses.ts + streetLayout's
 *  houseTransform for angleDeg 90 / radiusOffset 6) for a street-level establishing shot. */
export const DEFAULT_CINE_CAMERA: CineCameraState = {
  pos: [0, 4, 4],
  look: [0, 2.5, 38],
  fov: 60,
};

/** The hero-moment departure path (Task 7): STARTS at the exact camera.json pose
 *  matched to the real backyard photo (trampoline + "68" playhouse, from the back
 *  deck), then pulls straight up above the yard, turns ~180° in the air to swing
 *  from facing the backyard (+Z) to facing the street (-Z), and flies forward/down
 *  over the roofline, descending to pass right by the mailbox (world ~[11, 0, 9.25]
 *  — see Yard.tsx's mailboxZ for 10600) low and still moving, continuing on down
 *  the street. ~10s:
 *    0.0–1.3s  pull up (rise straight above the matched pose, still facing the yard)
 *    1.3–5.2s  keep rising well above the hero house's hipped roof (peak ~10.5m —
 *              see HeroHouse10600's wallH + depth/4) before crossing over it, so
 *              the flythrough clears the roof with real margin instead of clipping
 *              through shingles; look target swings around to the street mid-climb
 *    5.2–7.5s  fly forward over the roof toward the front yard/street, descending
 *    7.5–10s   arrival: low, arriving right at the mailbox, still flying forward. */
export const CINE_PLACEHOLDER_PATH: CineKeyframe[] = [
  { t: 0, pos: [4.8, 1.95, 47.4], look: [5.274412074794912, 0.28955773821781583, 67.32530714138622], fov: 66 },
  { t: 1.3, pos: [4.8, 6, 47], look: [4.8, 4, 60], fov: 64 },
  { t: 3, pos: [4.8, 15, 45], look: [4.8, 10, 60], fov: 60 },
  { t: 5.2, pos: [2, 18, 38], look: [-2, 11, 10], fov: 55 },
  { t: 7.5, pos: [0, 19, 24], look: [-3, 9, -10], fov: 52 },
  { t: 10, pos: [9, 5, 8], look: [10, 1.5, -18], fov: 50 },
];

// ---- yaw/pitch <-> look-point conversions --------------------------------
// Convention matches systems/CameraRig.tsx: camera.quaternion.setFromEuler(new
// Euler(pitch, yaw, 0, 'YXZ')) with yaw=0,pitch=0 facing -Z. Forward vector:
//   dir = (-sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch))
// (same as PlayerController's `fx = -Math.sin(heading); fz = -Math.cos(heading)`.)

export function yawPitchToDir(yaw: number, pitch: number): Vector3 {
  const cp = Math.cos(pitch);
  return new Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

export function yawPitchToLook(pos: Vector3, yaw: number, pitch: number, dist = LOOK_DISTANCE): Vector3 {
  return pos.clone().addScaledVector(yawPitchToDir(yaw, pitch), dist);
}

export function lookToYawPitch(pos: Vector3, look: Vector3): { yaw: number; pitch: number } {
  const dir = look.clone().sub(pos);
  const len = dir.length();
  if (len < 1e-6) return { yaw: 0, pitch: 0 };
  dir.divideScalar(len);
  const pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.asin(Math.max(-1, Math.min(1, dir.y)))));
  const yaw = Math.atan2(-dir.x, -dir.z);
  return { yaw, pitch };
}

// ---- URL <-> camera state --------------------------------------------------

/** Parse `?cam=<base64 JSON>`; falls back to DEFAULT_CINE_CAMERA on any error
 *  (missing param, bad base64, malformed/partial JSON — never throws). */
export function parseCamParam(raw: string | null): CineCameraState {
  if (!raw) return DEFAULT_CINE_CAMERA;
  try {
    const json = atob(raw);
    const parsed = JSON.parse(json) as Partial<CineCameraState>;
    const pos = asVec3(parsed.pos) ?? DEFAULT_CINE_CAMERA.pos;
    const look = asVec3(parsed.look) ?? DEFAULT_CINE_CAMERA.look;
    const fov = typeof parsed.fov === 'number' && Number.isFinite(parsed.fov) ? parsed.fov : DEFAULT_CINE_CAMERA.fov;
    return { pos, look, fov };
  } catch {
    return DEFAULT_CINE_CAMERA;
  }
}

/** Inverse of parseCamParam — used by the `P` key to emit a `&cam=...` you
 *  can paste straight back into the URL. */
export function encodeCamParam(state: CineCameraState): string {
  return btoa(JSON.stringify(state));
}

function asVec3(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const [x, y, z] = v;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return null;
  if (![x, y, z].every(Number.isFinite)) return null;
  return [x, y, z];
}

// ---- Keyframe flythrough (CatmullRom) --------------------------------------

export function totalPathDuration(keyframes: CineKeyframe[]): number {
  return keyframes.length ? keyframes[keyframes.length - 1].t : 0;
}

/** Map elapsed seconds -> the [0,1] curve parameter CatmullRomCurve3.getPoint
 *  expects, honoring each keyframe's authored `t` (not just its index) so
 *  unevenly-spaced keyframes still play back at the right pace. */
function elapsedToCurveU(keyframes: CineKeyframe[], elapsed: number): number {
  const n = keyframes.length;
  if (n < 2) return 0;
  if (elapsed <= keyframes[0].t) return 0;
  if (elapsed >= keyframes[n - 1].t) return 1;
  for (let i = 0; i < n - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (elapsed >= a.t && elapsed <= b.t) {
      const span = b.t - a.t;
      const local = span > 1e-6 ? (elapsed - a.t) / span : 0;
      return (i + local) / (n - 1);
    }
  }
  return 1;
}

/** Sample the authored path at `elapsed` seconds. Position + look-point are
 *  each run through their own CatmullRomCurve3 (simple, smooth, no external
 *  deps beyond three); FOV is linearly interpolated between the bracketing
 *  keyframes. Clamped to the path's ends outside [0, total]. */
export function sampleCinePath(keyframes: CineKeyframe[], elapsed: number): CineCameraState & { pos3: Vector3; look3: Vector3 } {
  if (keyframes.length === 0) {
    return { ...DEFAULT_CINE_CAMERA, pos3: new Vector3(...DEFAULT_CINE_CAMERA.pos), look3: new Vector3(...DEFAULT_CINE_CAMERA.look) };
  }
  if (keyframes.length === 1) {
    const k = keyframes[0];
    return { pos: k.pos, look: k.look, fov: k.fov, pos3: new Vector3(...k.pos), look3: new Vector3(...k.look) };
  }
  const posCurve = new CatmullRomCurve3(keyframes.map((k) => new Vector3(...k.pos)), false, 'catmullrom', 0.5);
  const lookCurve = new CatmullRomCurve3(keyframes.map((k) => new Vector3(...k.look)), false, 'catmullrom', 0.5);
  const u = elapsedToCurveU(keyframes, elapsed);
  const pos3 = posCurve.getPoint(u);
  const look3 = lookCurve.getPoint(u);

  // FOV: find the bracketing pair and lerp linearly (fov doesn't need curvature).
  const n = keyframes.length;
  let fov = keyframes[n - 1].fov;
  for (let i = 0; i < n - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (elapsed >= a.t && elapsed <= b.t) {
      const span = b.t - a.t;
      const local = span > 1e-6 ? (elapsed - a.t) / span : 0;
      fov = a.fov + (b.fov - a.fov) * local;
      break;
    }
  }
  if (elapsed <= keyframes[0].t) fov = keyframes[0].fov;

  return { pos: [pos3.x, pos3.y, pos3.z], look: [look3.x, look3.y, look3.z], fov, pos3, look3 };
}
