// Staged asset loading for the crossing — callable long before the crossing
// is on screen (while the NAME/DESK segments run), so the hero transition's
// working set (photo, depth, packed masks, world GLBs) is resident by the
// time the visitor scrolls into it.
//
// Stages (in order, each reported through onProgress):
//   1. 'photo'  — hero photograph + its depth map (the phase-1 mesh layer and
//                 the projected photo share the SAME photo texture instance).
//   2. 'masks'  — the packed semantic-region masks (maskA/maskB) that drive
//                 the art-directed release. The shader treats everything as
//                 the "rest" region until BOTH are resident (uMasksOn), so a
//                 partial state is safe by construction — but this loader only
//                 resolves once both are in.
//   3. 'models' — the world's GLB props (drei useGLTF cache warm-up): exactly
//                 the exterior set the cinematic world mounts. The furnished
//                 neighbor-interior GLBs are deliberately NOT preloaded —
//                 GAMEPLAY_ONLY_CUTS.neighborInteriors means they never mount
//                 in the ship config (they still lazy-load fine under
//                 Suspense if a QA run forces ?opt=none).
//   4. shader precompile — ported from the experiment, but it lives where it
//                 must: inside CrossingScene's refresh() (gl.compile(scene,
//                 camera)), because compiling requires the LIVE renderer and
//                 mounted scene graph. Mount CrossingScene (it can sit behind
//                 other content) and refresh() precompiles every program —
//                 including instanced variants — during the load beat instead
//                 of as a first-scrub hitch.
//
// Texture parameters are the experiment's exactly (TextureLoader + NoColorSpace
// raw-byte discipline — the projected sample must write the photograph's exact
// bytes; see crossingMaterial.ts). The optional renderer lets a caller that
// renders the crossing pre-upload textures to the GPU off the critical path
// (renderer.initTexture); pass null when the crossing's renderer does not
// exist yet — CrossingScene finalizes anisotropy against its own context at
// mount either way.

import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { MODELS } from '../world-rtc/game/world/models';

export interface CrossingAssets {
  /** Hero photo, raw bytes (NoColorSpace), mipmapped, clamped. */
  photo: THREE.Texture;
  /** 16-bit-source depth map (NEAR = BRIGHT), linear-filtered, no mipmaps. */
  depth: THREE.Texture;
  /** Packed region masks: maskA.rgb = kids/trampoline/playhouse. */
  maskA: THREE.Texture;
  /** Packed region masks: maskB.rgb = canopy/sky/ground. */
  maskB: THREE.Texture;
}

export type CrossingLoadStage = 'photo' | 'masks' | 'models' | 'done';

export interface CrossingLoadProgress {
  stage: CrossingLoadStage;
  /** Items finished across ALL stages so far. */
  loaded: number;
  /** Total items across all stages. */
  total: number;
}

const PHOTO_URL = '/photo.jpg';
const DEPTH_URL = '/depth.png';
const MASK_A_URL = '/masks/maskA.png';
const MASK_B_URL = '/masks/maskB.png';

/** The exterior GLB set the cinematic world mounts (see stage 3 note above). */
const WORLD_MODEL_KEYS = [
  'oak', 'crepemyrtle', 'shrub', 'mailbox',
  'truck', 'sedan', 'bike', 'golfcart',
  'grill', 'patioset', 'trashbins',
] as const satisfies readonly (keyof typeof MODELS)[];

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, () =>
      reject(
        new Error(
          `crossing: failed to load ${url} — run \`npm run prepare-assets\` ` +
            `(photo/depth/masks/GLBs are staged locally, never committed)`,
        ),
      ),
    );
  });
}

/** The experiment's photo-texture discipline (main.ts + CrossingApp.tsx):
 *  raw bytes, mipmapped, clamped. Anisotropy is finalized by CrossingScene
 *  against its own renderer at mount (Math.min(8, maxAnisotropy)). */
function configurePhotoTexture(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function configureDepthTexture(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

let pending: Promise<CrossingAssets> | null = null;

/**
 * Load every crossing asset, staged (photo+depth → masks → world GLBs).
 * Memoized: every caller shares one in-flight/settled promise, so the App can
 * warm the cache during the name/desk segments and CrossingScene can await
 * the same result at mount for free.
 *
 * @param renderer The renderer that will draw the crossing, for early GPU
 *   texture upload (initTexture) — or null if it doesn't exist yet.
 */
export function loadCrossingAssets(
  renderer: THREE.WebGLRenderer | null = null,
  onProgress?: (progress: CrossingLoadProgress) => void,
): Promise<CrossingAssets> {
  if (pending) return pending;

  const total = 4 + WORLD_MODEL_KEYS.length;
  let loaded = 0;
  const report = (stage: CrossingLoadStage) => {
    onProgress?.({ stage, loaded, total });
  };

  pending = (async () => {
    // Stage 1: the photograph and its depth map.
    const [photo, depth] = await Promise.all([
      loadTexture(PHOTO_URL).then((t) => {
        configurePhotoTexture(t);
        loaded++;
        report('photo');
        return t;
      }),
      loadTexture(DEPTH_URL).then((t) => {
        configureDepthTexture(t);
        loaded++;
        report('photo');
        return t;
      }),
    ]);
    renderer?.initTexture(photo);
    renderer?.initTexture(depth);

    // Stage 2: the packed region masks (same texture discipline as the photo).
    const [maskA, maskB] = await Promise.all([
      loadTexture(MASK_A_URL).then((t) => {
        configurePhotoTexture(t);
        loaded++;
        report('masks');
        return t;
      }),
      loadTexture(MASK_B_URL).then((t) => {
        configurePhotoTexture(t);
        loaded++;
        report('masks');
        return t;
      }),
    ]);
    renderer?.initTexture(maskA);
    renderer?.initTexture(maskB);

    // Stage 3: warm drei's GLB cache for the world's props. preload() kicks
    // fetch+parse into the same suspend-react cache the vendored GLBModel
    // components read, so their Suspense resolves instantly at mount.
    await Promise.all(
      WORLD_MODEL_KEYS.map(async (key) => {
        try {
          await Promise.resolve(useGLTF.preload(MODELS[key].url) as unknown);
        } catch {
          // A missing GLB must not sink the whole crossing: the vendored
          // GLBModel has a per-model error boundary and renders without it.
        }
        loaded++;
        report('models');
      }),
    );

    report('done');
    return { photo, depth, maskA, maskB };
  })();

  // A failed load (e.g. assets not staged yet) must not poison the memo
  // forever — let a later call retry after prepare-assets has run.
  pending.catch(() => {
    pending = null;
  });

  return pending;
}
