// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/state/playStore.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { create } from 'zustand';
import type { CharacterId } from '../types';

// Free-roam play: rideable bikes + playable basketball. State lives here so the
// PlayerController (input), CameraRig (chase cam), the Basketball props
// (physics/scoring), and the net layer can all coordinate.

export interface HoopReg {
  x: number;          // rim world X
  z: number;          // rim world Z
  rimY: number;       // rim height
  rimR: number;       // forgiving scoring radius
}

export interface BikeReg {
  id: string;
  x: number;
  z: number;
  color: string;
}

/** A parked, drivable car (truck/sedan) registered by HouseProps. */
export interface CarReg {
  id: string;
  x: number;
  z: number;
  color: string;
  kind: 'sedan' | 'truck' | 'golfcart';
  yaw: number; // parked facing
}

export type HoverPlay = 'ride' | 'drive' | 'getoff' | 'pickup' | 'shoot' | 'hopin' | null;

export interface RidingState {
  bikeId: string;
  bikeColor: string;
  /** undefined/'bike' = bicycle; 'car' = driving a registered car. */
  vehicle?: 'bike' | 'car';
  carKind?: 'sedan' | 'truck' | 'golfcart';
  heading: number;    // facing yaw of the bike
  speed: number;      // m/s, signed
  y: number;          // bike height (0 = on the ground, >0 = airborne)
  vy: number;         // vertical velocity (m/s)
  airborne: boolean;  // true while off the ground
  /** Active trick rotation: dir +1 = front flip, -1 = back flip; angle in rad. */
  flip: { dir: 1 | -1; angle: number } | null;
  /** performance.now() timestamp the wipeout tumble ends (0 = not wiping out). */
  wipeoutUntil: number;
  /** Passenger: the character DRIVING the vehicle I'm sitting in (my position is
   *  derived from theirs each frame — see world/seats.ts) + which seat. */
  passengerOf?: CharacterId;
  seat?: number;
}

/** The single street launch ramp (registered by the Ramp prop on mount). */
export interface RampReg {
  x: number;
  z: number;
  heading: number;   // direction you ride UP the ramp (radians)
  halfLen: number;   // along-heading half length of the trigger zone
  halfWid: number;   // across-heading half width
}

/**
 * Live ball positions, written every frame by each Basketball. Kept OUT of the
 * reactive store so per-frame updates don't churn zustand subscribers; read
 * directly by the PlayerController for nearest-ball detection.
 */
export const ballPositions: Record<string, { x: number; z: number }> = {};

interface PlayStore {
  /** Per-character riding state (null = on foot). */
  riding: Record<CharacterId, RidingState | null>;
  /** The single ball currently held, if any. */
  heldBall: { ballId: string; by: CharacterId } | null;
  /** One-shot impulse a Basketball consumes to launch (cleared after read). */
  shotImpulse: { ballId: string; by: CharacterId; vx: number; vy: number; vz: number; t: number } | null;

  familyBaskets: number;
  lastBasket: { by: CharacterId; at: number } | null;

  /** Last landed/attempted trick + a session counter, for the trick HUD. */
  lastTrick: { text: string; at: number } | null;
  trickCount: number;

  hoops: Record<string, HoopReg>;                 // keyed by house address
  bikes: Record<string, BikeReg>;                 // keyed by bike id
  cars: Record<string, CarReg>;                   // keyed by car id
  ramp: RampReg | null;
  trampoline: { x: number; z: number; half: number; padY: number } | null;

  // Contextual interact hint for the local player.
  hoverPlay: HoverPlay;
  hoverBikeId: string | null;
  hoverBallId: string | null;
  hoverCarId: string | null;
  /** 'hopin' hover: whose vehicle + which seat (label for the prompt). */
  hoverSeat: { driver: CharacterId; seat: number; label: string } | null;
  setHoverSeat: (v: { driver: CharacterId; seat: number; label: string } | null) => void;

  /** One-shot landing-impact event (ramp/jump touchdown): drives the dust puff,
   *  camera shake, and vehicle squash. Consumers compare `at` to performance.now(). */
  landingFx: { x: number; z: number; at: number; power: number } | null;
  triggerLandingFx: (x: number, z: number, power: number) => void;

