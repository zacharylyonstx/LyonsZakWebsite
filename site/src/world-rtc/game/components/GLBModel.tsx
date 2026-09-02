// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/GLBModel.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { Component, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeElements } from '@react-three/fiber';

/**
 * Reusable loader for the procedurally-generated GLB props (Meshy). All our GLB
 * assets are STATIC (no skeletal animation) — characters stay procedural — so a
 * plain `scene.clone(true)` is correct here (SkeletonUtils is only needed for
 * skinned meshes).
 *
 * Models are cached per-URL by drei's `useGLTF`; we clone per mount so transforms
 * and per-instance tinting don't leak across instances.
 *
 * Sizing: pass `fitHeight` to auto-scale the model to a target world height and
 * plant its base at the group origin (centered on X/Z) — robust against Meshy's
 * arbitrary export scale. Otherwise pass an explicit `scale`.
 *
 * `tint` recolors cloned materials (per-instance). By default every mesh is
 * tinted; pass `tintFilter` to recolor only matching meshes (e.g. a car body but
 * not its glass/wheels).
 */
type Props = {
  url: string;
  /** Auto-scale so the model is this tall (world units) and grounded at base. */
  fitHeight?: number;
  /** Auto-scale so the model is this wide (max of X/Z extent), grounded at base.
   *  Use for wide/flat objects (saucers, decks) where height is the wrong axis. */
  fitWidth?: number;
  /** Explicit scale when not using fit*. Uniform, or [x,y,z]. */
  scale?: number | [number, number, number];
  /** Y rotation in radians applied to the model (orientation fix). */
  rotationY?: number;
  /** Center the model vertically on the group origin instead of grounding its base. */
  centerY?: boolean;
  /** Extra local position offset applied after fit/ground. */
  position?: [number, number, number];
  /** Recolor cloned materials to this hex. */
  tint?: string;
  /** When tinting, only recolor meshes that pass this test. */
  tintFilter?: (mesh: THREE.Mesh) => boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
} & Omit<ThreeElements['group'], 'scale' | 'position' | 'rotation'>;

/**
 * If a GLB fails to load (404, bad network, decode error), render nothing for
 * just that model instead of letting the thrown error unmount the whole Canvas.
 * Critical for a live multiplayer session — one missing asset must not black-screen.
 */
class ModelErrorBoundary extends Component<{ url: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn(`[GLBModel] failed to load ${this.props.url} — rendering without it`, err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function GLBModel(props: Props) {
  return (
    <ModelErrorBoundary url={props.url}>
      <GLBModelInner {...props} />
    </ModelErrorBoundary>
  );
}

function GLBModelInner({
  url,
  fitHeight,
  fitWidth,
  centerY = false,
  scale = 1,
  rotationY = 0,
  position = [0, 0, 0],
  tint,
  tintFilter,
  castShadow = true,
  receiveShadow = true,
  ...groupProps
}: Props) {
  const { scene } = useGLTF(url);

  const { cloned, autoScale, baseOffset } = useMemo(() => {
    const root = scene.clone(true);
    const tintColor = tint ? new THREE.Color(tint) : null;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      if (tintColor && (!tintFilter || tintFilter(mesh))) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clo_ = mats.map((m) => {
          const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
          if (c.color) c.color.copy(tintColor);
          return c;
        });
        mesh.material = clo_.length === 1 ? clo_[0] : clo_;
      }
    });
    // Measure at natural scale, then derive auto-scale + a base-grounding offset.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const natH = size.y || 1;
    const natW = Math.max(size.x, size.z) || 1;
    const s = fitWidth ? fitWidth / natW : fitHeight ? fitHeight / natH : 1;
    const offset: [number, number, number] = [-center.x, centerY ? -center.y : -box.min.y, -center.z];
    return { cloned: root, autoScale: s, baseOffset: offset };
  }, [scene, tint, tintFilter, castShadow, receiveShadow, fitHeight, fitWidth, centerY]);

  const explicit: [number, number, number] = typeof scale === 'number' ? [scale, scale, scale] : scale;
  const autoFit = fitHeight != null || fitWidth != null;
  const s: [number, number, number] = autoFit
    ? [autoScale, autoScale, autoScale]
    : explicit;

  return (
    <group {...groupProps} position={position} rotation={[0, rotationY, 0]} scale={s}>
      <primitive object={cloned} position={autoFit ? baseOffset : [0, 0, 0]} />
    </group>
  );
}
