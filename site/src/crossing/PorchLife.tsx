// PORCH LIFE (delight pass, item 2) — one small piece of life on the
// departure's quiet stretch: as the camera flies the street, 10609 Royal
// Tara Cove (the first east-side house north of the bulb — the closest
// street house to the arrival settle, sitting just right of frame center
// in the settled mailbox view) has a window lit warm amber and the
// world's Cat prop sitting in its spill on the lawn below. Discovered,
// not announced: no glint, no pocket, just warmth for the attentive.
//
// Deterministic by construction: every object is static (the vendored Cat
// was already frozen for the crossing — no wake/breathe/tail clocks); the
// halo sprite orients to the camera, which is itself a pure function of
// scroll. Positions derive from the world's own data (houses.ts +
// streetLayout.houseTransform + House.tsx's own layout constants), never
// hand-copied world coordinates.
import { useMemo } from 'react';
import * as THREE from 'three';
import { HOUSES } from '../world-rtc/game/world/houses';
import { houseTransform } from '../world-rtc/game/world/streetLayout';
import { Cat } from '../world-rtc/game/components/props/Cat';


const PORCH_ADDRESS = '10609';

/** The warm-amber halo texture (one canvas, cached — the panelMaterial
 *  glowTexture recipe, local to this Canvas/context). */
let haloCache: THREE.Texture | null = null;
function haloTexture(): THREE.Texture {
  if (haloCache) return haloCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 190, 120, 0.9)');
  grad.addColorStop(0.4, 'rgba(255, 176, 100, 0.35)');
  grad.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  haloCache = tex;
  return tex;
}

interface PorchFrame {
  pivot: [number, number];
  yaw: number;
  windowLocal: [number, number, number];
  catLocal: [number, number, number];
  catRotation: number;
  windowSize: [number, number];
}

/** All placement math, from the world's own data conventions. */
function porchFrame(): PorchFrame | null {
  const config = HOUSES.find((h) => h.address === PORCH_ADDRESS);
  if (!config) return null;
  const { worldX, worldZ, yaw } = houseTransform(config.position, config.depth);
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  void halfD;
  // The lit window is the SOUTH side wall's first-floor window nearest the
  // street (House.tsx side layout: x = -(halfW + MOUNT), z = -depth*0.24) —
  // the wall the settled mailbox view actually faces. The house's own west
  // front (door, porch, coach light) is presented edge-on from the street
  // settle, so a front-window glow read as an unanchored floating dot there
  // (caught at the first capture pass); the south window anchors the warmth
  // to visible glazing in every framing, and the cat sits in its spill on
  // the south lawn strip — clearly silhouetted on the grass in the settled
  // view instead of hidden behind the house's own front-yard props.
  return {
    pivot: [worldX, worldZ],
    yaw,
    // Just proud of the side window unit's casing (mounted at halfW+0.16).
    windowLocal: [-(halfW + 0.55), 1.5, -config.depth * 0.24],
    // On the lawn ~1.6m out from the wall, directly below the lit window.
    catLocal: [-(halfW + 1.6), 0.02, -config.depth * 0.24],
    // Curled with its head end toward the street (tuned against captures).
    catRotation: yaw + 1.35,
    windowSize: [0.95, 1.25],
  };
}

/** House-local -> world (HouseProps.toWorld, verbatim convention). */
function toWorld(
  lx: number,
  ly: number,
  lz: number,
  pivot: [number, number],
  yaw: number,
): [number, number, number] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return [pivot[0] + lx * cy + lz * sy, ly, pivot[1] - lx * sy + lz * cy];
}

export function PorchLife() {
  const frame = useMemo(porchFrame, []);

  const objects = useMemo(() => {
    if (!frame) return null;
    const group = new THREE.Group();
    group.name = 'porchLife-10609';

    // The lit window: an emissive-warm plane floating just outside the
    // glazing. MeshBasicMaterial (unlit — it IS the light);
    // patchWorldMaterials picks it up like any world mesh, so it grades
    // with the scene during the departure and needs no special casing.
    const [ww, wh] = frame.windowSize;
    const windowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(ww, wh),
      new THREE.MeshBasicMaterial({ color: '#ffb86e', side: THREE.DoubleSide }),
    );
    const wpos = toWorld(...frame.windowLocal, frame.pivot, frame.yaw);
    windowPlane.position.set(...wpos);
    // The plane spans the side wall (local X = const): its normal is the
    // wall's outward local -X, i.e. yaw + 90deg (DoubleSide, so sign-safe).
    windowPlane.rotation.y = frame.yaw + Math.PI / 2;
    group.add(windowPlane);

    // Soft spill around the lit window.
    const windowHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture(),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    windowHalo.position.set(wpos[0], wpos[1], wpos[2]);
    windowHalo.scale.set(2.8, 2.4, 1);
    group.add(windowHalo);

    return group;
  }, [frame]);

  if (!frame || !objects) return null;
  return (
    <>
      <primitive object={objects} />
      {/* Slightly over-scale so the curled silhouette still reads as a cat
          from the settle's ~30m (tuned against captures). */}
      <group scale={1.25}>
        <Cat
          position={toWorld(
            frame.catLocal[0] / 1.25,
            frame.catLocal[1],
            frame.catLocal[2] / 1.25,
            [frame.pivot[0] / 1.25, frame.pivot[1] / 1.25],
            frame.yaw,
          )}
          rotation={frame.catRotation}
        />
      </group>
    </>
  );
}
