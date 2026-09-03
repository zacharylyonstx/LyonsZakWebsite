// The crossing as a production component — PORTED for v2 from
// archive/2026-08-29-slice-attempt-1:site/src/crossing/CrossingScene.tsx,
// which was itself extracted (proven, review-hardened) from the A2
// experiment. Everything PHYSICAL is untouched: the two-layer stack
// (depth-mesh photo above, projected live world beneath, crossfade on the
// mesh layer's opacity), the shader + guard stack, the projector depth
// prepass, REGION_RELEASE choreography, batching + frozen shadow map, the
// matched pose and departure path, NoColorSpace texture discipline, and the
// refresh() → patch/batch/prepass/precompile cycle.
//
// What changed in the v2 port (ownership/plumbing only):
//   - The Task-9 tier machinery (perf/tierConfig.ts, adaptiveDpr.ts) was not
//     cherry-picked into v2; the FULL tier's proven constants are inlined
//     below (MESH_SEGMENTS 512, DPR ceiling 2, anisotropy 8, shadow map
//     2048², MSAA on, wildflowers mounted). A future perf pass can reintroduce
//     tiers as a prop without touching the physics.
//   - The dev-only debug surface publishes into the SAME window.crossingDebug
//     App.tsx declares (single global declaration lives there).
//   - `progress` still arrives from the caller (the site timeline owns
//     scroll); THE NEIGHBORHOOD's rig supplies journeyToCrossingP(t).
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { dprMaxFor, isCoarsePointer } from '../timeline/filmViewport';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import type { DirectionalLight, HemisphereLight, AmbientLight } from 'three';

import { Street } from '../world-rtc/game/components/Street';
import { House } from '../world-rtc/game/components/House';
import { Yard } from '../world-rtc/game/components/Yard';
import { HousePropsRenderer } from '../world-rtc/game/components/HouseProps';
import { HeroHouse10600 } from '../world-rtc/game/components/hero/HeroHouse10600';
import { TRAMPOLINE_PAD_Y } from '../world-rtc/game/components/hero/Trampoline';
import { Ramp } from '../world-rtc/game/components/props/Ramp';
import { LiveOak } from '../world-rtc/game/components/vegetation/LiveOak';
import { CrepeMyrtle } from '../world-rtc/game/components/vegetation/CrepeMyrtle';
import { Hedge } from '../world-rtc/game/components/vegetation/Hedge';
import { DistantScenery } from '../world-rtc/game/components/DistantScenery';
import { Atmosphere } from '../world-rtc/game/components/Atmosphere';
import { NeighborhoodWildflowers } from '../world-rtc/game/components/vegetation/Wildflowers';
import { PorchLife } from './PorchLife';
import { HOUSES } from '../world-rtc/game/world/houses';
import { buildLots } from '../world-rtc/game/world/lots';
import { buildPropsFor } from '../world-rtc/game/world/props';
import { GREENBELT_TREES, lotTrees } from '../world-rtc/game/world/vegetation';
import { mat } from '../world-rtc/game/world/materials';
import { useCombatStore } from '../world-rtc/game/state/combatStore';
import { useTornadoStore } from '../world-rtc/game/state/tornadoStore';
import {
  applyCinematicBatch,
  cinematicOpts,
  type BatchStats,
} from '../world-rtc/cinematicWorld';

import {
  crossingUniforms,
  makeProjectorCamera,
  makeNetReceiverMaterial,
  makeSkyBackstopMaterial,
  netReceiverUniforms,
  skyBackstopUniforms,
  patchWorldMaterials,
  renderProjectorDepth,
  readProjDepth,
  readProjDepthRaw,
  readProjDepthGrid,
  driveFadeInMaterials,
} from './crossingMaterial';
import { MATCHED_POSE, PHOTO_ASPECT } from './matchedPose';
import {
  computeTimeline,
  MESH_FOV_BASE,
  type TimelineState,
  type WorldCamState,
} from './choreography';
import { makeDepthMesh } from './makeDepthMesh';
import { loadCrossingAssets, type CrossingAssets } from './loader';

