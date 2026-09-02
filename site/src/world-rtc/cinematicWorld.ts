// EXTRACTED UNCHANGED from site/experiments/a2-crossing/src/cinematicWorld.ts
// (production-slice Task 2). Behavior identical; only its location moved with
// the vendored world subset it governs.
//
// cinematicWorld.ts — G1.1 Task 3: the ONE auditable place where every
// camera-path-aware culling/stripping/batching decision for the crossing
// cinematic lives as data.
//
// Spec (Zak, docs/g1-verdict-2026-08-28.md §SECOND): "This is not the game.
// This is a CINEMATIC VERSION of part of the game's world. We know where the
// camera goes. Exploit that aggressively. We should not pay runtime cost for
// things the visitor cannot see."
//
// ---------------------------------------------------------------------------
// FRUSTUM-OVER-TIME AUDIT (2026-08-28, __crossing.frustumAudit())
// ---------------------------------------------------------------------------
// Protocol: swept the departure path p = 0 → 1 in steps of 0.02; at each step
// built the timeline's world camera with safety margin (fov +10°, aspect
// ×1.15, look-around tolerance) and tested every NAMED top-level world object
// (each lot-XXXXX group, each greenbelt oak, street, ramp, ground,
// wildflowers, distantScenery) via Box3 (expanded 2 m) vs Frustum. The
// projector (matched-pose photo camera) frustum was included in the union —
// the photo depth prepass must keep every occluder the photograph saw.
//
// RESULT — the honest one: the kill list is EMPTY at top-level granularity.
// The path's final third looks straight down the full length of Royal Tara
// Cove (keyframe t=10 sits at the hero mailbox looking north to the entry),
// so every lot, every greenbelt oak, the street, and the distant-scenery ring
// enter the frustum during p ≈ 0.48–1.0. Nothing whole can be deleted.
// (Raw sweep: ground/lot-10600/distantScenery visible p 0.00–1.00; everything
// else enters between p 0.48 and 0.54 and stays to 1.0.)
//
// The cost problem is therefore NOT "objects behind the camera" (three.js
// already frustum-culls those per mesh) — it is that the street reveal shows
// ~5,000 draw calls of legitimately-visible geometry at once. The wins below
// attack that: gameplay-only imports that are invisible by construction,
// instancing, per-material geometry merging, material dedupe, and a frozen
// shadow map (static scene + static sun ⇒ the per-frame shadow pass is pure
// waste).
export const FRUSTUM_KILL_LIST: { lots: string[]; objects: string[] } = {
  lots: [],
  objects: [],
};

// ---------------------------------------------------------------------------
// GAMEPLAY-ONLY CUTS (invisible by construction in this cinematic)
// ---------------------------------------------------------------------------
// - neighborInteriors: every non-hero house mounts a furnished HouseInterior
//   (wood floor, rug, 5 GLB furniture pieces, lamp glow…). In the game you
//   can walk in; in the cinematic every door/garage/window is closed opaque
//   geometry, and the isNearPlayer(24 m) gate is measured against a FIXED
//   spawn (there is no player controller here), so 24 of 25 interiors are
//   visible=false forever and one (10604, 21.4 m from the fixed spawn) is
//   drawn every frame yet 100% occluded. Cut = ~125 GLB clones never mounted.
//   (Interior10600 is already stubbed to null in this sandbox.)
// - Tornado debris/rubble/dust apparatus in House.tsx stays: it is
//   visible=false, contributes zero draw calls, and cutting it would mean
//   invasive vendored-file surgery for no frame-time gain.
export const GAMEPLAY_ONLY_CUTS = {
  neighborInteriors: true,
};

// ---------------------------------------------------------------------------
// Staged optimization flags (?opt= query; measurement protocol)
// ---------------------------------------------------------------------------
// Default (no ?opt= param) is the SHIP config: everything on.
//   ?opt=none                       — untouched vendored world (baseline)
//   ?opt=kill                       — stage 1: gameplay-only cuts
//   ?opt=kill,instance              — stage 2: + InstancedMesh for repeated GLBs
//   ?opt=kill,instance,merge        — stage 3: + per-material static merge
//   ?opt=kill,instance,merge,shadow — stage 4: + frozen shadow map
//   ?opt=kill,instance,merge,shadow,dedupe — stage 5 (= default): + material
//     dedupe (merge keyed on material PROPERTIES, not instance identity, and
//     the shingle-material cache in materials.ts).
export interface CinematicOpts {
  kill: boolean;
  instance: boolean;
  merge: boolean;
  shadowFreeze: boolean;
  dedupe: boolean;
}

