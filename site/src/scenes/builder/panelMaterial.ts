// THE BUILDER's panel material — a plain textured plane with a soft
// rectangular edge feather (the same smoothstep-per-edge idea as THE
// DRUMMER's FEATHER/uFeather, reused here without the depth-mask half of
// that scene: panels are flat screens, not a displaced photo, so there is
// no depth mesh to occlude anything with). The feather is what keeps a
// crisp UI screenshot from reading as a pasted rectangle — its edges melt a
// few percent of the panel's own size into whatever sits behind it (the
// glow sprite, then the dusk).
//
// Edge rim (scene2 taste-gate fix): the feather alone reads fine where the
// source screenshot itself is light near its border (MilieuOS), but where
// the source is already near-black (Kaelbot's own right edge sits on its
// dark chat sidebar) a plain alpha feather dissolves into the dusk with no
// perceptible boundary at all — a "fog", not a screen. `rimBump` adds a
// thin, silhouette-tracing highlight that is independent of the source
// pixel's own luminance: it's a bump (0 at the true edge, 0 again once
// fully inside, peaking exactly at the smoothstep's own midpoint — i.e.
// exactly where the eye reads "the edge" as the alpha ramps through it) so
// every panel gets a faint bone catch-light along its own silhouette
// regardless of what's drawn under it. This is deliberately NOT a border
// (no constant-width outline drawn irrespective of the feather), not
// glassmorphism (no blur/frost), and not a drop-shadow — just a hairline of
// the same "surface catching ambient light" a real screen would show.
import * as THREE from 'three';

