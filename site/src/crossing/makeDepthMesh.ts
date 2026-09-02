// EXTRACTED UNCHANGED from site/experiments/a2-crossing/src/makeDepthMesh.ts
// (production-slice Task 2). Original header follows.
//
// COPIED from site/experiments/a-depth-mesh/src/makeDepthMesh.ts (Task 6) with
// ONE substantive change for the crossing: displacement runs along the ray from
// a FIXED origin (`uDisplaceOrigin` — the photo's capture/rest camera position)
// instead of the live `cameraPosition`.
//
// Why: displacing a vertex along the ray from the CURRENT camera through that
// vertex leaves its projected screen position unchanged BY CONSTRUCTION (any
// point on the camera->vertex line projects to the same pixel), so the live-
// camera formulation cannot produce geometric parallax — only sub-pixel
// perspective-interpolation warps inside each ~3px triangle. With a fixed
// origin, the identity still holds exactly when the live camera SITS at that
// origin (progress = 0 stays byte-identical to the flat photo, displacement
// active or not), and camera motion away from it now yields true parallax.
// Verified empirically in this sandbox — see NOTES.md (Task 8).
import * as THREE from "three";

export interface MakeDepthMeshOptions {
  /**
   * Vertex-grid resolution along the LONGER side of the plane (the shorter
   * side is derived from the photo's own aspect ratio, so a 4:3 photo gets
   * a segments x (segments * 3/4) grid, not a square one). Default 384
   * (-> ~384x288 for a 4:3 photo, ~110k vertices — comfortably 60fps on a
   * modern discrete/integrated GPU for a single fullscreen quad).
   */
  segments?: number;
  /**
   * World-unit displacement range applied at full confidence: a texel with
   * depth=1 (nearest) moves +depthScale/2 toward the camera along the
   * per-vertex camera ray, depth=0 (farthest) moves -depthScale/2 away.
   * Exposed afterward as `mesh.material.uniforms.uDepthScale.value` so a
   * caller can animate it (e.g. ramp 0 -> full across a scroll-driven
   * "wake up" beat) without rebuilding the mesh. Default 0.35.
   */
  depthScale?: number;
}

const DEFAULT_SEGMENTS = 384;
const DEFAULT_DEPTH_SCALE = 0.35;

// Confidence-map tuning (feathers/clamps displacement near depth
// discontinuities so noisy regions -- see hero.depth.png's trampoline-net
// "hard case" -- settle toward a flat, coherent plane instead of smearing).
// Working resolution for the one-time CPU edge pass; independent of the
// mesh's vertex-segment count and of the depth texture's own pixel size.
const CONFIDENCE_WORK_WIDTH = 512;
// Normalized-gradient smoothstep band: below EDGE_LOW reads as "flat,
// full confidence"; above EDGE_HIGH reads as "a real depth discontinuity,
// zero confidence, don't displace". Tuned empirically against the hero
// photo (see NOTES.md) to let the playhouse/path/canopy edges stay crisp
// while damping the trampoline-net's high-frequency depth noise.
const EDGE_LOW = 0.05;
const EDGE_HIGH = 0.22;

/**
 * Builds a displaced-plane mesh from a photo texture and a matching
 * single-channel depth texture (NEAR = BRIGHT convention: 1.0 = closest to
 * camera, 0.0 = farthest).
 *
 * The plane is built in the photo's own aspect ratio at unit scale (width
 * 1, height 1/aspect), centered at the origin, facing +Z — callers own all
 * viewport framing (scale/position the returned mesh, or move the camera)
 * since that's scene-specific, not something this reusable core should
 * assume.
 *
 * Displacement happens along the per-vertex CAMERA VIEW RAY (not the mesh
 * normal) in the vertex shader, which reads correctly under camera
 * translation/dolly even near the frame edges, where a normal-based push
 * and a camera-ray push diverge under perspective projection.
 *
 * A confidence/edge mask is computed once, synchronously, from the depth
 * texture's own image data (a Sobel gradient pass on a downscaled working
 * copy, blurred going in and coming out) and used to feather/clamp
 * displacement near depth discontinuities. `depthTex.image` must already be
 * a loaded, readable image (HTMLImageElement/HTMLCanvasElement/ImageBitmap)
 * at call time -- await texture loads before calling this.
 *
 * Callers are responsible for texture color management: for a raw
 * `texture2D` sample to reproduce the source photo's bytes unmodified
 * (e.g. to match a DOM <img> pixel-for-pixel during a FLIP swap), set
 * `photoTex.colorSpace = THREE.NoColorSpace` before calling.
 */
