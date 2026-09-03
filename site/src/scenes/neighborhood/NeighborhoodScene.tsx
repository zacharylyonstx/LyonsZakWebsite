// Scene 4 — THE NEIGHBORHOOD. The film's center: the half-built playhouse at
// night → the finished backyard photograph → THE CROSSING into the live
// Royal Tara Cove world → street travel → the LYONS mailbox and the game
// invitation → dusk falls, composing toward THE BAND.
//
// Three components (see neighborhoodRig.ts for the beat map):
//
//   NeighborhoodPhotos — the SHELL-canvas half (beat 1): the build frame as
//   a depth mesh in App's main Canvas, camera composed from DAD_END, plus
//   the whole-segment camera glide that converges on NEIGHBORHOOD_END for
//   THE BAND. Mounts as a later sibling of DadPhotos (camera priority).
//
//   NeighborhoodHeroDom — the DOM half of beats 2–4 (full edition): the
//   fixed hero layer carrying <CrossingScene> (early-mounted at App boot so
//   its refresh() precompiles during scenes 1–3), the honest held-photo
//   backstop, the work-light bloom that bridges night→day, the dusk veil,
//   and the mailbox pocket — the invitation to play the real game (see
//   rtcInvite.ts; formerly the Luke-clip pocket, retired here per the
//   2026-08-30 controller ruling — that clip now lives only in Scene 6's
//   alien-prank pocket). Publishes the journey<->crossing mapping on
//   crossingDebug.heroMap for scripts/qa.mjs.
//
//   NeighborhoodStill — the static edition (reduced motion, and the DOM half
//   of no-WebGL): the archive's proven before/after composition — the real
//   photograph dissolving to a real render of the settled street, at the
//   same scroll positions, with the same voice lines and the same pocket.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { makeDepthMesh } from '../../crossing/makeDepthMesh';
import { CrossingScene } from '../../crossing/CrossingScene';
import { loadCrossingAssets } from '../../crossing/loader';
import { patchNbhdMaterial, type NbhdUniforms } from './patchNbhdMaterial';
import { DAD_END } from '../dad/dadRig';
import {
  NEIGHBORHOOD_END,
  FOV_DEG,
  STREET,
  RTC_GLINT_WINDOW,
  bloomAnchorPx,
  bloomOpacity,
  buildLayout,
  buildOpacity,
  cameraPose,
  crossingActive,
  crossingPToJourneyT,
  duskVeilOpacity,
  heroLayerOpacity,
  journeyToCrossingP,
  sceneActive,
  stillWorldOpacity,
  streetProgress,
} from './neighborhoodRig';
import { arrivalGlintAt, computeArrivalCamera, stillGlintAt } from './arrival';
import { RtcInvitePocket } from '../../pockets/RtcInvitePocket';
import { RtcPlayLink } from './RtcPlayLink';
import { anchorOpacity } from '../../pockets/mug';
import type { PocketHandle } from '../../pockets/Pocket';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import { filmHeight } from '../../timeline/filmViewport';

export { NEIGHBORHOOD_END };

const BUILD_PHOTO_URL = '/assets/nbhd/build.jpg';
const BUILD_DEPTH_URL = '/assets/nbhd/build-depth.png';
const HELD_PHOTO_URL = '/photo.jpg';
const STILL_LANDSCAPE_URL = '/nbhd-world-still.jpg';
const STILL_PORTRAIT_URL = '/nbhd-world-still-portrait.jpg';

/** Mesh grid resolution — the dad/drummer choice; the stud framing has no
 *  finer depth structure than a person/room scene. */
const SEGMENTS_RES = 320;

// ---------------------------------------------------------------------------
// Shell-canvas half (beat 1).
// ---------------------------------------------------------------------------

interface BuildAssets {
  photo: THREE.Texture;
  depth: THREE.Texture;
}

let buildAssetsPromise: Promise<BuildAssets> | null = null;

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