// ---- The FULL tier's proven constants (see the port note above) -----------
const MESH_SEGMENTS = 512;
// Phones cap lower (filmViewport.ts): the live world is the film's
// heaviest frame, and 1.5 on a 3x screen is the difference between a
// scroll and a slideshow.
const DPR_MAX = dprMaxFor(isCoarsePointer());
const PHOTO_ANISOTROPY = 8;
const SHADOW_MAP_RES = 2048;

// Mesh-layer tuning — the experiment's value, verbatim.
const BASE_DEPTH_SCALE = 0.16;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function effectiveDpr(): number {
  return Math.min(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    DPR_MAX,
  );
}

// ---------------------------------------------------------------------------
// Shared per-frame state slot (the experiment's `live` pattern): the frame
// driver writes the computed timeline state once per frame; the world
// components read it in their own useFrame. Single writer, single mounted
// CrossingScene at a time.
// ---------------------------------------------------------------------------
const live: { state: TimelineState } = {
  state: computeTimeline(0, 16 / 10),
};

/** Debug/QA: fields assigned over the computed timeline state each frame. */
let stateOverride: Partial<TimelineState> | null = null;

/** Debug counters at module scope so StrictMode's mount→cleanup→mount cycle
 *  doesn't lose the first pass's numbers. */
const debugCounters = {
  patchedTotal: 0,
  prepassRuns: 0,
  batchStats: null as BatchStats | null,
};

function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function publishDebug(fields: Record<string, unknown>): void {
  if (!debugEnabled()) return;
  window.crossingDebug = Object.assign(window.crossingDebug ?? {}, fields);
}

// ---------------------------------------------------------------------------
// Public component API.
// ---------------------------------------------------------------------------

export interface CrossingSceneProps {
  /** Crossing progress 0..1. The component NEVER computes this — the site
   *  timeline owns scroll. A getter is sampled once per rendered frame. */
  progress: number | (() => number);
  /**
   * Whether the crossing should be RENDERING. The scene stays fully mounted
   * either way — mount-time refresh() (shader precompile, projector prepass,
   * batching) always runs, per the inherited early-mount requirement — but
   * while `active` is false and the warmup beat has completed (see
   * FrameloopGate), the world Canvas's frameloop is frozen so a hidden
   * crossing costs no per-frame GPU/CPU while earlier scenes own the screen.
   * Purely a scheduling gate: it never changes what any rendered frame
   * contains (byte-invariants verified in the integrated page).
   */
  active?: boolean;
  /**
   * CAMERA AUTHORITY, explicit: when this returns a pose, CrossingRig
   * applies it to the world camera INSTEAD of the crossing choreography's
   * own `state.world` — the seam through which the street settle
   * (scenes/neighborhood/arrival.ts) drives the camera once the departure
   * path has ended (crossing p pinned at 1). Return null to leave the
   * choreography in charge — which it is at every byte-invariant checkpoint.
   */
  worldCamOverride?: () => WorldCamState | null;
}

/**
 * The photo→Royal-Tara-Cove crossing, filling its nearest positioned
 * ancestor. Renders nothing until `loadCrossingAssets()` resolves (call it
 * early — App boot — so mounting is instant).
 */
