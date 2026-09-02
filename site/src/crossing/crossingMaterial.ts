// EXTRACTED UNCHANGED from site/experiments/a2-crossing/src/crossingMaterial.ts
// (production-slice Task 2). Only the shader import path moved (the GLSL file
// now lives beside this module). Every uniform, guard, and prepass is the
// proven experiment code.
//
// CrossingMaterial — the machinery that turns the game world's own materials
// into photo-receivers. See crossing.frag.glsl for the GLSL core and the
// position-identity argument that makes the swap exact.
//
// Three jobs:
//   1. patchWorldMaterials(scene): traverse the live scene and chain a
//      crossing injection onto every patchable material's onBeforeCompile
//      (preserving the game's own hooks, e.g. the glass fresnel rim).
//      Unpatchable shader-driven materials (drei Sky, clouds, troika Text)
//      are either left alone (sky) or opacity-faded from JS (text).
//   2. renderProjectorDepth(...): one-shot linear-depth render of the world
//      from the projector pose, so the shader can ask "did the photograph
//      actually see this point?" (honest disocclusion, not a crossfade).
//   3. crossingUniforms: the single shared uniform set the scroll timeline
//      drives every frame (all patched materials reference the SAME objects).

import * as THREE from 'three';
import crossingGlsl from './crossing.frag.glsl?raw';

// ---- chunk parsing --------------------------------------------------------

function chunk(name: string): string {
  const marker = `//__${name}__`;
  const start = crossingGlsl.indexOf(marker);
  if (start < 0) throw new Error(`crossing.frag.glsl: missing chunk ${name}`);
  const body = crossingGlsl.slice(start + marker.length);
  const end = body.indexOf('//__END__');
  if (end < 0) throw new Error(`crossing.frag.glsl: unterminated chunk ${name}`);
  return body.slice(0, end);
}

const PARS_FRAG = chunk('CROSSING_PARS');
const FRAG = chunk('CROSSING_FRAG');
const VERT_PARS = chunk('CROSSING_VERT_PARS');
const VERT_POS = chunk('CROSSING_VERT_POS');
const VERT_NORMAL = chunk('CROSSING_VERT_NORMAL');
const VERT_NONORMAL = chunk('CROSSING_VERT_NONORMAL');

// ---- shared uniforms ------------------------------------------------------

export const PROJ_DEPTH_SIZE = { w: 2048, h: 1536 };
const PROJ_FAR = 200;

export const crossingUniforms = {
  uPhoto: { value: null as THREE.Texture | null },
  uProjDepth: { value: null as THREE.Texture | null },
  uPhotoProjMatrix: { value: new THREE.Matrix4() },
  uPhotoViewMatrix: { value: new THREE.Matrix4() },
  uPhotoCamPos: { value: new THREE.Vector3() },
  uPhotoCamDir: { value: new THREE.Vector3() },
  uProjFar: { value: PROJ_FAR },
  uProjTexel: { value: new THREE.Vector2(1 / PROJ_DEPTH_SIZE.w, 1 / PROJ_DEPTH_SIZE.h) },
  uPhotoStrength: { value: 1 },
  uDepartFacing: { value: 0 },
  uGradeStrength: { value: 1 },
  uGradeExposure: { value: 0.84 },
  uGradeSat: { value: 0.68 },
  uGrain: { value: 0.03 },
  // Projector-space distance bound on the projection (see crossing.frag.glsl
  // distBound): the photo's content lives within ~40m of where it was taken.
  uDistFadeNear: { value: 40 },
  uDistFadeFar: { value: 70 },
  // Semantic-region art direction (G1.1 Task 4): photo-space masks + authored
  // per-region release values (timeline.ts REGION_RELEASE drives these).
  uMaskA: { value: null as THREE.Texture | null }, // r kids, g trampoline, b playhouse
  uMaskB: { value: null as THREE.Texture | null }, // r canopy, g sky, b ground
  uMasksOn: { value: 0 },
  uRelA: { value: new THREE.Vector3(0, 0, 0) },
  uRelB: { value: new THREE.Vector3(0, 0, 0) },
  uRelRest: { value: 0 },
  // Debug heat view (QA only): 0 off; 1 weight; 2 vis; 3 facing; 4 smear;
  // 5 dist; 6 region keep
  uDebugMode: { value: 0 },
};

