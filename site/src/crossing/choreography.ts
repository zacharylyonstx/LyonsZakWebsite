// The crossing's choreography — a pure function of crossing progress p ∈ [0,1].
// EXTRACTED from site/experiments/a2-crossing/src/timeline.ts (production-slice
// Task 2). The math is the experiment's, unchanged; what moved OUT is
// ownership: the experiment mapped its own page scroll (spacer height ×
// viewport heights) onto p — the production caller supplies p directly (the
// site timeline owns scroll), and REGION_RELEASE now lives in releases.ts.
//
// Choreography (proven in the experiment):
//   p 0.00–0.20  PHASE 1 — depth-mesh dolly (Task 6 style): the photo breathes
//                awake with true parallax, settles back to dead-center, then a
//                fov-only zoom carries momentum into the swap. Over p 0.16–0.20
//                the mesh layer crossfades into the projected world at the
//                matched pose — invisible, because BOTH layers are exact 2D
//                crops of the same photograph at that moment (the depth mesh
//                because its camera is back at the displacement origin, the
//                world because projective texturing from the matched position
//                is an identity mapping).
//   p 0.20–1.00  PHASE 2 — departure along the Task 7 path; the photo peels
//                off the world's true geometry as parallax disagrees, the
//                grade releases, and Royal Tara Cove becomes itself.
//
// Everything below is a pure function of `p` — scrubbing backward replays the
// exact same states in reverse (no accumulated state anywhere).

import { MathUtils, Vector3 } from 'three';
import {
  CINE_PLACEHOLDER_PATH,
  sampleCinePath,
} from '../world-rtc/game/cine/cameraRig';
import { MATCHED_POSE, PHOTO_ASPECT } from './matchedPose';
import { ALL_RELEASED_P, REGION_RELEASE, type RegionName } from './releases';

const PHASE1_END = 0.2;
const CROSSFADE_START = 0.16;

// Phase-1 motion (all settled back to neutral by u = RETURN_END, before the
// crossfade window opens at u = 0.8)
const RETURN_END = 0.78;
/** Base vertical fov of the depth-mesh photo layer's camera. The mesh layer
 *  (CrossingScene) and this module must agree on it — single definition. */
export const MESH_FOV_BASE = 45;
const DOLLY_FRACTION = 0.13;
const LATERAL_PEAK = 0.05; // world units; mesh width = 1
const ZOOM_END = 1.1; // fov-only zoom factor carried across the swap
const PATH_DURATION = 10; // seconds authored in CINE_PLACEHOLDER_PATH

export interface MeshCamState {
  /** distance from the mesh plane as a fraction of the solved rest distance */
  distanceFactor: number;
  lateralX: number;
  fovDeg: number;
  depthScaleFactor: number; // 0..1 ramp on the mesh's displacement
}

export interface WorldCamState {
  pos: Vector3;
  look: Vector3;
  fovDeg: number;
}

export interface TimelineState {
  p: number;
  phase: 1 | 2;
  pathT: number; // seconds along the departure path (0 during phase 1)
  meshOpacity: number; // 1 = photo layer fully covers the world layer
  meshCam: MeshCamState;
  world: WorldCamState;
  photoStrength: number;
  departFacing: number;
  gradeStrength: number;
  netFade: number;
  skyFade: number;
  /** Authored per-region release values (0 photo -> 1 game), from REGION_RELEASE. */
  regionRelease: Record<RegionName, number>;
  /** Game-text (troika "68" plaque etc.) fade-in — rides the playhouse reveal. */
  textFade: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Vertical fov that makes the visitor camera's frustum "cover"-fit the
 *  photo's frustum at the matched pose (same crop math as CSS object-fit:
 *  cover): equal HORIZONTAL fov on wide viewports, equal VERTICAL fov on
 *  narrow/portrait ones. */
export function coverVfovDeg(viewportAspect: number): number {
  const tanHalfPhoto = Math.tan(MathUtils.degToRad(MATCHED_POSE.fov / 2));
  const tanHalf = tanHalfPhoto * Math.min(1, PHOTO_ASPECT / viewportAspect);
  return MathUtils.radToDeg(2 * Math.atan(tanHalf));
}

function zoomedFov(baseFovDeg: number, zoom: number): number {
  return MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(baseFovDeg / 2)) / zoom));
}

