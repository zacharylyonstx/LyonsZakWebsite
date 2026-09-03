// Scene 3 — THE DAD. Two of the archive's strongest father/kid frames, each
// given THE DRUMMER's depth-mesh treatment (graded photo + depth
// displacement + feathered edges) without its type-occlusion half — no name
// card competes with these photographs for space; the film's voice line
// (film/Subtitle.tsx, already site-wide) carries the words instead.
//
// Rendering stack (bottom to top, the SAME shared Canvas/camera every scene
// since THE DRUMMER mounts, App's .stage):
//   sparkler mesh   — the blue-hour depth mesh, feathered into the dusk.
//   swing mesh      — the rope-swing depth mesh, same treatment.
//   glow sprite     — the shared amber CanvasTexture from panelMaterial.ts,
//                     anchored at the sparkler's own flare pixel (dadRig's
//                     glowAnchor) — blooms once to LEAD the sparkler photo
//                     in, then blooms again (larger — the signature moment)
//                     to bridge the transition into the swing photo. Never
//                     additive on this Canvas — see panelMaterial.ts's own
//                     note on why normal blending is what actually shows up
//                     against a transparent-clear canvas.
//
// Only one of {sparkler, swing} is ever meaningfully opaque at a time
// (dadRig.sparklerOpacity/swingOpacity's windows overlap only across the
// transition, where the glow — not either photo — briefly owns the frame),
// so paint order between the two meshes doesn't matter; the glow's
// renderOrder keeps it drawn last regardless.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { makeDepthMesh } from '../../crossing/makeDepthMesh';
import { patchDadMaterial, type DadUniforms } from './patchDadMaterial';
import { glowTexture } from '../builder/panelMaterial';
import { BUILDER_END } from '../builder/builderRig';
import {
  DAD_END,
  FOV_DEG,
  cameraPose,
  glowAnchor,
  glowState,
  sceneActive,
  sparklerLayout,
  sparklerOpacity,
  swingLayout,
  swingOpacity,
} from './dadRig';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import { filmHeight } from '../../timeline/filmViewport';

export { DAD_END };

const SPARKLER_PHOTO_URL = '/assets/dad/sparkler.jpg';
const SPARKLER_DEPTH_URL = '/assets/dad/sparkler-depth.png';
const SWING_PHOTO_URL = '/assets/dad/swing.jpg';
const SWING_DEPTH_URL = '/assets/dad/swing-depth.png';

/** Mesh grid resolution (longer side) — matches THE DRUMMER's own choice;
 *  these photos have no finer depth structure than a person/room scene does. */
const SEGMENTS_RES = 320;

/** The glow sprite's base world radius, as a fraction of the sparkler
 *  photo's own mesh width, before glowState's per-bloom scale multiplier —
 *  a rendering-only constant (the rig's `scale` field is the abstract
 *  multiplier; this is where it becomes an actual world size). */
const GLOW_BASE_FRACTION = 0.16;

interface DadAssets {
  sparklerPhoto: THREE.Texture;
  sparklerDepth: THREE.Texture;
  swingPhoto: THREE.Texture;
  swingDepth: THREE.Texture;
}

let assetsPromise: Promise<DadAssets> | null = null;

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

/** One shared load (three keeps per-renderer GPU copies) — mirrors
 *  DrummerScene.tsx's loadAssets. */
function loadAssets(): Promise<DadAssets> {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      loadTexture(SPARKLER_PHOTO_URL),
      loadTexture(SPARKLER_DEPTH_URL),
      loadTexture(SWING_PHOTO_URL),
      loadTexture(SWING_DEPTH_URL),
    ]).then(([sparklerPhoto, sparklerDepth, swingPhoto, swingDepth]) => {
      // Raw bytes in, raw bytes out — the same proven pipeline THE DRUMMER
      // and THE BUILDER both use, so the graded file's own bytes reproduce
      // unmodified regardless of the browser's default color management.
      for (const tex of [sparklerPhoto, sparklerDepth, swingPhoto, swingDepth]) {
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
      }
      return { sparklerPhoto, sparklerDepth, swingPhoto, swingDepth };
    });
  }
  return assetsPromise;
}