// ---- projector -------------------------------------------------------------

export interface MatchedPose {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

/** The projector camera: the LOCKED matched pose, at the PHOTO's own aspect
 *  (4:3) — its frustum must map the full photograph, independent of the
 *  visitor's viewport. */
export function makeProjectorCamera(pose: MatchedPose, photoAspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(pose.fov, photoAspect, 0.3, PROJ_FAR);
  cam.position.set(...pose.pos);
  cam.lookAt(new THREE.Vector3(...pose.look));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  crossingUniforms.uPhotoCamPos.value.copy(cam.position);
  cam.getWorldDirection(crossingUniforms.uPhotoCamDir.value);
  crossingUniforms.uPhotoViewMatrix.value.copy(cam.matrixWorldInverse);
  crossingUniforms.uPhotoProjMatrix.value
    .multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return cam;
}

// ---- projector depth prepass ----------------------------------------------

/** Linear view-space depth (meters / uProjFar), RGBA-packed. Written by hand
 *  (instead of MeshDepthMaterial) so the stored value is LINEAR — bias for
 *  the visibility compare can then be reasoned about in meters. Instancing-
 *  aware; three sets USE_INSTANCING for override materials per object. */
const depthPrepassMaterial = new THREE.ShaderMaterial({
  uniforms: { uFar: { value: PROJ_FAR } },
  vertexShader: /* glsl */ `
    varying float vViewZ;
    void main() {
      vec4 p = vec4( position, 1.0 );
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      vec4 mvPosition = modelViewMatrix * p;
      vViewZ = -mvPosition.z;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform float uFar;
    varying float vViewZ;
    void main() {
      gl_FragColor = packDepthToRGBA( clamp( vViewZ / uFar, 0.0, 1.0 ) );
    }
  `,
  side: THREE.DoubleSide,
});

let depthTarget: THREE.WebGLRenderTarget | null = null;

/** Debug: read the projector depth map back at (u,v) in [0,1] photo space;
 *  returns meters (uProjFar-normalized linear depth unpacked on the CPU). */
export function readProjDepth(renderer: THREE.WebGLRenderer, u: number, v: number): number | null {
  if (!depthTarget) return null;
  const x = Math.max(0, Math.min(PROJ_DEPTH_SIZE.w - 1, Math.round(u * PROJ_DEPTH_SIZE.w)));
  const y = Math.max(0, Math.min(PROJ_DEPTH_SIZE.h - 1, Math.round(v * PROJ_DEPTH_SIZE.h)));
  const buf = new Uint8Array(4);
  renderer.readRenderTargetPixels(depthTarget, x, y, 1, 1, buf);
  return unpackDepthBytes(buf, 0) * PROJ_FAR;
}

/** three r184 packDepthToRGBA order: R most significant, A least (matches
 *  crossingUnpackDepth in crossing.frag.glsl — see the comment there). */
function unpackDepthBytes(buf: Uint8Array, k: number): number {
  const UD = 255 / 256;
  return (
    (buf[k] / 255) * UD +
    (buf[k + 1] / 255) * (UD / 256) +
    (buf[k + 2] / 255) * (UD / (256 * 256)) +
    (buf[k + 3] / 255) * (1 / (256 * 256 * 256))
  );
}

/** Debug: raw RGBA bytes of one projector depth texel. */
export function readProjDepthRaw(renderer: THREE.WebGLRenderer, u: number, v: number): number[] | null {
  if (!depthTarget) return null;
  const x = Math.max(0, Math.min(PROJ_DEPTH_SIZE.w - 1, Math.round(u * PROJ_DEPTH_SIZE.w)));
  const y = Math.max(0, Math.min(PROJ_DEPTH_SIZE.h - 1, Math.round(v * PROJ_DEPTH_SIZE.h)));
  const buf = new Uint8Array(4);
  renderer.readRenderTargetPixels(depthTarget, x, y, 1, 1, buf);
  return Array.from(buf);
}

/** Debug: one-shot full readback of the projector depth map, downsampled to
 *  gw x gh (row 0 = v=0 = photo bottom), values in meters. */
export function readProjDepthGrid(
  renderer: THREE.WebGLRenderer,
  gw: number,
  gh: number
): number[][] | null {
  if (!depthTarget) return null;
  const { w, h } = PROJ_DEPTH_SIZE;
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(depthTarget, 0, 0, w, h, buf);
  const rows: number[][] = [];
  for (let j = 0; j < gh; j++) {
    const row: number[] = [];
    const y = Math.min(h - 1, Math.round((j / (gh - 1)) * (h - 1)));
    for (let i = 0; i < gw; i++) {
      const x = Math.min(w - 1, Math.round((i / (gw - 1)) * (w - 1)));
      const k = (y * w + x) * 4;
      row.push(unpackDepthBytes(buf, k) * PROJ_FAR);
    }
    rows.push(row);
  }
  return rows;
}

/** Render the projector's linear depth map. Re-runnable (cheap, one extra
 *  scene render) — called again whenever late-loading GLBs land, so the
 *  visibility test always sees the finished world. */
export function renderProjectorDepth(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  projector: THREE.PerspectiveCamera
): void {
  if (!depthTarget) {
    depthTarget = new THREE.WebGLRenderTarget(PROJ_DEPTH_SIZE.w, PROJ_DEPTH_SIZE.h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    crossingUniforms.uProjDepth.value = depthTarget.texture;
  }

  // Sky / clouds / sparkles / text must not stamp depth (they are not photo
  // receivers); hide everything shader-driven or explicitly flagged. The net
  // receiver is the opposite case: it DOES stamp depth, and (G1.1 Task 3) it
  // hides itself once its fade reaches zero — force it visible for the
  // prepass so the stamped depth map never depends on scroll position.
  const hidden: THREE.Object3D[] = [];
  const shown: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    const anyObj = obj as THREE.Mesh & { userData: Record<string, unknown> };
    if (!(anyObj as THREE.Mesh).isMesh && !(anyObj as unknown as THREE.Points).type?.includes('Points')) return;
    const isReceiver = anyObj.userData.crossingReceiver === true; // net receiver DOES stamp depth
    if (isReceiver && !obj.visible) {
      obj.visible = true;
      shown.push(obj);
      return;
    }
    if (!obj.visible) return;
    const m = (anyObj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const first = Array.isArray(m) ? m[0] : m;
    const isShaderDriven = !!first && ((first as THREE.ShaderMaterial).isShaderMaterial || (first as { isTroikaTextMaterial?: boolean }).isTroikaTextMaterial === true);
    const excluded = anyObj.userData.crossingNoDepth === true;
    if ((isShaderDriven && !isReceiver) || excluded) {
      obj.visible = false;
      hidden.push(obj);
    }
  });

  const prevOverride = scene.overrideMaterial;
  const prevTarget = renderer.getRenderTarget();
  scene.overrideMaterial = depthPrepassMaterial;
  renderer.setRenderTarget(depthTarget);
  renderer.setClearColor(0xffffff, 1); // far = max depth where nothing is drawn
  renderer.clear();
  renderer.render(scene, projector);
  renderer.setRenderTarget(prevTarget);
  scene.overrideMaterial = prevOverride;
  for (const obj of hidden) obj.visible = true;
  for (const obj of shown) obj.visible = false;
}

// ---- material patching ----------------------------------------------------

const patched = new WeakSet<THREE.Material>();

/** Materials that can't take the injection but should stop overdrawing the
 *  photo at the matched pose (troika Text: the "68" plaque digits, street
 *  names). Their opacity is driven to (1 - uPhotoStrength) each frame. */
export const fadeInMaterials: THREE.Material[] = [];

function injectCrossing(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }): void {
  Object.assign(shader.uniforms, crossingUniforms);

  // vertex: varyings + world position (+ world normal when available)
  let v = shader.vertexShader;
  v = VERT_PARS + '\n' + v;
  if (!v.includes('#include <project_vertex>')) {
    throw new Error('crossing: vertex shader missing <project_vertex>');
  }
  v = v.replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_POS);
  if (v.includes('#include <defaultnormal_vertex>')) {
    v = v.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n' + VERT_NORMAL);
  } else {
    v = v.replace(VERT_POS, VERT_POS + '\n' + VERT_NONORMAL);
  }
  shader.vertexShader = v;

  // fragment: helpers before main, blend after the last built-in chunk so the
  // photo bytes reach the framebuffer untouched by tone mapping / fog
  let f = shader.fragmentShader;
  f = PARS_FRAG + '\n' + f;
  if (f.includes('#include <dithering_fragment>')) {
    f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG);
  } else {
    // fall back: inject before the closing brace of main()
    const lastBrace = f.lastIndexOf('}');
    f = f.slice(0, lastBrace) + FRAG + '\n}' + f.slice(lastBrace + 1);
  }
  shader.fragmentShader = f;
}