function loadBuildAssets(): Promise<BuildAssets> {
  if (!buildAssetsPromise) {
    buildAssetsPromise = Promise.all([
      loadTexture(BUILD_PHOTO_URL),
      loadTexture(BUILD_DEPTH_URL),
    ]).then(([photo, depth]) => {
      // Raw bytes in, raw bytes out — the standing texture discipline.
      for (const tex of [photo, depth]) {
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
      }
      return { photo, depth };
    });
  }
  return buildAssetsPromise;
}

export function NeighborhoodPhotos({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const [assets, setAssets] = useState<BuildAssets | null>(null);

  useEffect(() => {
    let alive = true;
    loadBuildAssets().then((a) => {
      if (alive) setAssets(a);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rig = useMemo(() => {
    if (!assets) return null;
    const mesh = makeDepthMesh(assets.photo, assets.depth, { segments: SEGMENTS_RES });
    const uniforms: NbhdUniforms = patchNbhdMaterial(mesh);
    // Displace from THE DAD's exit pose — the point the live camera actually
    // occupies as this scene opens (dadRig's REF_Z reasoning).
    (mesh.material as THREE.ShaderMaterial).uniforms.uDisplaceOrigin.value.set(
      DAD_END.x,
      DAD_END.y,
      DAD_END.z,
    );
    return { mesh, uniforms };
  }, [assets]);

  useEffect(() => {
    if (!rig) return;
    return () => {
      rig.mesh.geometry.dispose();
      (rig.mesh.material as THREE.Material).dispose();
    };
  }, [rig]);

  useFrame(({ camera, size }) => {
    const t = timeline.value();

    if (!sceneActive(t)) {
      if (rig) rig.mesh.visible = false;
      return;
    }

    const pose = cameraPose(t, reducedMotion);
    camera.position.set(pose.x, pose.y, pose.z);
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.fov !== undefined && pc.fov !== FOV_DEG) {
      pc.fov = FOV_DEG;
      pc.updateProjectionMatrix();
    }

    if (rig) {
      const o = buildOpacity(t);
      rig.mesh.visible = o > 0.0005;
      if (rig.mesh.visible) {
        const lay = buildLayout(size.width, size.height);
        rig.mesh.scale.setScalar(lay.meshScale);
        rig.mesh.position.set(lay.meshX, lay.meshY, 0);
        rig.uniforms.uOpacity.value = o;
        (rig.mesh.material as THREE.ShaderMaterial).uniforms.uDepthScale.value =
          lay.depthScale;
      }
    }
  });

  return <>{rig && <primitive object={rig.mesh} />}</>;
}

// ---------------------------------------------------------------------------
// The DOM half — full edition.
// ---------------------------------------------------------------------------

function viewportAspect(): number {
  if (typeof window === 'undefined') return 16 / 10;
  return window.innerWidth / Math.max(1, filmHeight());
}

function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

export function NeighborhoodHeroDom({
  timeline,
}: {
  timeline: ScrollTimeline;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<PocketHandle>(null);
  // Gates only the held-photo backstop's removal — the crossing waits on the
  // same memoized promise internally.
  const [ready, setReady] = useState(false);
  // Whether the crossing should be RENDERING — flips near the segment's
  // doorstep, tested against value AND target so a fling starts the renderer
  // during the damped transit, not after it.
  const [active, setActive] = useState(false);

  const [glintAt, setGlintAt] = useState(() => arrivalGlintAt(viewportAspect()));
  const glintRefState = useRef(glintAt);
  glintRefState.current = glintAt;

  // EARLY MOUNT (the inherited hard requirement): kick the staged load the
  // moment the app boots — scenes 1–3 are the load beat. CrossingScene
  // mounts (behind the invisible layer) as soon as the shared promise
  // resolves, and its mount-time refresh() precompiles every shader long
  // before a visitor can scroll here.
  useEffect(() => {
    let mounted = true;
    loadCrossingAssets(null, (p) => {
      if (import.meta.env.DEV) {
        console.info(`[nbhd load] ${p.stage} ${p.loaded}/${p.total}`);
      }
    })
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch((err) => {
        console.error('[nbhd] crossing asset load failed:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Glint anchor + bloom anchor are pure functions of the viewport —
  // recompute on resize only.
  useEffect(() => {
    const compute = () => {
      setGlintAt(arrivalGlintAt(viewportAspect()));
      const bloom = bloomRef.current;
      if (bloom) {
        const a = bloomAnchorPx(window.innerWidth, filmHeight());
        bloom.style.left = `${a.x.toFixed(1)}px`;
        bloom.style.top = `${a.y.toFixed(1)}px`;
      }
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Per-frame drive: layer/veil/bloom opacity (imperative style writes, zero
  // re-renders), the activation flip (React bails out when unchanged), and
  // the glint envelope.
  useEffect(() => {
    return timeline.onFrame((value, target) => {
      const layer = layerRef.current;
      if (layer) {
        const o = heroLayerOpacity(value);
        layer.style.opacity = o.toFixed(4);
        layer.style.visibility = o <= 0 ? 'hidden' : 'visible';
      }
      if (veilRef.current) {
        veilRef.current.style.opacity = duskVeilOpacity(value).toFixed(4);
      }
      if (bloomRef.current) {
        bloomRef.current.style.opacity = bloomOpacity(value).toFixed(4);
      }
      setActive(crossingActive(value, target));
      pocketRef.current?.setGlintOpacity(
        glintRefState.current.inFrame
          ? anchorOpacity(streetProgress(value), RTC_GLINT_WINDOW)
          : 0,
      );
    });
  }, [timeline]);

  // Dev/QA hook: the journey<->crossing mapping (single source of truth in
  // neighborhoodRig.ts) published where scripts/qa.mjs already looks, plus
  // the settled arrival pose (the still-capture script reads it).
  useEffect(() => {
    if (!debugEnabled()) return;
    window.crossingDebug = Object.assign(window.crossingDebug ?? {}, {
      heroMap: { tForP: crossingPToJourneyT, pForT: journeyToCrossingP },
      poseArrival: (q: number, portrait: boolean) => {
        const c = computeArrivalCamera(q, portrait);
        return {
          pos: { x: c.pos.x, y: c.pos.y, z: c.pos.z },
          look: { x: c.look.x, y: c.look.y, z: c.look.z },
          fovDeg: c.fovDeg,
        };
      },
    });
  }, []);

  // Referentially STABLE getters — with CrossingScene's internal memo
  // wrappers, the `active` flip and the backstop's removal never reconcile
  // the vendored world tree.
  const getProgress = useMemo(
    () => () => journeyToCrossingP(timeline.value()),
    [timeline],
  );
  const getWorldCamOverride = useMemo(
    () => () => {
      const t = timeline.value();
      if (t < STREET[0]) return null;
      // Portrait picks the re-composed tall-frame settle — read per frame so
      // a rotation mid-street recomposes live.
      const portrait = window.innerWidth < filmHeight();
      return computeArrivalCamera(streetProgress(t), portrait);
    },
    [timeline],
  );

  return (
    <>
      <div ref={layerRef} className="nbhd-hero" aria-hidden="true">
        {/* The honest held-photo backstop: the same photograph the crossing
            renders, cover-fit, for a visitor who outruns the staged load —
            "not loaded yet" and "loaded, holding" look like the same held
            photograph. No spinner theater. */}
        {!ready && <img className="nbhd-held-photo" src={HELD_PHOTO_URL} alt="" />}
        <CrossingScene
          progress={getProgress}
          active={active}
          worldCamOverride={getWorldCamOverride}
        />
        {/* Dusk falls over Royal Tara Cove after the camera settles — INSIDE
            the layer so it inherits the segment-end dissolve. */}
        <div ref={veilRef} className="nbhd-veil" aria-hidden="true" />
      </div>
      {/* The work-light bloom (night→day bridge) — OUTSIDE the layer so it
          leads the crossfade instead of riding the layer's own opacity. */}
      <div ref={bloomRef} className="nbhd-bloom" aria-hidden="true" />
      <RtcInvitePocket ref={pocketRef} glintAt={glintAt} timeline={timeline} />
      <RtcPlayLink timeline={timeline} anchor={glintAt} />
    </>
  );
}

// ---------------------------------------------------------------------------
// The static edition (reduced motion / no WebGL): before → after, honestly.
// ---------------------------------------------------------------------------

export function NeighborhoodStill({
  timeline,
  includeBuild,
}: {
  timeline: ScrollTimeline | null;
  /** true in the no-WebGL branch, where beat 1's mesh can't render either —
   *  the feathered build frame joins this DOM stack. Under reduced motion
   *  (WebGL present) beat 1 still renders in the shell canvas, camera at
   *  rest, so the build frame here would double-print. */
  includeBuild: boolean;
}) {
  const buildRef = useRef<HTMLImageElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<PocketHandle>(null);

  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && filmHeight() > window.innerWidth,
  );
  const [glintAt, setGlintAt] = useState(() => stillGlintAt(viewportAspect()));
  const glintRefState = useRef(glintAt);
  glintRefState.current = glintAt;

  useEffect(() => {
    const compute = () => {
      setPortrait(filmHeight() > window.innerWidth);
      setGlintAt(stillGlintAt(viewportAspect()));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const hero = heroLayerOpacity(value);
      const world = stillWorldOpacity(value);
      if (buildRef.current) {
        buildRef.current.style.opacity = (includeBuild ? buildOpacity(value) : 0).toFixed(4);
      }
      if (photoRef.current) {
        photoRef.current.style.opacity = (hero * (1 - world)).toFixed(4);
      }
      if (stillRef.current) {
        stillRef.current.style.opacity = (hero * world).toFixed(4);
      }
      if (veilRef.current) {
        veilRef.current.style.opacity = (hero * duskVeilOpacity(value)).toFixed(4);
      }
      pocketRef.current?.setGlintOpacity(
        glintRefState.current.inFrame && hero > 0.5
          ? anchorOpacity(streetProgress(value), RTC_GLINT_WINDOW)
          : 0,
      );
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, includeBuild]);

  return (
    <>
      <div className="nbhd-still">
        {includeBuild && (
          <img
            ref={buildRef}
            className="nbhd-still-build"
            src="/assets/nbhd/build-feathered.webp"
            alt="Night in a backyard: the playhouse half-built — raw stud framing under a work light, drills on the plywood floor, and Penny in a red velvet dress standing inside it with her hands to her chest."
            draggable={false}
          />
        )}
        {/* These two ARE the scene's content in this edition — real alt
            text, not aria-hidden (the DadFallback precedent). */}
        <img
          ref={photoRef}
          className="nbhd-still-cover"
          src={HELD_PHOTO_URL}
          alt="The same backyard, finished, in daylight: kids mid-jump on the trampoline, the playhouse painted white with a '68' plaque, chairs and toys on the brick path."
          draggable={false}
        />
        <img
          ref={stillRef}
          className="nbhd-still-cover"
          src={portrait ? STILL_PORTRAIT_URL : STILL_LANDSCAPE_URL}
          alt="The same backyard rebuilt in a video game: standing at street level in the Royal Tara Cove world, the LYONS mailbox at the curb and the street running north."
          draggable={false}
        />
        <div ref={veilRef} className="nbhd-veil" aria-hidden="true" />
      </div>
      <RtcInvitePocket ref={pocketRef} glintAt={glintAt} timeline={timeline} />
      <RtcPlayLink timeline={timeline} anchor={glintAt} />
    </>
  );
}