function parseOpts(): CinematicOpts {
  const all: CinematicOpts = {
    kill: true,
    instance: true,
    merge: true,
    shadowFreeze: true,
    dedupe: true,
  };
  if (typeof window === 'undefined') return all;
  const raw = new URLSearchParams(window.location.search).get('opt');
  if (raw == null) return all;
  const set = new Set(raw.split(',').map((s) => s.trim()));
  return {
    kill: set.has('kill'),
    instance: set.has('instance'),
    merge: set.has('merge'),
    shadowFreeze: set.has('shadow'),
    dedupe: set.has('dedupe'),
  };
}

export const cinematicOpts: CinematicOpts = parseOpts();

// ---------------------------------------------------------------------------
// The static-batch pass (stages 2/3/5)
// ---------------------------------------------------------------------------
// The vendored world renders ~5,600 individual meshes (window muntins, shutter
// slats, fence panels, per-house JSX materials…). The whole scene is STATIC in
// the cinematic (every wall-clock animation was frozen in Task 8 fix round 1;
// there is no player), so:
//   • meshes sharing one geometry+material (GLB clones: oaks, crepe myrtles,
//     mailboxes, car parts…) become ONE InstancedMesh (instance = matrixWorld);
//   • remaining static meshes are merged per material into single draws, with
//     world transforms baked into the geometry (mergeGeometries);
//   • with `dedupe`, the merge groups by material PROPERTY key instead of
//     material instance, collapsing the hundreds of visually-identical inline
//     JSX materials (trim boards, muntins, slats…) into one draw each.
//
// PROJECTION INVARIANT (do not break): the crossing patches world materials
// via onBeforeCompile and computes vCrossWorldPos from
// modelMatrix · (instanceMatrix ·) position (crossing.frag.glsl VERT_POS,
// USE_INSTANCING-aware), and the projector depth prepass shader is also
// instancing-aware. Batched output reuses the SAME (already patched) material
// instances: merged meshes sit at the scene root (modelMatrix = identity,
// world position baked into the position attribute — the projection sees
// identical world coordinates), instanced meshes carry each source's
// matrixWorld in instanceMatrix. Both were verified against the reversibility
// byte-diff sweep and before/after stills at p = 0.14 / 0.30 (photo-heavy
// region) — see site/experiments/recordings/g11/perf-before-after.md.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Meshes repeated this many times (same geometry+material) get instanced. */
const INSTANCE_MIN = 4;
/** Merge groups need at least this many members to be worth a batched mesh. */
const MERGE_MIN = 2;

interface BatchState {
  outputs: THREE.Object3D[];
  hiddenSources: THREE.Mesh[];
  lastCandidateCount: number;
}

const batchState: BatchState = { outputs: [], hiddenSources: [], lastCandidateCount: -1 };

/** Visible through the whole ancestor chain AND not under a crossingNoBatch
 *  subtree (dynamic, store-positioned objects — e.g. ParkedCar — must never
 *  be baked; their transforms settle over the first frames and a bake can
 *  race them). */
function batchableInHierarchy(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (!o.visible) return false;
    if ((o.userData as Record<string, unknown>).crossingNoBatch) return false;
    o = o.parent;
  }
  return true;
}

function isBatchableMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  const mesh = obj as THREE.Mesh;
  if (!mesh.isMesh) return false;
  if ((mesh as THREE.InstancedMesh).isInstancedMesh) return false;
  if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return false;
  const ud = mesh.userData as Record<string, unknown>;
  if (ud.crossingReceiver || ud.crossingBackstop || ud.crossingBatched) return false;
  if (Array.isArray(mesh.material)) return false;
  const m = mesh.material as THREE.Material & {
    isShaderMaterial?: boolean;
    isRawShaderMaterial?: boolean;
    isTroikaTextMaterial?: boolean;
  };
  if (!m || m.isShaderMaterial || m.isRawShaderMaterial || m.isTroikaTextMaterial) return false;
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) return false;
  if (mesh.renderOrder !== 0) return false;
  if (!batchableInHierarchy(mesh)) return false;
  return true;
}

/** Conservative material identity: every visually-meaningful property. Two
 *  materials merge under `dedupe` ONLY when every one of these matches
 *  (including the chained customProgramCacheKey, which separates e.g. the
 *  glass-fresnel variants from plain standard materials). */
function materialPropsKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  const cacheKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  return [
    m.type,
    cacheKey,
    s.color ? s.color.getHexString() : '-',
    s.map?.uuid ?? '-',
    s.bumpMap?.uuid ?? '-',
    s.bumpMap ? s.bumpScale : '-',
    s.normalMap?.uuid ?? '-',
    s.emissive ? s.emissive.getHexString() : '-',
    s.emissiveMap?.uuid ?? '-',
    s.emissive ? s.emissiveIntensity : '-',
    s.roughness ?? '-',
    s.metalness ?? '-',
    s.roughnessMap?.uuid ?? '-',
    s.metalnessMap?.uuid ?? '-',
    s.aoMap?.uuid ?? '-',
    s.alphaMap?.uuid ?? '-',
    s.flatShading ? 1 : 0,
    m.transparent ? 1 : 0,
    m.opacity,
    m.side,
    m.depthWrite ? 1 : 0,
    m.depthTest ? 1 : 0,
    m.alphaTest,
    m.blending,
    m.toneMapped ? 1 : 0,
    m.vertexColors ? 1 : 0,
    (s.wireframe ?? false) ? 1 : 0,
    m.polygonOffset ? `${m.polygonOffsetFactor}/${m.polygonOffsetUnits}` : '-',
  ].join('|');
}

/** True when the geometry has no groups, or its groups' union covers every
 *  index (no deliberately-hidden ranges). Groups may then be dropped safely
 *  for a single-material draw. */
function groupsCoverWholeGeometry(g: THREE.BufferGeometry): boolean {
  if (g.groups.length === 0) return true;
  const total = g.index ? g.index.count : g.attributes.position.count;
  const ranges = [...g.groups].sort((a, b) => a.start - b.start);
  let covered = 0;
  for (const r of ranges) {
    if (r.start > covered) return false; // gap
    const end = r.count === Infinity ? total : r.start + r.count;
    covered = Math.max(covered, Math.min(end, total));
  }
  return covered >= total;
}

function attrsSignature(g: THREE.BufferGeometry): string {
  return (
    Object.keys(g.attributes)
      .sort()
      .map((k) => `${k}:${(g.attributes[k] as THREE.BufferAttribute).itemSize}`)
      .join(',') + (g.index ? '|indexed' : '|nonindexed')
  );
}

export interface BatchStats {
  candidates: number;
  instancedMeshes: number;
  instancedSources: number;
  mergedMeshes: number;
  mergedSources: number;
  hiddenSources: number;
}

/** Rebuild the batched representation of the static world. Idempotent and
 *  re-runnable (late-loading GLBs land through the same refresh() hooks as
 *  the material patcher): restores previous sources, disposes previous
 *  outputs, rebuilds from the CURRENT matrixWorld state. */