function patchMaterial(mat: THREE.Material): void {
  if (patched.has(mat)) return;
  patched.add(mat);

  const prevOBC = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevOBC) prevOBC.call(mat, shader, renderer);
    injectCrossing(shader as unknown as Parameters<typeof injectCrossing>[0]);
  };
  mat.customProgramCacheKey = () =>
    (prevKey ? prevKey.call(mat) : '') + '|crossing';
  mat.needsUpdate = true;
}

/** Walk the live scene; patch every game material that can take the
 *  injection; register troika text for JS-side fade-in. Safe to call
 *  repeatedly (late GLB loads) — already-patched materials are skipped. */
export function patchWorldMaterials(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((obj.userData as Record<string, unknown>).crossingReceiver === true) return; // has its own material
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || patched.has(m)) continue;
      if ((m as { isTroikaTextMaterial?: boolean }).isTroikaTextMaterial === true) {
        patched.add(m);
        m.transparent = true;
        fadeInMaterials.push(m);
        continue;
      }
      if ((m as THREE.ShaderMaterial).isShaderMaterial || (m as THREE.RawShaderMaterial).isRawShaderMaterial) {
        patched.add(m); // sky, clouds, sparkles — leave them be
        continue;
      }
      patchMaterial(m);
      count++;
    }
  });
  return count;
}

