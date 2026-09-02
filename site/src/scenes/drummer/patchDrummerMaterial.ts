// Scene-1 fragment treatment for the depth mesh: makeDepthMesh stays
// byte-verbatim (it's the locked engine); this patch REPLACES the returned
// material's fragment shader — the vertex displacement (the parallax law)
// is untouched, so the photo canvas and the occlusion canvas displace
// IDENTICALLY and their pixels register exactly.
//
// Two modes from one shader (uFgOnly):
//   0 — the full portrait, edge-feathered into the dusk ground (alpha
//       falls off over per-edge UV bands; the DOM gradient behind the
//       canvas is the dusk itself, so the feather IS the melt).
//   1 — the FOREGROUND CUTOUT: same frame, alpha additionally gated by the
//       depth map (NEAR = BRIGHT). Rendered in a second canvas ABOVE the
//       DOM display type — Zak and the kit occlude the name per-pixel; the
//       flag never does. This is the depth-mask signature move.
import * as THREE from 'three';
import { FEATHER, FG_LO, FG_HI } from './drummerRig';

const FRAGMENT = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform sampler2D uDepth;
  uniform float uOpacity;
  uniform vec4 uFeather; // left, right, top, bottom in UV fractions
  uniform float uFgLo;
  uniform float uFgHi;
  uniform float uFgOnly;

  varying vec2 vUv;

  void main() {
    vec3 col = texture2D(uPhoto, vUv).rgb;
    float edge =
      smoothstep(0.0, uFeather.x, vUv.x) *
      smoothstep(0.0, uFeather.y, 1.0 - vUv.x) *
      smoothstep(0.0, uFeather.z, 1.0 - vUv.y) *
      smoothstep(0.0, uFeather.w, vUv.y);
    float alpha = edge * uOpacity;
    if (uFgOnly > 0.5) {
      float d = texture2D(uDepth, vUv).r;
      alpha *= smoothstep(uFgLo, uFgHi, d);
    }
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface DrummerUniforms {
  uOpacity: THREE.IUniform<number>;
  uFeather: THREE.IUniform<THREE.Vector4>;
  uFgLo: THREE.IUniform<number>;
  uFgHi: THREE.IUniform<number>;
  uFgOnly: THREE.IUniform<number>;
}

/** Patch a makeDepthMesh mesh for Scene 1. Returns the added uniforms. */
export function patchDrummerMaterial(
  mesh: THREE.Mesh,
  { fgOnly }: { fgOnly: boolean },
): DrummerUniforms {
  const material = mesh.material as THREE.ShaderMaterial;
  const added: DrummerUniforms = {
    uOpacity: { value: 0 },
    uFeather: {
      value: new THREE.Vector4(
        FEATHER.left,
        FEATHER.right,
        FEATHER.top,
        FEATHER.bottom,
      ),
    },
    uFgLo: { value: FG_LO },
    uFgHi: { value: FG_HI },
    uFgOnly: { value: fgOnly ? 1 : 0 },
  };
  Object.assign(material.uniforms, added);
  material.fragmentShader = FRAGMENT;
  material.transparent = true;
  material.depthWrite = false;
  material.needsUpdate = true;
  return added;
}
