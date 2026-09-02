// THE NEIGHBORHOOD's fragment treatment for beat 1's depth mesh — the same
// shape as patchDadMaterial.ts (edge feather + scroll-driven opacity, no
// occlusion half), with this scene's own feather widths. makeDepthMesh stays
// byte-verbatim; only the returned material's fragment shader is replaced.
import * as THREE from 'three';
import { FEATHER } from './neighborhoodRig';

const FRAGMENT = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform float uOpacity;
  uniform vec4 uFeather; // left, right, top, bottom in UV fractions

  varying vec2 vUv;

  void main() {
    vec3 col = texture2D(uPhoto, vUv).rgb;
    float edge =
      smoothstep(0.0, uFeather.x, vUv.x) *
      smoothstep(0.0, uFeather.y, 1.0 - vUv.x) *
      smoothstep(0.0, uFeather.z, 1.0 - vUv.y) *
      smoothstep(0.0, uFeather.w, vUv.y);
    float alpha = edge * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface NbhdUniforms {
  uOpacity: THREE.IUniform<number>;
  uFeather: THREE.IUniform<THREE.Vector4>;
}

/** Patch a makeDepthMesh mesh for beat 1. Returns the added uniforms. */
export function patchNbhdMaterial(mesh: THREE.Mesh): NbhdUniforms {
  const material = mesh.material as THREE.ShaderMaterial;
  const added: NbhdUniforms = {
    uOpacity: { value: 0 },
    uFeather: {
      value: new THREE.Vector4(FEATHER.left, FEATHER.right, FEATHER.top, FEATHER.bottom),
    },
  };
  Object.assign(material.uniforms, added);
  material.fragmentShader = FRAGMENT;
  material.transparent = true;
  material.depthWrite = false;
  material.needsUpdate = true;
  return added;
}