interface PhotoRig {
  mesh: THREE.Mesh;
}

function buildPhotoRig(photo: THREE.Texture, depth: THREE.Texture): PhotoRig & { uniforms: DadUniforms } {
  const mesh = makeDepthMesh(photo, depth, { segments: SEGMENTS_RES });
  const uniforms = patchDadMaterial(mesh);
  // Both photos displace from THE BUILDER's own exit pose — the point the
  // live camera actually departs from as THE DAD opens (see dadRig.ts's
  // REF_Z doc comment for why this scene doesn't reuse the generic REST_Z
  // THE DRUMMER's identity trick relies on).
  const mat = mesh.material as THREE.ShaderMaterial;
  mat.uniforms.uDisplaceOrigin.value.set(BUILDER_END.x, BUILDER_END.y, BUILDER_END.z);
  return { mesh, uniforms };
}

function disposePhotoRig(rig: PhotoRig): void {
  rig.mesh.geometry.dispose();
  (rig.mesh.material as THREE.Material).dispose();
}

/** The WebGL half — mounts inside App's main Canvas (z1), as a LATER sibling
 *  of BuilderPanels so THE DAD's own camera writes take priority the moment
 *  its sceneActive range opens (see App.tsx's mount order comment). */
export function DadPhotos({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const [assets, setAssets] = useState<DadAssets | null>(null);

  useEffect(() => {
    let alive = true;
    loadAssets().then((a) => {
      if (alive) setAssets(a);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rigs = useMemo(() => {
    if (!assets) return null;
    return {
      sparkler: buildPhotoRig(assets.sparklerPhoto, assets.sparklerDepth),
      swing: buildPhotoRig(assets.swingPhoto, assets.swingDepth),
    };
  }, [assets]);

  useEffect(() => {
    if (!rigs) return;
    return () => {
      disposePhotoRig(rigs.sparkler);
      disposePhotoRig(rigs.swing);
    };
  }, [rigs]);

  const glow = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // NOT additive — see panelMaterial.ts's own note: this Canvas
        // clears to alpha 0 so the DOM dusk shows through, and additive
        // blending leaves too little alpha for that composite step to
        // carry the color forward.
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    );
    mesh.renderOrder = 3; // above both photo meshes
    return mesh;
  }, []);

  useEffect(() => {
    return () => {
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
    };
  }, [glow]);

  useFrame(({ camera, size }) => {
    const t = timeline.value();

    if (!sceneActive(t)) {
      if (rigs) {
        rigs.sparkler.mesh.visible = false;
        rigs.swing.mesh.visible = false;
      }
      glow.visible = false;
      return;
    }

    const pose = cameraPose(t, reducedMotion);
    camera.position.set(pose.x, pose.y, pose.z);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const pc = camera as THREE.PerspectiveCamera;
      if (pc.fov !== FOV_DEG) {
        pc.fov = FOV_DEG;
        pc.updateProjectionMatrix();
      }
    }

    if (rigs) {
      rigs.sparkler.mesh.visible = true;
      rigs.swing.mesh.visible = true;

      const sLay = sparklerLayout(size.width, size.height);
      rigs.sparkler.mesh.scale.setScalar(sLay.meshScale);
      rigs.sparkler.mesh.position.set(sLay.meshX, sLay.meshY, 0);
      rigs.sparkler.uniforms.uOpacity.value = sparklerOpacity(t);
      (rigs.sparkler.mesh.material as THREE.ShaderMaterial).uniforms.uDepthScale.value =
        sLay.depthScale;

      const wLay = swingLayout(size.width, size.height);
      rigs.swing.mesh.scale.setScalar(wLay.meshScale);
      rigs.swing.mesh.position.set(wLay.meshX, wLay.meshY, 0);
      rigs.swing.uniforms.uOpacity.value = swingOpacity(t);
      (rigs.swing.mesh.material as THREE.ShaderMaterial).uniforms.uDepthScale.value =
        wLay.depthScale;
    }

    const gState = glowState(t);
    glow.visible = gState.opacity > 0.0005;
    if (glow.visible) {
      const anchor = glowAnchor(size.width, size.height);
      // A hair in front of the sparkler's own plane (z=0) so the bloom
      // reads as light IN FRONT of the frame, not painted onto it.
      glow.position.set(anchor.x, anchor.y, anchor.z + 0.06);
      const baseSize = sparklerLayout(size.width, size.height).meshScale;
      glow.scale.setScalar(baseSize * GLOW_BASE_FRACTION * gState.scale);
      (glow.material as THREE.MeshBasicMaterial).opacity = gState.opacity;
    }
  });

  return (
    <>
      {rigs && <primitive object={rigs.sparkler.mesh} />}
      {rigs && <primitive object={rigs.swing.mesh} />}
      <primitive object={glow} />
    </>
  );
}

/**
 * No-WebGL branch: the two graded photos, feather BAKED (prepare-assets'
 * `feathered` kind, same bake THE DRUMMER's fallback uses), placed by the
 * same layout math, opacity still f(scroll) — no glow bloom (a static
 * drop-shadow glow standing in would fight the two crossfading photos more
 * than it would help; the photos and the voice line carry the scene here).
 *
 * Unlike every other scene's fallback, these two <img> elements are NOT
 * aria-hidden and carry REAL, descriptive alt text: THE DRUMMER/THE
 * BUILDER's fallbacks are decorative alongside content the DOM already
 * states in words (a name, a museum-label caption) or a canvas-only
 * occlusion effect, but these two photographs ARE the scene's content, and
 * a screen-reader visitor without WebGL deserves the same description a
 * sighted one gets from looking at them.
 */
export function DadFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const sparklerRef = useRef<HTMLImageElement>(null);
  const swingRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const place = () => {
      const w = window.innerWidth;
      const h = filmHeight();
      const sLay = sparklerLayout(w, h);
      const wLay = swingLayout(w, h);
      if (sparklerRef.current) {
        sparklerRef.current.style.left = `${sLay.rect.left.toFixed(1)}px`;
        sparklerRef.current.style.top = `${sLay.rect.top.toFixed(1)}px`;
        sparklerRef.current.style.width = `${sLay.rect.width.toFixed(1)}px`;
        sparklerRef.current.style.height = `${sLay.rect.height.toFixed(1)}px`;
      }
      if (swingRef.current) {
        swingRef.current.style.left = `${wLay.rect.left.toFixed(1)}px`;
        swingRef.current.style.top = `${wLay.rect.top.toFixed(1)}px`;
        swingRef.current.style.width = `${wLay.rect.width.toFixed(1)}px`;
        swingRef.current.style.height = `${wLay.rect.height.toFixed(1)}px`;
      }
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (sparklerRef.current) {
        sparklerRef.current.style.opacity = sparklerOpacity(value).toFixed(4);
      }
      if (swingRef.current) {
        swingRef.current.style.opacity = swingOpacity(value).toFixed(4);
      }
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="stage dad-fallback">
      <img
        ref={sparklerRef}
        src="/assets/dad/sparkler-feathered.webp"
        alt="Zak lights a sparkler held in his toddler son Luke's hand at blue hour, smoke curling as they both grin in the flare's light."
        draggable={false}
      />
      <img
        ref={swingRef}
        src="/assets/dad/swing-feathered.webp"
        alt="Zak, in a cowboy hat, stands balanced on a rope swing while his two kids ride it beside him, laughing up at him, a lake and trees behind."
        draggable={false}
      />
    </div>
  );
}
