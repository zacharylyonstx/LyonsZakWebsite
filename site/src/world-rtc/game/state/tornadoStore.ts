// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/state/tornadoStore.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { create } from 'zustand';

// Per-frame tornado state. Kept in its own store so high-frequency updates
// (tornadoZ, stormIntensity) don't trigger React re-renders in unrelated
// subscribers — only the components that explicitly select these values
// re-render. Most reads inside useFrame go through useTornadoStore.getState()
// to avoid even the selector cost.

interface TornadoStore {
  /** Wall-clock seconds (perf.now()/1000) when the current phase began. */
  phaseEnteredAt: number;
  setPhaseEnteredAt: (t: number) => void;

  /** Tornado base world Z. Starts hidden at -200, walks from -110 to +20. */
  tornadoZ: number;
  setTornadoZ: (z: number) => void;

  /** Tornado base world X. Wobbles ±5m during approach. */
  tornadoX: number;
  setTornadoX: (x: number) => void;

  /** 0..1, brief storm-cloud illumination after a lightning strike. */
  flashAlpha: number;
  setFlashAlpha: (v: number) => void;

  /** 0..1, drives sky darkness, fog density, rain visibility. */
  stormIntensity: number;
  setStormIntensity: (v: number) => void;

  /** 0..1, drives rain X drift, wind audio, tree sway (future). */
  windStrength: number;
  setWindStrength: (v: number) => void;

  /** Tornado opacity for materialization fade-in. 0..1. */
  tornadoOpacity: number;
  setTornadoOpacity: (v: number) => void;

  /** Increments each time a lightning strike should flash. Components watch the change. */
  lightningCue: number;
  bumpLightning: () => void;

  /** perf.now()/1000 of the last transformer/power-line flash (electric pop that
   *  lights the neighborhood as the tornado rips through). 0 = none. */
  powerFlash: number;
  firePowerFlash: () => void;

  /** Reset to initial values (for replay / mode switch). */
  reset: () => void;
}

const INITIAL = {
  phaseEnteredAt: 0,
  tornadoZ: -200,
  tornadoX: 0,
  flashAlpha: 0,
  stormIntensity: 0,
  windStrength: 0,
  tornadoOpacity: 0,
  lightningCue: 0,
  powerFlash: 0,
};

export const useTornadoStore = create<TornadoStore>((set) => ({
  ...INITIAL,
  setPhaseEnteredAt: (t) => set({ phaseEnteredAt: t }),
  setTornadoZ: (z) => set({ tornadoZ: z }),
  setTornadoX: (x) => set({ tornadoX: x }),
  setFlashAlpha: (v) => set({ flashAlpha: v }),
  setStormIntensity: (v) => set({ stormIntensity: v }),
  setWindStrength: (v) => set({ windStrength: v }),
  setTornadoOpacity: (v) => set({ tornadoOpacity: v }),
  bumpLightning: () => set((s) => ({ lightningCue: s.lightningCue + 1 })),
  firePowerFlash: () => {
    set({ powerFlash: performance.now() / 1000, flashAlpha: 0.85 });
    // Decay the scene illumination shortly after (mirrors the lightning path).
    setTimeout(() => set({ flashAlpha: 0 }), 130);
  },
  reset: () => set(INITIAL),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __tornado?: unknown }).__tornado = useTornadoStore;
}