// ---- net receiver ---------------------------------------------------------

export const netReceiverUniforms = {
  uNetFade: { value: 1 },
};

export const skyBackstopUniforms = {
  uSkyFade: { value: 1 },
};

/** Material for the sky backstop dome: where a photo ray hits NO world
 *  geometry (sky gaps in the canopy, the patio overhang's corner), the game's
 *  sky would puncture the photograph at the swap. A huge back-side sphere
 *  centered on the projector catches those rays instead. The main render's
 *  own depth buffer restricts it to true sky pixels (everything solid draws
 *  in front of it), so it needs no visibility term — just the frustum feather
 *  and its own dissolve. Directionally frozen, which is exactly right for
 *  sky-distance content, and it fades out early in the departure. */
export function makeSkyBackstopMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...crossingUniforms, ...skyBackstopUniforms },
    vertexShader: VERT_PARS + /* glsl */ `
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vCrossWorldPos = wp.xyz;
        vCrossNormal = vec3( 0.0 );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: PARS_FRAG + /* glsl */ `
      uniform float uSkyFade;
      void main() {
        vec4 photoP = uPhotoProjMatrix * vec4( vCrossWorldPos, 1.0 );
        if ( photoP.w <= 0.0 ) discard;
        vec2 pUv = ( photoP.xy / photoP.w ) * 0.5 + 0.5;
        const float F = 0.006;
        float inPhoto = smoothstep( 0.0, F, pUv.x ) * ( 1.0 - smoothstep( 1.0 - F, 1.0, pUv.x ) )
                      * smoothstep( 0.0, F, pUv.y ) * ( 1.0 - smoothstep( 1.0 - F, 1.0, pUv.y ) );
        // Only photo texels the projector prepass saw NOTHING at (true sky /
        // canopy gaps) may live on the backstop. Without this, the visitor's
        // own depth buffer is the only restriction, and from a departed
        // camera the whole photograph reappears as a translucent frieze
        // floating above the horizon (photo texels that belong to world
        // geometry made visible around that geometry's silhouette).
        // Gated by uDepartFacing like the other guards so the matched-pose
        // identity stays exact.
        float stored = crossingUnpackDepth( texture2D( uProjDepth, pUv ) ) * uProjFar;
        float skyOnly = smoothstep( 0.90 * uProjFar, 0.98 * uProjFar, stored );
        // Region art direction (G1.1 Task 4): the backstop is SKY-DISTANCE
        // content by construction, so nothing on it may ride the canopy HOLD —
        // photo canopy/fence texels caught here (game-geometry gaps) are
        // exactly the "dark confetti" and the stretched curtain behind the
        // (shorter) game playhouse. True sky fades plainly on the sky
        // schedule; every non-sky texel dissolves on that same early
        // schedule, luminance-ordered (darkest confetti dies first). At the
        // matched pose all release values are 0 -> keep == 1, identity intact.
        float skyM = texture2D( uMaskB, pUv ).g * uMasksOn;
        float key = dot( texture2D( uPhoto, pUv ).rgb, vec3( 0.299, 0.587, 0.114 ) );
        float keep = skyM * ( 1.0 - uRelB.y )
                   + ( 1.0 - skyM ) * crossingDissolveKeep( uRelB.y, key, 0.10 );
        float w = inPhoto * mix( 1.0, skyOnly, uDepartFacing ) * uPhotoStrength * uSkyFade * keep;
        if ( w <= 0.004 ) discard;
        gl_FragColor = vec4( crossingPhotoColor( pUv ), w );
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
}

