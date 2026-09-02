// THE WEIRD ONES's own TV material — a period set sitting in the dark,
// built as one flat plane with a shader (panelMaterial.ts's approach,
// extended): a dark bezel drawn straight in the fragment shader (no wood-
// grain texture, no 3D model — the brief's own "simple, tasteful CRT
// frame... NOT a skeuomorphic 3D model unless you can make it gorgeous
// cheaply") around a rounded-rect screen inset that samples the broadcast's
// own texture, with purely SPATIAL (UV-based, never time-based) scanline
// and vignette modulation — the shader itself stays a pure function of
// (uv, uOpacity), so the ONLY non-deterministic input anywhere in this
// scene is the video texture's own decoded frame (the signed wall-clock
// exception — see WeirdScene.tsx's header + scene6-report.md).
//
// uMap accepts EITHER a THREE.VideoTexture (the live edition, silently
// looping) or a plain static THREE.Texture (reducedMotion's own frozen EAS
// frame) — same texture-agnostic pattern panelMaterial.ts already uses, so
// both editions share pixel-identical bezel/scanline/vignette framing.
import * as THREE from 'three';

export interface ScreenMargin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

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
uniform vec4 uScreenMargin; // left, right, top, bottom (UV fractions of the OUTER plane)
uniform float uOuterRadius; // corner radius of the outer bezel silhouette (UV units)
uniform float uScreenRadius; // corner radius of the inner screen (screen-local UV units)
uniform float uFeather; // outer-edge feather width (UV units) — melts into the dusk
varying vec2 vUv;

const vec3 RIM_COLOR = vec3(0.94, 0.9, 0.8);

// Signed distance to a rounded box centered at the origin — p is already
// re-centered (uv - 0.5), b is the half-size, r the corner radius.
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  // Outer silhouette — the whole TV's own rounded-rect shape, feathered at
  // its true edge so the set melts into the dusk void exactly like every
  // other panel in the film (panelMaterial.ts's edgeMask, generalized from
  // a plain rect to a rounded one).
  vec2 op = vUv - 0.5;
  float outerDist = sdRoundBox(op, vec2(0.5), uOuterRadius);
  float outerMask = 1.0 - smoothstep(0.0, max(uFeather, 1e-4), outerDist);

  // The screen region, remapped to its own local 0..1 UV.
  vec2 sUv = vec2(
    (vUv.x - uScreenMargin.x) / max(1.0 - uScreenMargin.x - uScreenMargin.y, 1e-4),
    (vUv.y - uScreenMargin.w) / max(1.0 - uScreenMargin.z - uScreenMargin.w, 1e-4)
  );
  vec2 sp = sUv - 0.5;
  float screenDist = sdRoundBox(sp, vec2(0.5), uScreenRadius);
  // A crisp (manufactured-looking) screen edge — a much narrower AA band
  // than the outer feather, which is meant to dissolve into dusk instead.
  float screenMask = 1.0 - smoothstep(-0.004, 0.004, screenDist);

  vec3 videoColor = texture2D(uMap, clamp(sUv, 0.0, 1.0)).rgb;
  // Scanlines — a fixed count across the screen's own height, a pure
  // function of UV (never gl_FragCoord, never time): identical at every
  // DPR and identical on every repeated render of the same frame.
  float scan = 0.88 + 0.12 * sin(sUv.y * 210.0);
  videoColor *= scan;
  // A soft vignette toward the screen's own corners — a CRT's tube curve,
  // cheaply implied without any actual geometric curvature.
  float vig = 1.0 - 0.35 * smoothstep(0.36, 0.72, length(sp));
  videoColor *= vig;
  // Phosphor floor: even a "black" broadcast frame reads as a lit tube, not
  // a dead rectangle.
  videoColor = max(videoColor, vec3(0.012, 0.018, 0.024));

  // The bezel — a plain dark vertical gradient (molded plastic, not wood
  // grain: this is a period TV/monitor, not a console furniture piece).
  vec3 bezelTop = vec3(0.078, 0.074, 0.08);
  vec3 bezelBottom = vec3(0.034, 0.031, 0.038);
  vec3 bezelColor = mix(bezelBottom, bezelTop, vUv.y);
  // A thin rim highlight tracing the screen's own frame — panelMaterial's
  // rimBump idea, applied to the screen's SDF instead of a plain rect edge.
  float rim = (1.0 - smoothstep(0.0, 0.03, abs(screenDist))) * (1.0 - screenMask);
  bezelColor += RIM_COLOR * rim * 0.45;

  vec3 color = mix(bezelColor, videoColor, screenMask);
  gl_FragColor = vec4(color, outerMask * uOpacity);
}
`;

export interface TvMaterialHandle {
  material: THREE.ShaderMaterial;
  setOpacity: (v: number) => void;
}

export function makeTvMaterial(
  map: THREE.Texture,
  screenMargin: ScreenMargin,
  outerRadius = 0.05,
  screenRadius = 0.04,
  feather = 0.035,
): TvMaterialHandle {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: 0 },
      uScreenMargin: {
        value: new THREE.Vector4(
          screenMargin.left,
          screenMargin.right,
          screenMargin.top,
          screenMargin.bottom,
        ),
      },
      uOuterRadius: { value: outerRadius },
      uScreenRadius: { value: screenRadius },
      uFeather: { value: feather },
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

/** The live edition's video texture — muted/loop/playsInline, decoded from
 *  a SILENT source file (the broadcast loop ships with no audio track at
 *  all, stripped at prepare time — belt-and-suspenders against the
 *  no-autoplay-with-sound law: there is no sound to unmute even in
 *  principle). Not started here — the caller (WeirdScene.tsx) calls
 *  .play() once mounted, matching the record/desk-video precedent of an
 *  explicit, guarded play() rather than the `autoplay` attribute. */
export function makeTvVideoElement(src: string): HTMLVideoElement {
  const video = document.createElement('video');
  // Attributes set BEFORE `src` — Safari/WebKit in particular can ignore
  // muted/playsInline set after load has already begun. Appended to the
  // document (visually hidden, off-screen) rather than left detached: some
  // engines throttle or never advance readyState for a video element that
  // is never attached to the DOM, which silently starves the VideoTexture
  // of decoded frames (caught live — see scene6-report.md).
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.style.position = 'fixed';
  video.style.width = '2px';
  video.style.height = '2px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.tabIndex = -1;
  video.src = src;
  document.body.appendChild(video);
  return video;
}

export function makeTvVideoTexture(video: HTMLVideoElement): THREE.VideoTexture {
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

let coolGlowCache: THREE.Texture | null = null;

/** A cool blue-white radial-gradient sprite — the film's one deliberate
 *  departure from the amber glow every other point of light uses (the
 *  drummer's stage light, the sparkler, the record's sleeve): a CRT tube
 *  actually glows cool, and the contrast against the dusk's warm palette is
 *  exactly what makes the TV read as a real light source in a dark room
 *  rather than another warm object. */
export function coolGlowTexture(): THREE.Texture {
  if (coolGlowCache) return coolGlowCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(190, 225, 255, 0.8)');
  grad.addColorStop(0.35, 'rgba(120, 180, 255, 0.4)');
  grad.addColorStop(0.7, 'rgba(90, 150, 240, 0.12)');
  grad.addColorStop(1, 'rgba(90, 150, 240, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  coolGlowCache = tex;
  return tex;
}