export interface PanelFeather {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const DEFAULT_PANEL_FEATHER: PanelFeather = {
  left: 0.03,
  right: 0.03,
  top: 0.025,
  bottom: 0.035,
};

/** Rim-highlight strength (0 = off). Same bone (#f0e9dc, site's "type on
 *  dark" token) traces every panel's own silhouette at low, hairline
 *  opacity — see file header. */
export const DEFAULT_RIM_INTENSITY = 0.4;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uRim;
uniform vec4 uFeather; // left, right, top, bottom (UV fractions)
varying vec2 vUv;

const vec3 RIM_COLOR = vec3(0.941, 0.914, 0.863); // bone (#f0e9dc)

float edgeMask(float feather, float x) {
  float t = clamp(x / max(feather, 1e-5), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// A bump that is 0 at the true edge (t=0) and 0 again once fully inside the
// feather (t=1), peaking at t=0.5 — i.e. exactly where edgeMask's own
// smoothstep is ramping fastest, the pixel band the eye actually reads as
// "the boundary" regardless of the source texture's own luminance there.
float rimBump(float feather, float x) {
  float s = edgeMask(feather, x);
  return 4.0 * s * (1.0 - s);
}

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float aL = edgeMask(uFeather.x, vUv.x);
  float aR = edgeMask(uFeather.y, 1.0 - vUv.x);
  float aT = edgeMask(uFeather.z, 1.0 - vUv.y);
  float aB = edgeMask(uFeather.w, vUv.y);
  float edge = aL * aR * aT * aB;

  float rimL = rimBump(uFeather.x, vUv.x);
  float rimR = rimBump(uFeather.y, 1.0 - vUv.x);
  float rimT = rimBump(uFeather.z, 1.0 - vUv.y);
  float rimB = rimBump(uFeather.w, vUv.y);
  float rim = max(max(rimL, rimR), max(rimT, rimB)) * uRim;

  vec3 color = tex.rgb + RIM_COLOR * rim;
  gl_FragColor = vec4(color, edge * uOpacity);
}
`;

export interface PanelMaterialHandle {
  material: THREE.ShaderMaterial;
  setOpacity: (v: number) => void;
}

/** Builds one panel's ShaderMaterial. `map` should already have its
 *  colorSpace/filter/anisotropy set by the caller (loadPanelTexture below)
 *  — this module only owns the edge-feather + opacity compositing. */
export function makePanelMaterial(
  map: THREE.Texture,
  feather: PanelFeather = DEFAULT_PANEL_FEATHER,
  rimIntensity: number = DEFAULT_RIM_INTENSITY,
): PanelMaterialHandle {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: 0 },
      uRim: { value: rimIntensity },
      uFeather: {
        value: new THREE.Vector4(feather.left, feather.right, feather.top, feather.bottom),
      },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  return {
    material,
    setOpacity: (v: number) => {
      material.uniforms.uOpacity.value = v;
    },
  };
}

// ---------------------------------------------------------------------------
// Chat-reveal cover patch (delight pass, item 1 — see chatReveal.ts).
// A patch quad hides ONE chat message behind a background-matched fill and
// dissolves top-to-bottom as its uReveal advances. It must be pixel-plausible
// as part of the panel while present, so it reproduces the panel shader's
// OWN edge feather and rim highlight — evaluated at the PANEL's uv (uUvRect
// maps this quad's local uv into the parent panel's uv space), so a patch
// straddling the panel's feathered bottom edge fades and catches light
// exactly like the panel pixels it covers.
// ---------------------------------------------------------------------------

const PATCH_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uReveal;
uniform float uRim;
uniform vec4 uFeather;  // parent panel's feather (left, right, top, bottom)
uniform vec4 uUvRect;   // this patch's rect in panel uv: min.u, min.v, size.u, size.v
varying vec2 vUv;

const vec3 RIM_COLOR = vec3(0.941, 0.914, 0.863); // bone (#f0e9dc)
const float WIPE = 0.35; // soft-wipe feather, in local-v fractions

float edgeMask(float feather, float x) {
  float t = clamp(x / max(feather, 1e-5), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float rimBump(float feather, float x) {
  float s = edgeMask(feather, x);
  return 4.0 * s * (1.0 - s);
}

void main() {
  vec4 tex = texture2D(uMap, vUv);
  vec2 puv = uUvRect.xy + vUv * uUvRect.zw;

  float aL = edgeMask(uFeather.x, puv.x);
  float aR = edgeMask(uFeather.y, 1.0 - puv.x);
  float aT = edgeMask(uFeather.z, 1.0 - puv.y);
  float aB = edgeMask(uFeather.w, puv.y);
  float edge = aL * aR * aT * aB;

  float rimL = rimBump(uFeather.x, puv.x);
  float rimR = rimBump(uFeather.y, 1.0 - puv.x);
  float rimT = rimBump(uFeather.z, 1.0 - puv.y);
  float rimB = rimBump(uFeather.w, puv.y);
  float rim = max(max(rimL, rimR), max(rimT, rimB)) * uRim;

  // Top-to-bottom soft wipe: the patch KEEPS covering where x (distance
  // below the quad's top edge) is past the moving wipe edge; the message
  // underneath streams into existence from its first line down.
  float x = 1.0 - vUv.y;
  float e = -WIPE + uReveal * (1.0 + 2.0 * WIPE);
  float keep = smoothstep(e - WIPE, e + WIPE, x);

  vec3 color = tex.rgb + RIM_COLOR * rim;
  gl_FragColor = vec4(color, edge * uOpacity * keep);
}
`;

export interface ChatPatchHandle {
  material: THREE.ShaderMaterial;
  setOpacity: (v: number) => void;
  setReveal: (v: number) => void;
}

export function makeChatPatchMaterial(
  map: THREE.Texture,
  uvRect: { minU: number; minV: number; sizeU: number; sizeV: number },
  feather: PanelFeather = DEFAULT_PANEL_FEATHER,
  rimIntensity: number = DEFAULT_RIM_INTENSITY,
): ChatPatchHandle {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: 0 },
      uReveal: { value: 0 },
      uRim: { value: rimIntensity },
      uFeather: {
        value: new THREE.Vector4(feather.left, feather.right, feather.top, feather.bottom),
      },
      uUvRect: {
        value: new THREE.Vector4(uvRect.minU, uvRect.minV, uvRect.sizeU, uvRect.sizeV),
      },
    },
    vertexShader: VERTEX,
    fragmentShader: PATCH_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  return {
    material,
    setOpacity: (v: number) => {
      material.uniforms.uOpacity.value = v;
    },
    setReveal: (v: number) => {
      material.uniforms.uReveal.value = v;
    },
  };
}