const MATCHED_POS = new Vector3(...MATCHED_POSE.pos);
const MATCHED_LOOK = new Vector3(...MATCHED_POSE.look);

export function computeTimeline(p: number, viewportAspect: number): TimelineState {
  const coverV = coverVfovDeg(viewportAspect);

  if (p <= PHASE1_END) {
    const u = clamp01(p / PHASE1_END);
    const bell = Math.sin(Math.PI * clamp01(u / RETURN_END)); // 0 -> 1 -> 0, settled by RETURN_END
    const zoom = 1 + (ZOOM_END - 1) * smoothstep(0.55, 1, u);
    return {
      p,
      phase: 1,
      pathT: 0,
      meshOpacity: 1 - smoothstep(CROSSFADE_START, PHASE1_END, p),
      meshCam: {
        distanceFactor: 1 - DOLLY_FRACTION * bell,
        lateralX: LATERAL_PEAK * bell,
        fovDeg: zoomedFov(MESH_FOV_BASE, zoom),
        depthScaleFactor: smoothstep(0.03, 0.35, u),
      },
      world: {
        pos: MATCHED_POS.clone(),
        look: MATCHED_LOOK.clone(),
        // lockstep zoom with the mesh layer: both show the identical 2D crop
        fovDeg: zoomedFov(coverV, zoom),
      },
      photoStrength: 1,
      departFacing: 0,
      gradeStrength: 1,
      netFade: 1,
      skyFade: 1,
      regionRelease: {
        kids: 0, trampoline: 0, playhouse: 0, canopy: 0, sky: 0, ground: 0, rest: 0,
      },
      textFade: 0,
    };
  }

  const v = clamp01((p - PHASE1_END) / (1 - PHASE1_END));
  const t = v * PATH_DURATION;
  const sample = sampleCinePath(CINE_PLACEHOLDER_PATH, t);

  // ease from the cover/zoom-matched fov into the authored path fov
  const fovDeg = MathUtils.lerp(zoomedFov(coverV, ZOOM_END), sample.fov, smoothstep(0, 1.8, t));

  const dist = sample.pos3.distanceTo(MATCHED_POS);

  // The peel itself is authored per region (REGION_RELEASE); photoStrength is
  // only the outer envelope now — full until every region has released, then
  // a short global fade catches any residue (and arms the shader's fast path
  // for the street reveal). The old time/distance fade is retired: it made
  // held regions (the kids!) translucent mid-hold — the "residue slab" look.
  const photoStrength = 1 - smoothstep(ALL_RELEASED_P + 0.02, ALL_RELEASED_P + 0.1, p);

  const regionRelease = {} as Record<RegionName, number>;
  for (const name of Object.keys(REGION_RELEASE) as RegionName[]) {
    const [s, e] = REGION_RELEASE[name];
    regionRelease[name] = smoothstep(s, e, p);
  }

  return {
    p,
    phase: 2,
    pathT: t,
    meshOpacity: 0,
    meshCam: {
      distanceFactor: 1,
      lateralX: 0,
      fovDeg: zoomedFov(MESH_FOV_BASE, ZOOM_END),
      depthScaleFactor: 1,
    },
    world: { pos: sample.pos3, look: sample.look3, fovDeg },
    photoStrength,
    // The parallax-error guards (visibility/facing/smear/distance/sky-only)
    // ramp with the camera's METRIC distance from the matched pose, not path
    // time: at the exact pose they can only cause acne on a perfect identity;
    // at ~0.1m the projection is still visually identical (guards stay off —
    // no early pale disocclusion pockets); by 0.6m they are fully engaged
    // (no photo painting through occluders, no drippy grazing smears, no
    // frieze on the sky backstop). Tuned tight so the partial-guard morph is
    // a brief beat right after the swap instead of a lingering half-leak.
    departFacing: smoothstep(0.05, 0.6, dist),
    gradeStrength: 1 - smoothstep(1.5, 6.5, t),
    // Safety envelopes only (the real dissolves are region-driven in the
    // shader): the net receiver outlives the kids' window, the sky backstop
    // outlives the sky window, then both stop rasterizing.
    netFade: 1 - smoothstep(REGION_RELEASE.kids[1], REGION_RELEASE.kids[1] + 0.05, p),
    skyFade: 1 - smoothstep(REGION_RELEASE.sky[1], REGION_RELEASE.sky[1] + 0.08, p),
    regionRelease,
    textFade: regionRelease.playhouse,
  };
}