export function applyCinematicBatch(scene: THREE.Scene, opts: CinematicOpts): BatchStats | null {
  if (!opts.instance && !opts.merge) return null;

  scene.updateMatrixWorld(true);

  // Collect current candidates (with previous batch outputs/hides still in
  // place — sources are hidden, outputs are tagged, both excluded above).
  const collect = (): THREE.Mesh[] => {
    const out: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if (isBatchableMesh(o) && !(o.userData as Record<string, unknown>).crossingBatchedSource) {
        out.push(o);
      }
    });
    return out;
  };

  // Cheap change detector: if no new batchable meshes appeared since the last
  // run (probe sees only leftovers the last run chose not to batch), keep the
  // existing batch (refresh() fires several times on timers).
  const probe = collect();
  if (batchState.lastCandidateCount >= 0 && probe.length === batchState.lastCandidateCount) {
    return null;
  }

  // Restore previous run.
  for (const m of batchState.hiddenSources) {
    m.visible = true;
    delete (m.userData as Record<string, unknown>).crossingBatchedSource;
  }
  batchState.hiddenSources = [];
  // `batchState.outputs` holds the container Group(s) added to the scene
  // (`scene.add(container)` below) — the actual InstancedMesh/merged-Mesh
  // outputs are its children, not the Group itself, so disposal must walk
  // into `container.children`. Merged meshes own a freshly-baked geometry
  // (tagged `crossingOwnsGeometry`) that must be disposed or it leaks GPU
  // memory every rebuild; InstancedMesh outputs share their geometry with
  // the (now-restored) source mesh, so only their instance buffers are
  // released via `dispose()`.
  for (const o of batchState.outputs) {
    for (const child of o.children) {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (child.userData as Record<string, unknown>).crossingOwnsGeometry) {
        mesh.geometry.dispose();
      }
      const im = child as THREE.InstancedMesh;
      if (im.isInstancedMesh) {
        im.dispose();
      }
    }
    o.removeFromParent();
  }
  batchState.outputs = [];

  const candidates = collect();

  const container = new THREE.Group();
  container.name = 'cinematicBatch';

  const stats: BatchStats = {
    candidates: candidates.length,
    instancedMeshes: 0,
    instancedSources: 0,
    mergedMeshes: 0,
    mergedSources: 0,
    hiddenSources: 0,
  };

  const consumed = new Set<THREE.Mesh>();

  // ---- stage 2: instancing (identical geometry + identical material) ------
  if (opts.instance) {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const mesh of candidates) {
      const key = [
        mesh.geometry.uuid,
        (mesh.material as THREE.Material).uuid,
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
      ].join('|');
      const arr = groups.get(key);
      if (arr) arr.push(mesh);
      else groups.set(key, [mesh]);
    }
    for (const meshes of groups.values()) {
      if (meshes.length < INSTANCE_MIN) continue;
      const proto = meshes[0];
      const im = new THREE.InstancedMesh(proto.geometry, proto.material as THREE.Material, meshes.length);
      for (let i = 0; i < meshes.length; i++) im.setMatrixAt(i, meshes[i].matrixWorld);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = proto.castShadow;
      im.receiveShadow = proto.receiveShadow;
      im.userData.crossingBatched = true;
      container.add(im);
      for (const m of meshes) consumed.add(m);
      stats.instancedMeshes++;
      stats.instancedSources += meshes.length;
    }
  }

  // ---- stage 3 (+5): merge static meshes per material (per property key
  //      under dedupe, per material instance otherwise) --------------------
  if (opts.merge) {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const mesh of candidates) {
      if (consumed.has(mesh)) continue;
      // geometry.groups slice a draw into ranges. With a single (non-array)
      // material every range uses that material, so groups are visually inert
      // — UNLESS their union doesn't cover the whole geometry (then part of
      // it is deliberately hidden, and merging would reveal it). BoxGeometry
      // always carries 6 full-coverage groups, so this must not exclude
      // boxes wholesale — verify coverage instead.
      if (!groupsCoverWholeGeometry(mesh.geometry)) continue;
      // negative-determinant transforms flip winding when baked — skip.
      if (mesh.matrixWorld.determinant() < 0) continue;
      const matKey = opts.dedupe
        ? materialPropsKey(mesh.material as THREE.Material)
        : (mesh.material as THREE.Material).uuid;
      const key = [
        matKey,
        attrsSignature(mesh.geometry),
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
      ].join('||');
      const arr = groups.get(key);
      if (arr) arr.push(mesh);
      else groups.set(key, [mesh]);
    }
    for (const meshes of groups.values()) {
      if (meshes.length < MERGE_MIN) continue;
      const geoms: THREE.BufferGeometry[] = [];
      for (const mesh of meshes) {
        const g = mesh.geometry.clone();
        g.clearGroups(); // safe: coverage verified, single material
        g.applyMatrix4(mesh.matrixWorld);
        geoms.push(g);
      }
      let merged: THREE.BufferGeometry | null = null;
      try {
        merged = mergeGeometries(geoms, false);
      } catch {
        merged = null;
      }
      if (!merged) {
        for (const g of geoms) g.dispose();
        continue; // leave this group un-batched rather than risk corruption
      }
      for (const g of geoms) g.dispose();
      const proto = meshes[0];
      const out = new THREE.Mesh(merged, proto.material as THREE.Material);
      out.castShadow = proto.castShadow;
      out.receiveShadow = proto.receiveShadow;
      out.userData.crossingBatched = true;
      out.userData.crossingOwnsGeometry = true;
      container.add(out);
      for (const m of meshes) consumed.add(m);
      stats.mergedMeshes++;
      stats.mergedSources += meshes.length;
    }
  }

  // Hide every consumed source (three still updates their matrices but never
  // draws, frustum-tests, or shadow-renders them).
  for (const mesh of consumed) {
    mesh.visible = false;
    (mesh.userData as Record<string, unknown>).crossingBatchedSource = true;
    batchState.hiddenSources.push(mesh);
  }
  stats.hiddenSources = consumed.size;
  // Next refresh's probe will see exactly the leftovers (consumed sources are
  // hidden + tagged); if that count is unchanged, the batch is up to date.
  batchState.lastCandidateCount = candidates.length - consumed.size;

  scene.add(container);
  batchState.outputs.push(container);
  return stats;
}