/** Loads a panel's texture with the settings the craft brief calls for:
 *  mipmapped + anisotropic (panels sit at a slight angle and their apparent
 *  size changes with camera dolly, so real minification happens — unlike
 *  THE DRUMMER's depth mesh, which disables mipmaps for a different reason
 *  entirely). colorSpace stays NoColorSpace to match this Canvas's proven
 *  raw pipeline (drummerRig's loadAssets does the same, so a UI screenshot
 *  and a graded photo reproduce their source bytes identically side by
 *  side, not two different color-managed interpretations of "dark"). */
export function loadPanelTexture(url: string, maxAnisotropy: number): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = maxAnisotropy;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

let glowTextureCache: THREE.Texture | null = null;

/** A single procedurally-generated amber radial-gradient sprite, shared by
 *  both panels' glow planes (cheap: one canvas, one GPU upload, reused —
 *  "cheap and tasteful", no postprocessing bloom pass). */
export function glowTexture(): THREE.Texture {
  if (glowTextureCache) return glowTextureCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(245, 164, 92, 0.85)');
  grad.addColorStop(0.35, 'rgba(245, 164, 92, 0.45)');
  grad.addColorStop(0.7, 'rgba(245, 164, 92, 0.12)');
  grad.addColorStop(1, 'rgba(245, 164, 92, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  glowTextureCache = tex;
  return tex;
}

/**
 * A soft, abstracted echo of the bottom `sliceFrac` of a panel's own image —
 * NOT a crisp mirrored duplicate. An early version mirrored the real
 * texture directly and it read as a rendering bug (legible upside-down
 * button text under the panel), exactly the "old failure mode" this scene
 * exists to avoid — so this downsamples the slice to a handful of pixels
 * first (the classic cheap-blur-via-mip trick, done by hand on a tiny
 * canvas) before it ever reaches the GPU. What survives is color and
 * silhouette, never a readable word — a whisper, not a duplicate.
 */
export function blurredReflectionTexture(
  image: TexImageSource,
  sliceFrac: number,
): THREE.Texture {
  const srcW = 'width' in image ? image.width : 0;
  const srcH = 'height' in image ? image.height : 0;
  const sliceH = Math.max(1, Math.round(srcH * sliceFrac));
  const sy = Math.max(0, srcH - sliceH);
  const outW = 48;
  const outH = 14;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image as CanvasImageSource, 0, sy, srcW, sliceH, 0, 0, outW, outH);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

let reflectionAlphaCache: THREE.Texture | null = null;

/** A vertical grayscale gradient for each panel's whisper-of-reflection
 *  plane. `alphaMap` reads a material's GREEN CHANNEL (three.js's
 *  alphamap_fragment chunk), not the canvas's own alpha channel, so this
 *  must be an opaque grayscale gradient, not a fading-alpha fill (a fading
 *  fill would upload a texture whose green channel is constant 255 —
 *  looking fully opaque everywhere no matter how transparent the pixels the
 *  canvas 2D API drew look on their own).
 *
 *  Orientation: the reflection mesh's UV V=0 lands at the mirror-line edge
 *  (touching the panel's real bottom edge — see BuilderScene.tsx's
 *  reflection setup), and with the default texture flipY, canvas-pixel-row
 *  0 (this gradient's FIRST addColorStop) becomes texture V=1, the FAR
 *  edge. So the mirror-line end (V=0, which should read brightest) is the
 *  gradient's LAST stop: black at row 0, white at row h. */
export function reflectionAlphaTexture(): THREE.Texture {
  if (reflectionAlphaCache) return reflectionAlphaCache;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgb(0,0,0)');
  grad.addColorStop(1, 'rgb(255,255,255)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  reflectionAlphaCache = tex;
  return tex;
}
