// THE DAD's fragment treatment for the depth mesh: makeDepthMesh stays
// byte-verbatim (the vertex displacement — the parallax law — is untouched);
// this patch only replaces the returned material's FRAGMENT shader, mirroring
// THE DRUMMER's patchDrummerMaterial.ts minus its foreground-occlusion half —
// there is no name card behind either of these photographs, so the shader
// only needs the edge feather (the photo melting into the dusk ground) and a
// scroll-driven opacity, no uFgOnly/depth-gate branch at all.
import * as THREE from 'three';
import { FEATHER } from './dadRig';

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

export interface DadUniforms {
  uOpacity: THREE.IUniform<number>;
  uFeather: THREE.IUniform<THREE.Vector4>;
}

/** Patch a makeDepthMesh mesh for THE DAD. Returns the added uniforms. */
export function patchDadMaterial(mesh: THREE.Mesh): DadUniforms {
  const material = mesh.material as THREE.ShaderMaterial;
  const added: DadUniforms = {
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