export function CrossingScene({
  progress,
  active = true,
  worldCamOverride,
}: CrossingSceneProps) {
  const [assets, setAssets] = useState<CrossingAssets | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const meshCanvasRef = useRef<HTMLCanvasElement>(null);
  const aspectRef = useRef(16 / 10);
  const meshLayerRef = useRef<MeshLayer | null>(null);

  // Sample the latest prop without re-subscribing anything per frame.
  const progressRef = useRef<() => number>(() => 0);
  progressRef.current =
    typeof progress === 'function' ? progress : () => progress;
  const getProgress = useMemo(() => () => progressRef.current(), []);

  const worldCamOverrideRef = useRef<(() => WorldCamState | null) | undefined>(
    undefined,
  );
  worldCamOverrideRef.current = worldCamOverride;

  useEffect(() => {
    let mounted = true;
    loadCrossingAssets()
      .then((a) => {
        if (mounted) setAssets(a);
      })
      .catch((err) => {
        console.error('[crossing] asset load failed:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // The depth-mesh photo layer (the experiment's layer A), built once the
  // assets and its canvas exist. Owns a small dedicated renderer, exactly
  // like the experiment — the crossfade is a CSS opacity on this canvas,
  // which is the proven compositing math.
  useEffect(() => {
    const canvas = meshCanvasRef.current;
    const container = containerRef.current;
    if (!assets || !canvas || !container) return;

    const layer = createMeshLayer(canvas, assets, MESH_SEGMENTS);
    meshLayerRef.current = layer;
    layer.renderer.setPixelRatio(effectiveDpr());

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      aspectRef.current = w / h;
      layer.resize(w, h);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      meshLayerRef.current = null;
      layer.dispose();
    };
  }, [assets]);

  if (!assets) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#111',
      }}
    >
      {/* Layer B beneath: the live world wearing the projection. */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Canvas
          camera={{ position: MATCHED_POSE.pos, fov: 60, near: 0.1, far: 600 }}
          shadows
          dpr={[1, DPR_MAX]}
          gl={{
            antialias: true,
            preserveDrawingBuffer: true, // QA reads rendered pixels back
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            background: '#000',
            // The crossing is watched, never clicked (R3F would otherwise
            // give this canvas effective pointer-events:auto, shadowing the
            // DOM controls layered above — caught live in v1).
            pointerEvents: 'none',
          }}
        >
          <Suspense fallback={null}>
            <MemoCrossingWorld />
            <MemoNetReceiver />
            <MemoSkyBackstop />
            <MemoCrossingRig
              assets={assets}
              worldCamOverrideRef={worldCamOverrideRef}
            />
          </Suspense>
          <MemoFrameDriver
            getProgress={getProgress}
            aspectRef={aspectRef}
            meshLayerRef={meshLayerRef}
            meshCanvasRef={meshCanvasRef}
          />
          <FrameloopGate active={active} />
        </Canvas>
      </div>
      {/* Layer A above: the depth-mesh photo. The crossfade only ever
          animates this canvas's opacity. */}
      <canvas
        ref={meshCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          willChange: 'opacity',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memoized wrappers: the `active` prop flips at the segment's doorstep,
// which re-renders CrossingScene — without these, that one boolean flip
// reconciles the ENTIRE vendored world tree (hundreds of components,
// measured as a ~125ms frame in v1). Every wrapped component's props are
// referentially stable, so memo turns the flip into a no-op for the whole
// subtree; only FrameloopGate — which renders nothing — actually re-renders.
// ---------------------------------------------------------------------------
const MemoCrossingWorld = memo(CrossingWorld);
const MemoNetReceiver = memo(NetReceiver);
const MemoSkyBackstop = memo(SkyBackstop);
const MemoCrossingRig = memo(CrossingRig);
const MemoFrameDriver = memo(FrameDriver);

// ---------------------------------------------------------------------------
// Frameloop gate: the crossing mounts EARLY (App boot) so refresh()'s shader
// precompile and the staged loads happen long before a visitor can arrive.
// This gate freezes the world Canvas's frameloop when the caller says the
// crossing is off-screen, with the WARMUP BEAT carve-out: for the first ~7s
// after mount (past the last scheduled refresh() timer at 6s) and at least
// WARMUP_FRAMES real frames, the loop stays live regardless, so every
// first-draw allocation, texture upload, and the shadow-map render have
// actually HAPPENED before the loop is allowed to sleep.
// ---------------------------------------------------------------------------

const WARMUP_MS = 7000;
const WARMUP_FRAMES = 24;

function FrameloopGate({ active }: { active: boolean }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const frames = useRef(0);
  const timeWarm = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const id = window.setTimeout(() => {
      timeWarm.current = true;
    }, WARMUP_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (active) setFrameloop('always');
    // No else: going inactive is handled by the next frame's self-freeze
    // below (which also guarantees the warmup completes first).
  }, [active, setFrameloop]);

  useFrame(() => {
    frames.current++;
    if (
      !activeRef.current &&
      timeWarm.current &&
      frames.current >= WARMUP_FRAMES
    ) {
      setFrameloop('never');
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// Mesh layer (the experiment's main.ts layer A, verbatim math).
// ---------------------------------------------------------------------------

interface MeshLayer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  uniforms: Record<string, THREE.IUniform>;
  restDistance: number;
  resize(w: number, h: number): void;
  dispose(): void;
}

function createMeshLayer(
  canvas: HTMLCanvasElement,
  assets: CrossingAssets,
  segments: number,
): MeshLayer {
  const mesh = makeDepthMesh(assets.photo, assets.depth, {
    segments,
    depthScale: BASE_DEPTH_SCALE,
  });
  const material = mesh.material as THREE.ShaderMaterial;
  const uniforms = material.uniforms;

  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(MESH_FOV_BASE, 16 / 10, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    // readable after render: QA reads pixels back from this canvas
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(effectiveDpr());

  // Cover-fit rest distance: camera frustum exactly cover-fits the unit
  // mesh; ALSO the depth-mesh displacement origin — the photo's pixels
  // un-project along the rays that captured them.
  const img = assets.photo.image as { width: number; height: number };
  const meshAspect = img.width / img.height;
  function solveRestDistance(fovDeg: number, viewportAspect: number): number {
    const meshWidth = 1;
    const meshHeight = 1 / meshAspect;
    const fovRad = THREE.MathUtils.degToRad(fovDeg);
    const dByHeight = meshHeight / (2 * Math.tan(fovRad / 2));
    const dByWidth = meshWidth / (2 * Math.tan(fovRad / 2) * viewportAspect);
    return Math.min(dByHeight, dByWidth);
  }

  const layer: MeshLayer = {
    renderer,
    scene,
    camera,
    uniforms,
    restDistance: 1,
    resize(w: number, h: number) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      layer.restDistance = solveRestDistance(MESH_FOV_BASE, camera.aspect);
      (uniforms.uDisplaceOrigin.value as THREE.Vector3).set(0, 0, layer.restDistance);
      camera.updateProjectionMatrix();
    },
    dispose() {
      mesh.geometry.dispose();
      (uniforms.uConfidence.value as THREE.Texture | null)?.dispose();
      material.dispose();
      renderer.dispose();
      // assets.photo / assets.depth are shared with the world layer and the
      // loader cache — never disposed here.
    },
  };
  return layer;
}

// ---------------------------------------------------------------------------
// Frame driver: the ONE place per-frame progress becomes rendered state.
// Runs before every world useFrame (priority -100) so readers of `live` see
// the current frame's state. Also renders the mesh layer.
// ---------------------------------------------------------------------------

function FrameDriver({
  getProgress,
  aspectRef,
  meshLayerRef,
  meshCanvasRef,
}: {
  getProgress: () => number;
  aspectRef: { current: number };
  meshLayerRef: { current: MeshLayer | null };
  meshCanvasRef: { current: HTMLCanvasElement | null };
}) {
  useFrame(() => {
    const p = clamp01(getProgress());
    const state = computeTimeline(p, aspectRef.current);
    if (stateOverride) Object.assign(state, stateOverride);
    live.state = state;

    const meshCanvas = meshCanvasRef.current;
    const layer = meshLayerRef.current;
    if (!meshCanvas || !layer) return;
    meshCanvas.style.opacity = String(state.meshOpacity);
    meshCanvas.style.visibility = state.meshOpacity <= 0 ? 'hidden' : 'visible';
    if (state.meshOpacity > 0) {
      layer.uniforms.uDepthScale.value =
        BASE_DEPTH_SCALE * state.meshCam.depthScaleFactor;
      layer.camera.fov = state.meshCam.fovDeg;
      layer.camera.position.set(
        state.meshCam.lateralX,
        0,
        layer.restDistance * state.meshCam.distanceFactor,
      );
      layer.camera.updateProjectionMatrix();
      layer.renderer.render(layer.scene, layer.camera);
    }
  }, -100);
  return null;
}

// ---------------------------------------------------------------------------
// World (static subset — see world-rtc/ATTRIBUTION.md for provenance).
// Verbatim from the experiment's CrossingApp.tsx.
// ---------------------------------------------------------------------------

function CrossingWorld() {
  const lots = useMemo(() => buildLots(HOUSES), []);
  const lotsByAddress = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildLots>[number]>();
    for (const l of lots) m.set(l.address, l);
    return m;
  }, [lots]);
  const propsByAddress = useMemo(() => buildPropsFor(HOUSES), []);

  return (
    <>
      <CrossingSky />
      <Atmosphere />
      <CrossingFog />
      <CrossingLights />

      <mesh name="ground" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <primitive object={mat.grass()} attach="material" />
      </mesh>

      <group name="street">
        <Street />
      </group>
      <group name="ramp">
        <Ramp />
      </group>

      {HOUSES.map((h) => {
        const lot = lotsByAddress.get(h.address)!;
        return (
          <group key={h.address} name={`lot-${h.address}`}>
            <Yard config={h} lot={lot} />
            {h.isHero ? <HeroHouse10600 config={h} lot={lot} /> : <House config={h} lot={lot} />}
            <HousePropsRenderer config={h} lot={lot} data={propsByAddress.get(h.address)!} />
            <CrossingLotVegetation
              address={h.address}
              lot={lot}
              depth={h.depth}
              width={h.width}
              garageOnLeft={h.garageOnLeft}
            />
          </group>
        );
      })}

      {GREENBELT_TREES.map((p, i) => (
        <group key={`bgtree-${i}`} name={`bgtree-${i}`}>
          <LiveOak position={[p.x, 0, p.z]} scale={1.05} seed={i + 99} />
        </group>
      ))}

      <group name="wildflowers">
        <NeighborhoodWildflowers />
      </group>
      {/* Delight pass item 2: the lit porch + cat at 10609 (PorchLife.tsx). */}
      <PorchLife />
      <group name="distantScenery">
        <DistantScenery />
      </group>
    </>
  );
}

function CrossingLotVegetation({
  address,
  lot,
  depth,
  width,
  garageOnLeft,
}: {
  address: string;
  lot: ReturnType<typeof buildLots>[number];
  depth: number;
  width: number;
  garageOnLeft: boolean;
}) {
  const t = lotTrees(address, lot, depth, width, garageOnLeft);
  if (!t) return null;
  return (
    <>
      <LiveOak position={[t.oak[0], 0, t.oak[1]]} scale={t.oakScale} seed={t.seed} />
      <CrepeMyrtle
        position={[t.myrtle[0], 0, t.myrtle[1]]}
        scale={t.myrtleScale}
        bloomColor={t.myrtleBloom}
        seed={t.seed}
      />
      {t.hedge && <Hedge position={[t.hedge.x, 0, t.hedge.z]} rotation={t.hedge.rotation} length={3.5} />}
    </>
  );
}

// Sky / fog / lights: verbatim behavior (fixed default state: timeOfDay 0.06,
// stormIntensity 0) so the world's light matches the matched render this
// crossing was aligned against.

function CrossingSky() {
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const storm = useTornadoStore((s) => s.stormIntensity);
  const elev = Math.max(0.05, Math.cos(timeOfDay * Math.PI));
  const azimuth = (timeOfDay - 0.25) * Math.PI;
  const stormSunDip = storm * 1.4;
  const sunY = 100 * (elev - stormSunDip);
  const sunX = 100 * Math.sin(azimuth);
  const sunZ = 100 * Math.cos(azimuth);
  const turbidity = 4 + timeOfDay * 7 + storm * 12;
  const rayleigh = 1.5 + timeOfDay * 1.8 + storm * 5;
  return (
    <Sky
      sunPosition={[sunX, sunY, sunZ]}
      turbidity={turbidity}
      rayleigh={rayleigh}
      mieCoefficient={0.005}
      mieDirectionalG={0.7}
    />
  );
}

function CrossingFog() {
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const dusk = Math.min(1, Math.max(0, timeOfDay) * 1.5);
  const r = Math.round((0.81 - dusk * 0.33) * 255);
  const g = Math.round((0.86 - dusk * 0.34) * 255);
  const b = Math.round((0.9 - dusk * 0.3) * 255);
  return <fog attach="fog" args={[`rgb(${r},${g},${b})`, 70, 330 - dusk * 140]} />;
}

function CrossingLights() {
  const dirRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const ambRef = useRef<AmbientLight>(null);

  useFrame(() => {
    const t = useCombatStore.getState().timeOfDay;
    const storm = useTornadoStore.getState().stormIntensity;
    const stormDarken = 1 - 0.88 * storm;
    const sunIntensity = Math.max(0.05, 1.5 * (1 - t * 1.6)) * stormDarken;
    if (dirRef.current) {
      dirRef.current.intensity = sunIntensity;
      const rr = (1.0 - t * 0.4) * (1 - storm * 0.5);
      const gg = (0.95 - t * 0.55) * (1 - storm * 0.45);
      const bb = (0.82 - t * 0.4) * (1 - storm * 0.4);
      dirRef.current.color.setRGB(Math.max(0.2, rr), Math.max(0.2, gg), Math.max(0.3, bb));
      const elev = Math.max(0.05, Math.cos(t * Math.PI));
      const azimuth = (t - 0.25) * Math.PI;
      dirRef.current.position.set(60 * Math.sin(azimuth), 80 * elev, 35 * Math.cos(azimuth));
    }
    if (hemiRef.current) hemiRef.current.intensity = (0.95 - 0.62 * t) * stormDarken;
    if (ambRef.current) {
      ambRef.current.intensity = (0.45 - t * 0.1) * Math.max(0.26, 1 - storm * 0.7);
      const rr = (0.62 + t * 0.2) * (1 - storm * 0.4);
      const gg = (0.72 + t * 0.15) * (1 - storm * 0.4);
      const bb = 0.92 * (1 - storm * 0.3);
      ambRef.current.color.setRGB(rr, gg, bb);
    }
  });
  return (
    <>
      <hemisphereLight ref={hemiRef} color="#fff5d8" groundColor="#6a9a4e" intensity={0.92} />
      <directionalLight
        ref={dirRef}
        position={[60, 80, 35]}
        intensity={1.5}
        color="#fff0d0"
        castShadow
        shadow-mapSize-width={SHADOW_MAP_RES}
        shadow-mapSize-height={SHADOW_MAP_RES}
        shadow-radius={4}
        shadow-bias={-0.0008}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <ambientLight ref={ambRef} intensity={0.45} color="#bfe0ec" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Net receiver + sky backstop (the proven choreography answers to the
// trampoline-net depth band and photo rays that hit no world geometry).
// ---------------------------------------------------------------------------

// House-local trampoline placement — mirrors HeroHouse10600.tsx's
// TRAMPOLINE_LOCAL [8, 19] and Trampoline's netH 2.3 / radius 3.0.
const NET_LOCAL: [number, number] = [8, 19];
const NET_RECEIVER_RADIUS = 3.35; // outside the poles (r=3.0) by a clear margin
const NET_RECEIVER_HEIGHT = 2.4;

function SkyBackstop() {
  const material = useMemo(() => makeSkyBackstopMaterial(), []);
  const ref = useRef<THREE.Mesh>(null);
  // The backstop sphere back-face covers the whole screen; once
  // skyFade/photoStrength reach zero every fragment discards — hide the mesh
  // instead (identical output: all fragments were discarded anyway).
  useFrame(() => {
    const s = live.state;
    if (ref.current) ref.current.visible = s.photoStrength > 0 && s.skyFade > 0;
  });
  return (
    <mesh ref={ref} position={MATCHED_POSE.pos} userData={{ crossingBackstop: true }} renderOrder={9}>
      <sphereGeometry args={[340, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function NetReceiver() {
  const material = useMemo(() => makeNetReceiverMaterial(), []);
  const ref = useRef<THREE.Mesh>(null);
  const heroLot = useMemo(() => {
    const lots = buildLots(HOUSES);
    const hero = HOUSES.find((h) => h.isHero)!;
    return lots.find((l) => l.address === hero.address)!;
  }, []);
  // Once uNetFade/photoStrength hit zero every fragment discards — skip
  // rasterizing entirely. The projector depth prepass force-shows receivers
  // while it renders, so the stamped depth map never depends on scroll.
  useFrame(() => {
    const s = live.state;
    if (ref.current) ref.current.visible = s.photoStrength > 0 && s.netFade > 0;
  });
  return (
    <group
      position={[heroLot.housePivot[0], 0, heroLot.housePivot[1]]}
      rotation={[0, heroLot.houseYaw, 0]}
    >
      <mesh
        ref={ref}
        position={[NET_LOCAL[0], TRAMPOLINE_PAD_Y + NET_RECEIVER_HEIGHT / 2, NET_LOCAL[1]]}
        userData={{ crossingReceiver: true }}
        renderOrder={10}
      >
        <cylinderGeometry
          args={[NET_RECEIVER_RADIUS, NET_RECEIVER_RADIUS, NET_RECEIVER_HEIGHT, 48, 1, true]}
        />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The rig: projector, texture wiring, patching, depth prepass, per-frame
// timeline drive. Verbatim experiment logic; textures arrive via loader.ts;
// QA access publishes on the dev-only crossingDebug hook.
// ---------------------------------------------------------------------------

function CrossingRig({
  assets,
  worldCamOverrideRef,
}: {
  assets: CrossingAssets;
  worldCamOverrideRef: {
    current: (() => WorldCamState | null) | undefined;
  };
}) {
  const { scene, camera, gl } = useThree();
  const projector = useMemo(() => makeProjectorCamera(MATCHED_POSE, PHOTO_ASPECT), []);
  const lookTarget = useRef(new THREE.Vector3());

  // Wire the loaded textures into the shared uniforms. uMasksOn arms the
  // art-directed release only with BOTH masks resident — the loader
  // guarantees that by construction.
  useEffect(() => {
    assets.photo.anisotropy = Math.min(
      PHOTO_ANISOTROPY,
      gl.capabilities.getMaxAnisotropy(),
    );
    assets.photo.needsUpdate = true;
    crossingUniforms.uPhoto.value = assets.photo;
    crossingUniforms.uMaskA.value = assets.maskA;
    crossingUniforms.uMaskB.value = assets.maskB;
    crossingUniforms.uMasksOn.value = 1;
  }, [assets, gl]);

  // The LYONS mailbox nameplate (proven v1 arrival fix, carried): the
  // vendored Mailbox.tsx places its name Text at local z 0.22, but the
  // mailbox GLB's shell extends to local z ≈ 0.35 at its fitHeight — the
  // family name is authored 13cm INSIDE the box and depth-tests away. The
  // vendored tree stays byte-intact (provenance discipline), so this is a
  // runtime adjustment from the production module — floating the nameplate
  // 2cm proud of the box face so "LYONS" actually reads on the settled
  // frame. Idempotent (absolute set), retried in case the Text mounts late
  // under Suspense.
  useEffect(() => {
    const floatNameplate = () => {
      scene.traverse((o) => {
        const maybeText = o as THREE.Object3D & { text?: string };
        if (maybeText.text === 'LYONS') o.position.z = 0.37;
      });
    };
    floatNameplate();
    const timers = [500, 1500, 3500].map((ms) =>
      window.setTimeout(floatNameplate, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [scene]);

  // The world is fully static and the sun never moves, so re-rendering the
  // 2048² shadow map every frame is pure waste — freeze it, re-rendering
  // once per refresh() via shadowMap.needsUpdate below.
  useEffect(() => {
    if (!cinematicOpts.shadowFreeze) return;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  // Patch materials + render the projector depth map. Re-run on the default
  // loading manager's onLoad (late GLBs) and on a few fallback timers; both
  // patching and the prepass are idempotent/cheap.
  useEffect(() => {
    const refresh = () => {
      debugCounters.patchedTotal += patchWorldMaterials(scene);
      const b = applyCinematicBatch(scene, cinematicOpts);
      if (b) debugCounters.batchStats = b;
      renderProjectorDepth(gl, scene, projector);
      if (cinematicOpts.shadowFreeze) gl.shadowMap.needsUpdate = true;
      // Precompile every program (incl. instanced variants) NOW, during the
      // load beat — otherwise the first scrub into the street reveal pays a
      // multi-hundred-ms shader-compile hitch when the far world enters the
      // frustum for the first time.
      gl.compile(scene, camera);
      debugCounters.prepassRuns++;
    };
    refresh();
    const prevOnLoad = THREE.DefaultLoadingManager.onLoad;
    THREE.DefaultLoadingManager.onLoad = () => {
      prevOnLoad?.();
      // defer one frame so newly-loaded meshes are mounted
      requestAnimationFrame(refresh);
    };
    const timers = [500, 1500, 3500, 6000].map((ms) => window.setTimeout(refresh, ms));

    publishDebug({
      refresh,
      stats: () => ({ ...debugCounters, batch: debugCounters.batchStats, opts: cinematicOpts }),
      scene, // QA access from the Playwright harness
      gl, // renderer.info access
      camera,
      uniforms: crossingUniforms,
      projector,
      getState: () => ({
        p: live.state.p,
        phase: live.state.phase,
        pathT: live.state.pathT,
        meshOpacity: live.state.meshOpacity,
        photoStrength: live.state.photoStrength,
      }),
      /** debug: assign fields over the computed timeline state (null clears) */
      setOverride: (o: Partial<TimelineState> | null) => {
        stateOverride = o;
      },
      /** heat views: 0 off; 1 weight; 2 vis; 3 facing; 4 smear; 5 dist; 6 keep */
      setDebugMode: (mode: number) => {
        crossingUniforms.uDebugMode.value = mode;
      },
      /** QA: flip between the batched world and the hidden originals WITHIN
       *  one page load — a pixel diff isolates batching artifacts. */
      setBatchVisible: (on: boolean) => {
        scene.traverse((o) => {
          const ud = o.userData as Record<string, unknown>;
          if (ud.crossingBatched) o.visible = on;
          if (ud.crossingBatchedSource) o.visible = !on;
        });
        if (cinematicOpts.shadowFreeze) gl.shadowMap.needsUpdate = true;
        return on;
      },
      readProjDepth: (u: number, v: number) => readProjDepth(gl, u, v),
      readProjDepthRaw: (u: number, v: number) => readProjDepthRaw(gl, u, v),
      readProjDepthGrid: (gw: number, gh: number) => readProjDepthGrid(gl, gw, gh),
    });

    return () => {
      timers.forEach(clearTimeout);
      THREE.DefaultLoadingManager.onLoad = prevOnLoad;
    };
  }, [scene, gl, camera, projector]);

  useFrame(() => {
    const s = live.state;
    const cam = camera as THREE.PerspectiveCamera;
    // CAMERA AUTHORITY: the arrival override (street window) wins when it
    // returns a pose; otherwise the crossing choreography's world camera.
    const world = worldCamOverrideRef.current?.() ?? s.world;
    cam.position.copy(world.pos);
    lookTarget.current.copy(world.look);
    cam.lookAt(lookTarget.current);
    // EXACT compare (v1 determinism fix): an epsilon gate here let the
    // camera keep a stale sub-epsilon fov dependent on the damped approach
    // TRAJECTORY — sparse maxDiff-8 byte jitter on revisits. Exact compare
    // keeps the optimization and keeps the frame a pure function of p.
    if (cam.fov !== world.fovDeg) {
      cam.fov = world.fovDeg;
      cam.updateProjectionMatrix();
    }
    crossingUniforms.uPhotoStrength.value = s.photoStrength;
    crossingUniforms.uDepartFacing.value = s.departFacing;
    crossingUniforms.uGradeStrength.value = s.gradeStrength;
    const r = s.regionRelease;
    (crossingUniforms.uRelA.value as THREE.Vector3).set(r.kids, r.trampoline, r.playhouse);
    (crossingUniforms.uRelB.value as THREE.Vector3).set(r.canopy, r.sky, r.ground);
    crossingUniforms.uRelRest.value = r.rest;
    netReceiverUniforms.uNetFade.value = s.netFade;
    skyBackstopUniforms.uSkyFade.value = s.skyFade;
    // Game text (the "68" plaque digits) fades in with the playhouse reveal,
    // not the global envelope — the game playhouse must arrive complete.
    driveFadeInMaterials(1 - s.textFade);
  });

  return null;
}
