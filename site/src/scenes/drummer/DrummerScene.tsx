// Scene 1 — THE DRUMMER. The opening frame of the film.
//
// Rendering stack (bottom to top):
//   .stage (z1, App's Canvas)  — the full portrait as a depth mesh,
//                                edge-feathered into the dusk ground.
//   .name-display (z2, DOM)    — ZAK / LYONS + rule + role line.
//   .stage-front (z2, later)   — a SECOND canvas drawing only the photo's
//                                FOREGROUND (depth-gated cutout of the same
//                                mesh): Zak and the kit occlude the type
//                                per-pixel. Because both canvases run the
//                                identical vertex displacement + camera pose
//                                from drummerRig, the cutout registers with
//                                the portrait exactly at every scroll
//                                position — occlusion survives parallax.
//
// Time only appears once: the one-time load settle (photo fades in with a
// gentle dolly-settle when its textures land, IF the visitor is still at the
// top). It converges exactly onto the rig's f(scroll) pose and then never
// runs again — the site's law (frames = f(scroll)) holds for every settled
// frame, which is what the qa byte-sweep captures.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { makeDepthMesh } from '../../crossing/makeDepthMesh';
import { patchDrummerMaterial } from './patchDrummerMaterial';
import {
  cameraPose,
  layout,
  photoOpacity,
  sceneActive,
  REST_Z,
} from './drummerRig';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';

const PHOTO_URL = '/assets/drummer/portrait.jpg';
const DEPTH_URL = '/assets/drummer/depth.png';

/** Mesh grid resolution (longer side). 320 ≈ 70k vertices per canvas —
 *  comfortable at 60fps even doubled, and the displacement field of this
 *  portrait (person/kit vs flag) has no finer structure to resolve. */
const SEGMENTS_RES = 320;

/** Load-settle: duration + how far the camera starts from rest (world z). */
const SETTLE_MS = 1100;
const SETTLE_DOLLY = 0.3;

interface DrummerAssets {
  photo: THREE.Texture;
  depth: THREE.Texture;
}

let assetsPromise: Promise<DrummerAssets> | null = null;

/** One shared load for both canvases (three keeps per-renderer GPU copies,
 *  so a single Texture object serves both contexts). */
function loadAssets(): Promise<DrummerAssets> {
  if (!assetsPromise) {
    const loader = new THREE.TextureLoader();
    const load = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
    assetsPromise = Promise.all([load(PHOTO_URL), load(DEPTH_URL)]).then(
      ([photo, depth]) => {
        // Raw bytes in, raw bytes out: the ShaderMaterial samples uPhoto
        // without color transforms, so NoColorSpace reproduces the graded
        // file exactly (and matches the DOM fallback pixel-for-pixel).
        photo.colorSpace = THREE.NoColorSpace;
        depth.colorSpace = THREE.NoColorSpace;
        photo.minFilter = THREE.LinearFilter;
        photo.generateMipmaps = false;
        depth.minFilter = THREE.LinearFilter;
        depth.generateMipmaps = false;
        return { photo, depth };
      },
    );
  }
  return assetsPromise;
}

const smooth01 = (x: number) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};

/** Load-settle state SHARED by both canvases, so the portrait and its
 *  occlusion cutout ride the identical settle curve (one decision, one
 *  baseline — a per-canvas clock would let their cameras disagree for a
 *  frame and the registered edge would double during the settle). */
const settleState = {
  decided: false,
  skip: false,
  baseAt: 0,
};

/** 0..1 settle envelope at this instant (1 = at the rig pose, inert). */
function settleValue(t: number, reducedMotion: boolean): number {
  if (!settleState.decided) {
    settleState.decided = true;
    settleState.skip = reducedMotion || t > 0.005;
    settleState.baseAt = performance.now();
  }
  if (settleState.skip) return 1;
  const s = (performance.now() - settleState.baseAt) / SETTLE_MS;
  if (s >= 1) {
    settleState.skip = true; // permanently inert from here on
    return 1;
  }
  return smooth01(s);
}