export function makeDepthMesh(
  photoTex: THREE.Texture,
  depthTex: THREE.Texture,
  options: MakeDepthMeshOptions = {}
): THREE.Mesh {
  const segments = Math.max(2, Math.floor(options.segments ?? DEFAULT_SEGMENTS));
  const depthScale = options.depthScale ?? DEFAULT_DEPTH_SCALE;

  const img = photoTex.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img?.height ? img.width / img.height : 4 / 3;

  const segX = aspect >= 1 ? segments : Math.max(2, Math.round(segments * aspect));
  const segY = aspect >= 1 ? Math.max(2, Math.round(segments / aspect)) : segments;

  const width = 1;
  const height = 1 / aspect;
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);

  const confidenceTex = computeConfidenceTexture(depthTex);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPhoto: { value: photoTex },
      uDepth: { value: depthTex },
      uConfidence: { value: confidenceTex },
      uDepthScale: { value: depthScale },
      // The capture/rest camera position. Displacement rays emanate from HERE
      // (not from the live camera — see file header). Callers must set this
      // to the solved cover-fit rest position, and update it on resize.
      uDisplaceOrigin: { value: new THREE.Vector3(0, 0, 1) },
      // Debug escape hatch for the parallax probe: 1 = original Task 6
      // behavior (displace along the LIVE camera ray).
      uUseLiveCameraOrigin: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uDepth;
      uniform sampler2D uConfidence;
      uniform float uDepthScale;
      uniform vec3 uDisplaceOrigin;
      uniform float uUseLiveCameraOrigin;

      varying vec2 vUv;

      void main() {
        vUv = uv;

        float depth = texture2D(uDepth, uv).r;             // 0..1, NEAR = BRIGHT
        float confidence = texture2D(uConfidence, uv).r;    // 1 = flat/coherent, 0 = at a depth edge

        float amount = (depth - 0.5) * uDepthScale * confidence;

        vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
        vec3 worldPos = worldPos4.xyz;

        // Ray from the CAPTURE origin to this vertex, in world space: the
        // photo's pixels un-project back along the rays that captured them.
        // When the live camera sits at the origin the image is exactly the
        // flat photo (identity); when it moves, near/far separation appears
        // as true parallax. (uUseLiveCameraOrigin=1 restores the Task 6
        // live-camera ray for A/B probing — geometrically inert.)
        vec3 origin = mix(uDisplaceOrigin, cameraPosition, uUseLiveCameraOrigin);
        vec3 viewDir = normalize(worldPos - origin);
        vec3 displaced = worldPos - viewDir * amount;

        gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPhoto;
      varying vec2 vUv;

      void main() {
        gl_FragColor = vec4(texture2D(uPhoto, vUv).rgb, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "depth-mesh";
  return mesh;
}

/**
 * One-time CPU pass: draws the depth texture's image to an offscreen
 * canvas at a small working resolution, blurs it (suppresses per-pixel
 * sensor/model noise -- the trampoline-net region is genuinely noisy, see
 * NOTES.md), computes a Sobel gradient magnitude, maps it through a
 * smoothstep band to a 0..1 confidence value (1 = flat, 0 = at an edge),
 * blurs THAT once more (feathers the mask itself so damping fades in
 * rather than switching off with a hard edge), and uploads it as a
 * single-channel DataTexture for the shader to sample alongside uDepth.
 */
function computeConfidenceTexture(depthTex: THREE.Texture): THREE.DataTexture {
  const img = depthTex.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined;

  const srcW = (img as any)?.naturalWidth || (img as any)?.width;
  const srcH = (img as any)?.naturalHeight || (img as any)?.height;

  if (!img || !srcW || !srcH) {
    // Fallback: no readable image data -> full confidence everywhere
    // (no feathering, equivalent to the brief's plain starter shader).
    const data = new Uint8Array([255]);
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
    tex.needsUpdate = true;
    return tex;
  }

  const w = CONFIDENCE_WORK_WIDTH;
  const h = Math.max(2, Math.round((w * srcH) / srcW));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h).data; // RGBA, depth stored in R

  // Extract single-channel depth (0..1) and box-blur once (3x3) to
  // suppress high-frequency noise before edge detection.
  const depth = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) depth[i] = src[i * 4] / 255;
  const blurred = boxBlur(depth, w, h);

  // Sobel gradient magnitude on the blurred depth field.
  const grad = new Float32Array(w * h);
  let maxGrad = 1e-6;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -blurred[(y - 1) * w + (x - 1)] + blurred[(y - 1) * w + (x + 1)] +
        -2 * blurred[y * w + (x - 1)] + 2 * blurred[y * w + (x + 1)] +
        -blurred[(y + 1) * w + (x - 1)] + blurred[(y + 1) * w + (x + 1)];
      const gy =
        -blurred[(y - 1) * w + (x - 1)] - 2 * blurred[(y - 1) * w + x] - blurred[(y - 1) * w + (x + 1)] +
        blurred[(y + 1) * w + (x - 1)] + 2 * blurred[(y + 1) * w + x] + blurred[(y + 1) * w + (x + 1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      grad[y * w + x] = mag;
      if (mag > maxGrad) maxGrad = mag;
    }
  }

  // Normalize + smoothstep into confidence (1 - edge strength), then
  // feather the mask itself with one more box blur.
  const confidence = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const norm = Math.min(1, grad[i] / (maxGrad * 0.6 || 1));
    const edge = smoothstep(EDGE_LOW, EDGE_HIGH, norm);
    confidence[i] = 1 - edge;
  }
  const feathered = boxBlur(confidence, w, h);

  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = Math.max(0, Math.min(255, Math.round(feathered[i] * 255)));

  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  // THREE.DataTexture defaults flipY=false, unlike ordinary Texture
  // (flipY=true, used for uPhoto/uDepth). The confidence array above was
  // written row-major top-to-bottom via canvas drawImage/getImageData --
  // same orientation as the source depth image -- so flipY must be forced
  // true here too, or the mask samples upside-down relative to uDepth.
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx];
          count++;
        }
      }
      out[y * w + x] = sum / count;
    }
  }
  return out;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
