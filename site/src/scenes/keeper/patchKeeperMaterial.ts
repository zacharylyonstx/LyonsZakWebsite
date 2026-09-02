// THE KEEPER's fragment treatment for the sign's depth mesh: makeDepthMesh
// stays byte-verbatim (the vertex displacement — the parallax law — is
// untouched); this patch only replaces the returned material's FRAGMENT
// shader — THE DAD's patchDadMaterial.ts verbatim in structure (edge feather
// + scroll-driven opacity, no occlusion half: nothing sits behind the sign
// for type to dive under), re-created per-scene rather than cross-imported
// because the feather constant is this scene's own (the standing pattern —
// each scene's patch reads its own feather.json through its own rig).
import * as THREE from 'three';
import { FEATHER } from './keeperRig';

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

export interface KeeperUniforms {
  uOpacity: THREE.IUniform<number>;
  uFeather: THREE.IUniform<THREE.Vector4>;
}

/** Patch a makeDepthMesh mesh for THE KEEPER. Returns the added uniforms. */
export function patchKeeperMaterial(mesh: THREE.Mesh): KeeperUniforms {
  const material = mesh.material as THREE.ShaderMaterial;
  const added: KeeperUniforms = {
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