/** The shared per-frame drive: camera + mesh transform + opacity, identical
 *  in both canvases. `fgOnly` only changes the fragment gate. */
function DrummerMesh({
  timeline,
  fgOnly,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  fgOnly: boolean;
  reducedMotion: boolean;
}) {
  const [assets, setAssets] = useState<DrummerAssets | null>(null);

  useEffect(() => {
    let alive = true;
    loadAssets().then((a) => {
      if (alive) setAssets(a);
    });
    return () => {
      alive = false;
    };
  }, []);

  const built = useMemo(() => {
    if (!assets) return null;
    const mesh = makeDepthMesh(assets.photo, assets.depth, {
      segments: SEGMENTS_RES,
    });
    const uniforms = patchDrummerMaterial(mesh, { fgOnly });
    return { mesh, uniforms };
  }, [assets, fgOnly]);

  // Dispose GPU resources when this canvas unmounts / rebuilds.
  useEffect(() => {
    if (!built) return;
    return () => {
      built.mesh.geometry.dispose();
      (built.mesh.material as THREE.Material).dispose();
    };
  }, [built]);

  useFrame(({ camera, size }) => {
    if (!built) return;
    const { mesh, uniforms } = built;
    const t = timeline.value();

    if (!sceneActive(t)) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const lay = layout(size.width, size.height);
    mesh.scale.setScalar(lay.meshScale);
    mesh.position.set(lay.meshX, lay.meshY, 0);

    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uDepthScale.value = lay.depthScale;
    mat.uniforms.uDisplaceOrigin.value.set(0, 0, REST_Z);

    // One-time load settle (see file header). Skipped mid-journey and under
    // reduced motion; converges exactly onto the rig pose, then is inert.
    const settle = settleValue(t, reducedMotion);

    const pose = cameraPose(t, reducedMotion);
    camera.position.set(pose.x, pose.y, pose.z + SETTLE_DOLLY * (1 - settle));
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const pc = camera as THREE.PerspectiveCamera;
      if (pc.fov !== 38) {
        pc.fov = 38;
        pc.updateProjectionMatrix();
      }
    }

    uniforms.uOpacity.value = photoOpacity(t) * settle;
  });

  return built ? <primitive object={built.mesh} /> : null;
}

/** The portrait layer — mounts inside App's main Canvas (z1). */
export function DrummerPhotoLayer({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  return (
    <DrummerMesh timeline={timeline} fgOnly={false} reducedMotion={reducedMotion} />
  );
}

/** The occlusion canvas — the foreground cutout ABOVE the display type. */
export function DrummerFrontCanvas({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  return (
    <div className="stage stage-front" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 38, position: [0, 0, REST_Z] }}
        // Without this, R3F's wrapper re-enables pointer events INSIDE the
        // .stage-front ancestor's pointer-events:none, and this z2 canvas
        // swallows clicks/selection on everything below z2 page-wide —
        // including the selectable ZAK/LYONS type it occludes (App.tsx's
        // main Canvas carries the same fix; see its comment).
        style={{ pointerEvents: 'none' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#171e2e', 0);
        }}
      >
        <DrummerMesh
          timeline={timeline}
          fgOnly={true}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  );
}

/**
 * No-WebGL branch: the same composition, statically — the graded portrait
 * with its feather BAKED (prepare-assets' webp), positioned by the same
 * layout math, opacity still f(scroll). The type renders fully (no
 * occlusion) — composed, readable, honest.
 */
export function DrummerFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const lay = layout(window.innerWidth, window.innerHeight);
      el.style.left = `${lay.rect.left.toFixed(1)}px`;
      el.style.top = `${lay.rect.top.toFixed(1)}px`;
      el.style.width = `${lay.rect.width.toFixed(1)}px`;
      el.style.height = `${lay.rect.height.toFixed(1)}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (ref.current) {
        ref.current.style.opacity = photoOpacity(value).toFixed(4);
      }
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="stage drummer-fallback" aria-hidden="true">
      <img
        ref={ref}
        src="/assets/drummer/portrait-feathered.webp"
        alt=""
        draggable={false}
      />
    </div>
  );
}