/** Material for the trampoline-net receiver slab: pure photo, alpha-driven by
 *  the crossing weight and its own dissolve (uNetFade). It stamps the
 *  projector depth map (userData.crossingReceiver on its mesh) so the fence /
 *  yard behind the net never double-receives the kids' pixels. */
export function makeNetReceiverMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...crossingUniforms, ...netReceiverUniforms },
    vertexShader: VERT_PARS + /* glsl */ `
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vCrossWorldPos = wp.xyz;
        vCrossNormal = vec3( 0.0 );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: PARS_FRAG + /* glsl */ `
      uniform float uNetFade;
      void main() {
        vec2 pUv;
        float w = crossingWeight( vCrossWorldPos, vec3( 0.0 ), pUv ) * uNetFade;
        if ( w <= 0.004 ) discard;
        gl_FragColor = vec4( crossingPhotoColor( pUv ), w );
      }
    `,
    transparent: true,
    depthWrite: false,
    // Front (outer) faces only: with the photo now HELD at full opacity deep
    // into the departure (G1.1 Task 4), a DoubleSide cylinder double-images —
    // the far half re-projects the photo at different UVs over the near half.
    // At the matched pose both halves sampled identical texels (same ray), so
    // culling the far half changes nothing at the swap.
    side: THREE.FrontSide,
  });
}

export function driveFadeInMaterials(photoStrength: number): void {
  const o = 1 - photoStrength;
  for (const m of fadeInMaterials) {
    if (m.opacity !== o) {
      m.opacity = o;
    }
  }
}