  setHover: (play: HoverPlay, bikeId: string | null, ballId: string | null, carId?: string | null) => void;
  registerHoop: (address: string, reg: HoopReg) => void;
  registerBike: (reg: BikeReg) => void;
  registerCar: (reg: CarReg) => void;
  /** Update a car's parked spot (called when a driver gets out) so it stays put. */
  parkCar: (id: string, x: number, z: number, yaw: number) => void;
  registerRamp: (reg: RampReg) => void;
  registerTrampoline: (reg: { x: number; z: number; half: number; padY: number }) => void;
  /** Record a landed trick (or a wipeout) for the HUD; bumps the counter for real tricks. */
  setTrick: (text: string, scored: boolean) => void;

  mount: (id: CharacterId, s: RidingState) => void;
  dismount: (id: CharacterId) => void;
  setRiding: (id: CharacterId, s: RidingState) => void;

  pickUpBall: (ballId: string, by: CharacterId) => void;
  dropBall: () => void;
  shoot: (ballId: string, by: CharacterId, vx: number, vy: number, vz: number, t: number) => void;
  clearShot: () => void;

  scoreBasket: (by: CharacterId, at: number) => void;
}

declare global {
  interface Window { __play?: unknown; }
}

export const usePlayStore = create<PlayStore>((set, get) => ({
  riding: { dad: null, penny: null, luke: null },
  heldBall: null,
  shotImpulse: null,
  familyBaskets: 0,
  lastBasket: null,
  lastTrick: null,
  trickCount: 0,
  hoops: {},
  bikes: {},
  cars: {},
  trampoline: null,
  ramp: null,
  hoverPlay: null,
  hoverBikeId: null,
  hoverBallId: null,
  hoverCarId: null,
  hoverSeat: null,
  setHoverSeat: (v) => {
    const cur = get().hoverSeat;
    if (cur === v || (cur && v && cur.driver === v.driver && cur.seat === v.seat)) return;
    set({ hoverSeat: v });
  },
  landingFx: null,

  triggerLandingFx: (x, z, power) => set({ landingFx: { x, z, at: performance.now(), power } }),

  setHover: (play, bikeId, ballId, carId = null) =>
    set((s) =>
      s.hoverPlay === play && s.hoverBikeId === bikeId && s.hoverBallId === ballId && s.hoverCarId === carId
        ? s
        : { hoverPlay: play, hoverBikeId: bikeId, hoverBallId: ballId, hoverCarId: carId },
    ),
  registerHoop: (address, reg) => set((s) => ({ hoops: { ...s.hoops, [address]: reg } })),
  registerBike: (reg) => set((s) => ({ bikes: { ...s.bikes, [reg.id]: reg } })),
  registerCar: (reg) => set((s) => ({ cars: { ...s.cars, [reg.id]: reg } })),
  parkCar: (id, x, z, yaw) =>
    set((s) => (s.cars[id] ? { cars: { ...s.cars, [id]: { ...s.cars[id], x, z, yaw } } } : s)),
  registerTrampoline: (reg) => set(() => ({ trampoline: reg })),
  registerRamp: (reg) => set({ ramp: reg }),
  setTrick: (text, scored) =>
    set((s) => ({
      lastTrick: { text, at: performance.now() },
      trickCount: scored ? s.trickCount + 1 : s.trickCount,
    })),

  mount: (id, st) => set((s) => ({ riding: { ...s.riding, [id]: st } })),
  dismount: (id) => set((s) => ({ riding: { ...s.riding, [id]: null } })),
  setRiding: (id, st) =>
    set((s) => {
      const cur = s.riding[id];
      if (cur) {
        cur.heading = st.heading; cur.speed = st.speed;
        cur.y = st.y; cur.vy = st.vy; cur.airborne = st.airborne; cur.flip = st.flip;
      }
      return {};
    }),

  pickUpBall: (ballId, by) => set({ heldBall: { ballId, by } }),
  dropBall: () => set({ heldBall: null }),
  shoot: (ballId, by, vx, vy, vz, t) => set({ heldBall: null, shotImpulse: { ballId, by, vx, vy, vz, t } }),
  clearShot: () => set({ shotImpulse: null }),

  scoreBasket: (by, at) =>
    set((s) => ({ familyBaskets: s.familyBaskets + 1, lastBasket: { by, at } })),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__play = usePlayStore;
}
