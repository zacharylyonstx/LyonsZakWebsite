// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/world/models.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
// Central registry of GLB model assets (generated with Meshy AI — see
// scripts/meshy-batch.mjs). Served from /public/assets/models, copied into dist
// by Vite on build. Per-model display config (fit height, facing offset) lives
// next to the path so entity components stay declarative.
import { useGLTF } from '@react-three/drei';

const base = '/assets/models';

export interface ModelConfig {
  url: string;
  /** Target world height (m) — GLBModel auto-scales + grounds to this. */
  fitHeight: number;
  /** Y-rotation (rad) to face the model the game's "forward" (+Z). */
  rotationY?: number;
}

export const MODELS = {
  // vegetation
  oak: { url: `${base}/oak.glb`, fitHeight: 5.5 },
  crepemyrtle: { url: `${base}/crepemyrtle.glb`, fitHeight: 4.0 },
  shrub: { url: `${base}/shrub.glb`, fitHeight: 0.7 },
  // vehicles (tinted per-instance at runtime). Cars: GLB length is along X but the
  // drive controller expects the nose at local -Z, so rotate 90° (sign verified
  // in-game). Bike forward is +X to match RiddenBike's +PI/2 offset → no rotation.
  truck: { url: `${base}/truck.glb`, fitHeight: 1.9, rotationY: -Math.PI / 2 },
  sedan: { url: `${base}/sedan.glb`, fitHeight: 1.5, rotationY: -Math.PI / 2 },
  bike: { url: `${base}/bike.glb`, fitHeight: 1.0, rotationY: 0 },
  // outdoor props
  mailbox: { url: `${base}/mailbox.glb`, fitHeight: 1.3, rotationY: 0 },
  grill: { url: `${base}/grill.glb`, fitHeight: 1.1 },
  patioset: { url: `${base}/patioset.glb`, fitHeight: 2.4 },
  trashbins: { url: `${base}/trashbins.glb`, fitHeight: 1.1 },
  // neighbor interior pieces
  sofa: { url: `${base}/sofa.glb`, fitHeight: 0.85 },
  coffeetable: { url: `${base}/coffeetable.glb`, fitHeight: 0.45 },
  tv: { url: `${base}/tv.glb`, fitHeight: 1.35 },
  floorlamp: { url: `${base}/floorlamp.glb`, fitHeight: 1.65 },
  houseplant: { url: `${base}/houseplant.glb`, fitHeight: 1.1 },
  // hero interior augments
  fridge: { url: `${base}/fridge.glb`, fitHeight: 1.8 },
  stove: { url: `${base}/stove.glb`, fitHeight: 1.0 },
  bookshelf: { url: `${base}/bookshelf.glb`, fitHeight: 1.9 },
  // pickups & set-pieces
  gnome: { url: `${base}/gnome.glb`, fitHeight: 0.45 },
  milk: { url: `${base}/milk.glb`, fitHeight: 0.6 },
  bonuscookie: { url: `${base}/bonuscookie.glb`, fitHeight: 0.5 },
  ufo: { url: `${base}/ufo.glb`, fitHeight: 3.2 },
  // tornado easter-egg — the classic Twister flying cow
  cow: { url: `${base}/cow.glb`, fitHeight: 2.2 },
  // across-the-boulevard zone (pond park + shops) & pets
  dog: { url: `${base}/dog.glb`, fitHeight: 0.95, rotationY: Math.PI },
  duck: { url: `${base}/duck.glb`, fitHeight: 0.42 },
  playground: { url: `${base}/playground.glb`, fitHeight: 3.4 },
  icecreamstand: { url: `${base}/icecreamstand.glb`, fitHeight: 2.3 },
  picnictable: { url: `${base}/picnictable.glb`, fitHeight: 0.8 },
  parkbench: { url: `${base}/parkbench.glb`, fitHeight: 0.9 },
  golfcart: { url: `${base}/golfcart.glb`, fitHeight: 1.8, rotationY: -Math.PI / 2 },
} as const satisfies Record<string, ModelConfig>;

export type ModelKey = keyof typeof MODELS;

/** Warm drei's cache for the always-on-screen neighborhood props (avoids pop-in). */
export function preloadWorldModels() {
  for (const k of ['oak', 'crepemyrtle', 'shrub', 'mailbox', 'truck', 'sedan', 'bike'] as const) {
    useGLTF.preload(MODELS[k].url);
  }
}
