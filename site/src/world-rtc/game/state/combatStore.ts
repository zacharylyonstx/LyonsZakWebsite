// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/state/combatStore.ts
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { create } from 'zustand';

export type BlobKind = 'hopper' | 'sprinter' | 'splitter' | 'boss';

export interface Blob {
  id: number;
  kind: BlobKind;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  /** Visual scale multiplier. */
  scale: number;
  phase: number;
  hopCooldown: number;
  lastDamagedAt: number;
  variant: number;
  alive: boolean;
  deathAt: number;
  /** When the blob spawned (for erupt scale-in animation). */
  spawnedAt: number;
  /** Detour waypoint world XZ — blob steers here before targeting player. */
  waypointX: number;
  waypointZ: number;
  /** True when blob has reached its waypoint (or doesn't have one). */
  waypointReached: boolean;
  /** Boss-specific cooldowns (ignored for non-boss). */
  slamCooldown?: number;
  summonCooldown?: number;
  chargeCooldown?: number;
}

export interface GooSplat {
  id: number;
  x: number;
  z: number;
  variant: number;
  spawnedAt: number;
  /** Larger splat for boss kills. */
  scale?: number;
}

export interface Beam {
  id: number;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  spawnedAt: number;
  /** Color tint: 'cyan' (player), 'pink' (penny), 'green' (luke). */
  tint: 'cyan' | 'pink' | 'green';
}

export interface HitParticle {
  id: number;
  x: number; y: number; z: number;
  variant: number;
  spawnedAt: number;
}

export interface DialogueLine {
  id: number;
  speaker: 'dad' | 'penny' | 'luke';
  text: string;
  spawnedAt: number;
  duration: number;
}

export type WaveState = 'pre-waves' | 'spawning' | 'fighting' | 'cleared' | 'intermission' | 'won';

export type PowerUpKind = 'rapidFire' | 'bigLaser' | 'freezeRay' | 'shield' | 'tripleShot';

export interface PowerUpDrop {
  id: number;
  x: number; z: number;
  kind: PowerUpKind;
  spawnedAt: number;
}

export interface ActivePowerUp {
  kind: PowerUpKind;
  expiresAt: number;
}

export interface FloatingText {
  id: number;
  x: number; y: number; z: number;
  text: string;
  color: string;
  spawnedAt: number;
  big?: boolean;
}

export interface Projectile {
  id: number;
  kind: 'bomb' | 'lego';
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  spawnedAt: number;
  bouncesLeft?: number;
  rotPhase: number;
  /** Damage on impact. */
  damage: number;
}

export interface Firework {
  id: number;
  x: number; y: number; z: number;
  color: string;
  spawnedAt: number;
}

export interface Cinematic {
  active: boolean;
  targetX: number; targetY: number; targetZ: number;
  cameraX: number; cameraY: number; cameraZ: number;
  endsAt: number;
}

export const POWERUP_BASE_DROP_RATE = 0.32;
export const POWERUP_KINDS: PowerUpKind[] = ['rapidFire', 'bigLaser', 'freezeRay', 'shield', 'tripleShot'];
export const POWERUP_DURATION: Record<PowerUpKind, number> = {
  rapidFire: 8,
  bigLaser: 6,
  freezeRay: 8,
  shield: 6,
  tripleShot: 6,
};
export const POWERUP_LABEL: Record<PowerUpKind, string> = {
  rapidFire: '⚡ Rapid Fire',
  bigLaser: '🔫 Big Laser',
  freezeRay: '❄️ Freeze Ray',
  shield: '🛡️ Shield',
  tripleShot: '⭐ Triple Shot',
};
export const POWERUP_COLOR: Record<PowerUpKind, string> = {
  rapidFire: '#fff15a',
  bigLaser: '#ff5a3a',
  freezeRay: '#5acdff',
  shield: '#a0e84a',
  tripleShot: '#e26aa1',
};
export const BLOB_BASE_SCORE: Record<BlobKind, number> = {
  hopper: 10,
  sprinter: 15,
  splitter: 20,
  boss: 200,
};

interface CombatStore {
  blobs: Blob[];
  splats: GooSplat[];
  beams: Beam[];
  hitParticles: HitParticle[];

  /** Wave manager state. */
  waveIndex: number;        // 0 before first wave, 1..3 during play
  waveState: WaveState;
  intermissionEndsAt: number;

  blobsToSpawn: { kind: BlobKind; count: number }[];
  nextBlobId: number;
  nextSplatId: number;
  nextBeamId: number;
  nextParticleId: number;
  nextDialogueId: number;
  spawnedBlobsCount: number;
  kills: number;

  /** Stats */
  gameStartedAt: number;
  shotsFired: number;
  shotsHit: number;

  /** Time-of-day 0..1, 0=noon, 0.5=sunset, 1=midnight. */
  timeOfDay: number;
  setTimeOfDay: (t: number) => void;

  /** Slow-motion factor — multiply dt by this to scale time. */
  slowMo: number;
  slowMoEndsAt: number;

  /** Dialogue queue. */
  dialogue: DialogueLine[];
  pushDialogue: (speaker: 'dad' | 'penny' | 'luke', text: string, duration?: number) => void;
  reapDialogue: (now: number) => void;

  spawnBlob: (kind: BlobKind, x: number, y: number, z: number, opts?: { variant?: number }) => void;
  damageBlob: (id: number, amount?: number) => void;
  reapDeadBlobs: (now: number) => void;
  setWave: (index: number, composition: { kind: BlobKind; count: number }[]) => void;
  setWaveState: (s: WaveState) => void;
  setIntermissionEnd: (t: number) => void;
  consumeBlobToSpawn: (kind: BlobKind) => void;

  spawnBeam: (from: [number, number, number], to: [number, number, number], tint?: Beam['tint']) => void;
  reapBeams: (now: number) => void;

  spawnHitParticle: (x: number, y: number, z: number, variant: number) => void;
  reapHitParticles: (now: number) => void;

  spawnSplat: (x: number, z: number, variant: number, scale?: number) => void;
  reapSplats: (now: number) => void;

  shake: number;
  addShake: (amount: number) => void;
  setShake: (v: number) => void;
  decayShake: (dt: number) => void;

  damageFlashAt: number;
  triggerDamageFlash: () => void;

  debris: { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; spawnedAt: number; rot: number; rotSpeed: number }[];
  spawnDebris: (x: number, y: number, z: number, count?: number) => void;
  reapDebris: (now: number) => void;

  crashFlashAt: number;
  triggerCrashFlash: () => void;

  triggerSlowMo: (factor: number, duration: number) => void;
  decaySlowMo: () => void;

  recordShotFired: () => void;
  recordShotHit: () => void;

  /** Power-up drops + active effects */
  powerUpDrops: PowerUpDrop[];
  activePowerUps: ActivePowerUp[];
  spawnPowerUp: (x: number, z: number, kind: PowerUpKind) => void;
  pickupPowerUp: (id: number) => void;
  reapPowerUps: (now: number) => void;
  hasPowerUp: (kind: PowerUpKind) => boolean;

  /** Combo + score */
  comboCount: number;
  lastKillAt: number;
  score: number;
  registerKill: (kind: BlobKind, x: number, y: number, z: number) => void;
  decayCombo: (now: number) => void;

  /** Floating screen text (damage numbers, COMBO!, etc.) */
  floatingTexts: FloatingText[];
  spawnFloatingText: (x: number, y: number, z: number, text: string, color?: string, big?: boolean) => void;
  reapFloatingTexts: (now: number) => void;

  /** Projectiles (Penny bombs, Luke legos) */
  projectiles: Projectile[];
  spawnProjectile: (p: Omit<Projectile, 'id'>) => void;
  removeProjectile: (id: number) => void;

  /** Fireworks for victory party */
  fireworks: Firework[];
  spawnFirework: (x: number, y: number, z: number, color: string) => void;
  reapFireworks: (now: number) => void;

  /** Cinematic camera control — set when wave is about to spawn */
  cinematic: Cinematic;
  startCinematic: (
    target: [number, number, number],
    camera: [number, number, number],
    duration: number,
  ) => void;
  endCinematic: () => void;

  startGame: () => void;
  reset: () => void;
}

function blobDefaultsFor(kind: BlobKind): { hp: number; scale: number } {
  switch (kind) {
    case 'hopper': return { hp: 3, scale: 1 };
    case 'sprinter': return { hp: 1, scale: 0.85 };
    case 'splitter': return { hp: 2, scale: 1.1 };
    case 'boss': return { hp: 25, scale: 3 };
  }
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  blobs: [],
  splats: [],
  beams: [],
  hitParticles: [],
  waveIndex: 0,
  waveState: 'pre-waves',
  intermissionEndsAt: 0,
  blobsToSpawn: [],
  nextBlobId: 1,
  nextSplatId: 1,
  nextBeamId: 1,
  nextParticleId: 1,
  nextDialogueId: 1,
  spawnedBlobsCount: 0,
  kills: 0,
  gameStartedAt: 0,
  shotsFired: 0,
  shotsHit: 0,

  timeOfDay: 0.06,
  setTimeOfDay: (t) => set({ timeOfDay: t }),

  slowMo: 1,
  slowMoEndsAt: 0,

  dialogue: [],
  pushDialogue: (speaker, text, duration = 3.0) => {
    const id = get().nextDialogueId;
    set((s) => ({
      nextDialogueId: id + 1,
      dialogue: [
        ...s.dialogue.filter((d) => d.speaker !== speaker), // replace previous from same speaker
        { id, speaker, text, spawnedAt: performance.now() / 1000, duration },
      ],
    }));
  },
  reapDialogue: (now) => {
    const cur = get().dialogue;
    const next = cur.filter((d) => now - d.spawnedAt < d.duration);
    if (next.length !== cur.length) set({ dialogue: next });
  },

  spawnBlob: (kind, x, y, z, opts) => {
    const { hp, scale } = blobDefaultsFor(kind);
    const id = get().nextBlobId;
    const variant = opts?.variant ?? get().spawnedBlobsCount % 4;
    // Compute detour waypoint: route around hero house (10600 lives at the
    // bulb at angleDeg=90, world ~(0, +37), 18m wide). Side chosen randomly
    // so blobs fan around both sides. Boss skips waypoint.
    const HERO_X = 0;
    const HERO_Z = 37;
    const HERO_HALF_W = 11;
    const isBoss = kind === 'boss';
    const side = Math.random() < 0.5 ? -1 : 1;
    // Non-boss: corner of hero house. Boss: wider arc — uses x = ±(half + 5)
    // and z slightly past house, so it visibly walks the long way around.
    const waypointX = isBoss
      ? HERO_X + side * (HERO_HALF_W + 5)
      : HERO_X + side * HERO_HALF_W;
    const waypointZ = isBoss ? HERO_Z + 4 : HERO_Z;
    set((s) => ({
      nextBlobId: id + 1,
      spawnedBlobsCount: s.spawnedBlobsCount + 1,
      blobs: [
        ...s.blobs,
        {
          id, kind, x, y, z, hp, maxHp: hp, scale,
          phase: Math.random() * Math.PI * 2,
          hopCooldown: Math.random() * 0.5,
          lastDamagedAt: -999,
          variant, alive: true, deathAt: 0,
          spawnedAt: performance.now() / 1000,
          waypointX, waypointZ,
          waypointReached: false,
          slamCooldown: kind === 'boss' ? 5 : undefined,
          summonCooldown: kind === 'boss' ? 6 : undefined,
          chargeCooldown: kind === 'boss' ? 8 : undefined,
        },
      ],
    }));
  },
  damageBlob: (id, amount = 1) => {
    const now = performance.now() / 1000;
    set((s) => {
      let newKills = s.kills;
      const updated = s.blobs.map((b) => {
        if (b.id !== id || !b.alive) return b;
        const hp = Math.max(0, b.hp - amount);
        if (hp <= 0) {
          newKills++;
          return { ...b, hp: 0, alive: false, deathAt: now };
        }
        return { ...b, hp, lastDamagedAt: now };
      });
      return { blobs: updated, kills: newKills };
    });
  },
  reapDeadBlobs: (now) => {
    const cur = get().blobs;
    const next = cur.filter((b) => b.alive || now - b.deathAt < 4);
    if (next.length !== cur.length) set({ blobs: next });
  },
  setWave: (index, composition) =>
    set({ waveIndex: index, blobsToSpawn: composition.map((c) => ({ ...c })), spawnedBlobsCount: 0, waveState: 'spawning' }),
  setWaveState: (waveState) => set({ waveState }),
  setIntermissionEnd: (t) => set({ intermissionEndsAt: t }),
  consumeBlobToSpawn: (kind) => {
    set((s) => ({
      blobsToSpawn: s.blobsToSpawn
        .map((c) => (c.kind === kind ? { ...c, count: c.count - 1 } : c))
        .filter((c) => c.count > 0),
    }));
  },

  spawnBeam: (from, to, tint = 'cyan') => {
    const id = get().nextBeamId;
    set((s) => ({
      nextBeamId: id + 1,
      beams: [...s.beams, { id, fromX: from[0], fromY: from[1], fromZ: from[2], toX: to[0], toY: to[1], toZ: to[2], spawnedAt: performance.now() / 1000, tint }],
    }));
  },
  reapBeams: (now) => {
    const cur = get().beams;
    const next = cur.filter((b) => now - b.spawnedAt < 0.14);
    if (next.length !== cur.length) set({ beams: next });
  },

  spawnHitParticle: (x, y, z, variant) => {
    const id = get().nextParticleId;
    set((s) => ({
      nextParticleId: id + 1,
      hitParticles: [...s.hitParticles, { id, x, y, z, variant, spawnedAt: performance.now() / 1000 }],
    }));
  },
  reapHitParticles: (now) => {
    const cur = get().hitParticles;
    const next = cur.filter((p) => now - p.spawnedAt < 0.5);
    if (next.length !== cur.length) set({ hitParticles: next });
  },

  spawnSplat: (x, z, variant, scale = 1) => {
    const id = get().nextSplatId;
    set((s) => ({
      nextSplatId: id + 1,
      splats: [...s.splats, { id, x, z, variant, spawnedAt: performance.now() / 1000, scale }],
    }));
  },
  reapSplats: (now) => {
    const cur = get().splats;
    const next = cur.filter((p) => now - p.spawnedAt < 14);
    if (next.length !== cur.length) set({ splats: next });
  },

  shake: 0,
  addShake: (n) => set((s) => ({ shake: Math.min(1, s.shake + n) })),
  // Sustain shake at >= a target (for continuous buffeting like a tornado
  // bearing down) without the runaway accumulation of repeated addShake().
  setShake: (v) => set((s) => ({ shake: Math.max(s.shake, Math.min(1, v)) })),
  decayShake: (dt) => {
    const cur = get().shake;
    if (cur <= 0) return;
    set({ shake: Math.max(0, cur - dt * 2.5) });
  },

  damageFlashAt: -999,
  triggerDamageFlash: () => set({ damageFlashAt: performance.now() / 1000 }),

  debris: [],
  spawnDebris: (x, y, z, count = 8) => {
    const now = performance.now() / 1000;
    set((s) => {
      const fresh = Array.from({ length: count }, (_, i) => {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 4 + Math.random() * 5;
        return {
          id: s.nextParticleId + i + 100000,
          x, y, z,
          vx: Math.cos(ang) * speed,
          vy: 6 + Math.random() * 4,
          vz: Math.sin(ang) * speed,
          spawnedAt: now,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 12,
        };
      });
      return { debris: [...s.debris, ...fresh], nextParticleId: s.nextParticleId + count };
    });
  },
  reapDebris: (now) => {
    const cur = get().debris;
    const next = cur.filter((d) => now - d.spawnedAt < 2.5);
    if (next.length !== cur.length) set({ debris: next });
  },

  crashFlashAt: -999,
  triggerCrashFlash: () => set({ crashFlashAt: performance.now() / 1000 }),

  triggerSlowMo: (factor, duration) => set({ slowMo: factor, slowMoEndsAt: performance.now() / 1000 + duration }),
  decaySlowMo: () => {
    const now = performance.now() / 1000;
    if (get().slowMo !== 1 && now > get().slowMoEndsAt) set({ slowMo: 1 });
  },

  recordShotFired: () => set((s) => ({ shotsFired: s.shotsFired + 1 })),
  recordShotHit: () => set((s) => ({ shotsHit: s.shotsHit + 1 })),

  powerUpDrops: [],
  activePowerUps: [],
  spawnPowerUp: (x, z, kind) => {
    const id = get().nextParticleId;
    set((s) => ({
      nextParticleId: id + 1,
      powerUpDrops: [...s.powerUpDrops, { id, x, z, kind, spawnedAt: performance.now() / 1000 }],
    }));
  },
  pickupPowerUp: (id) => {
    const drop = get().powerUpDrops.find((p) => p.id === id);
    if (!drop) return;
    const dur = POWERUP_DURATION[drop.kind];
    const now = performance.now() / 1000;
    set((s) => ({
      powerUpDrops: s.powerUpDrops.filter((p) => p.id !== id),
      activePowerUps: [
        ...s.activePowerUps.filter((a) => a.kind !== drop.kind),
        { kind: drop.kind, expiresAt: now + dur },
      ],
    }));
  },
  reapPowerUps: (now) => {
    const sCur = get();
    const newDrops = sCur.powerUpDrops.filter((p) => now - p.spawnedAt < 18);
    const newActive = sCur.activePowerUps.filter((a) => a.expiresAt > now);
    if (newDrops.length !== sCur.powerUpDrops.length || newActive.length !== sCur.activePowerUps.length) {
      set({ powerUpDrops: newDrops, activePowerUps: newActive });
    }
  },
  hasPowerUp: (kind) => get().activePowerUps.some((a) => a.kind === kind),

  comboCount: 0,
  lastKillAt: -999,
  score: 0,
  registerKill: (kind, x, y, z) => {
    const now = performance.now() / 1000;
    const cur = get();
    const newCombo = (now - cur.lastKillAt < 2.0 ? cur.comboCount + 1 : 1);
    const base = BLOB_BASE_SCORE[kind];
    const points = base * newCombo;
    set({ comboCount: newCombo, lastKillAt: now, score: cur.score + points });
    // Floating "+points!" text
    cur.spawnFloatingText(x, y + 1.0, z, `+${points}`, '#fff0a8');
    if (newCombo === 3) cur.spawnFloatingText(x, y + 2.0, z, 'TRIPLE!', '#3afff0', true);
    if (newCombo === 5) cur.spawnFloatingText(x, y + 2.0, z, 'MEGA!', '#ff3a3a', true);
    if (newCombo === 8) cur.spawnFloatingText(x, y + 2.0, z, 'ULTRA!', '#e26aa1', true);
    if (newCombo >= 10 && newCombo % 2 === 0) cur.spawnFloatingText(x, y + 2.0, z, `${newCombo}× COMBO!`, '#fff15a', true);
  },
  decayCombo: (now) => {
    const cur = get();
    if (cur.comboCount > 0 && now - cur.lastKillAt > 2.0) {
      set({ comboCount: 0 });
    }
  },

  floatingTexts: [],
  spawnFloatingText: (x, y, z, text, color = '#ffffff', big) => {
    const id = get().nextParticleId;
    set((s) => ({
      nextParticleId: id + 1,
      floatingTexts: [...s.floatingTexts, { id, x, y, z, text, color, spawnedAt: performance.now() / 1000, big }],
    }));
  },
  reapFloatingTexts: (now) => {
    const cur = get().floatingTexts;
    const next = cur.filter((t) => now - t.spawnedAt < 1.4);
    if (next.length !== cur.length) set({ floatingTexts: next });
  },

  projectiles: [],
  spawnProjectile: (p) => {
    const id = get().nextParticleId;
    set((s) => ({
      nextParticleId: id + 1,
      projectiles: [...s.projectiles, { id, ...p }],
    }));
  },
  removeProjectile: (id) => set((s) => ({ projectiles: s.projectiles.filter((p) => p.id !== id) })),

  fireworks: [],
  spawnFirework: (x, y, z, color) => {
    const id = get().nextParticleId;
    set((s) => ({
      nextParticleId: id + 1,
      fireworks: [...s.fireworks, { id, x, y, z, color, spawnedAt: performance.now() / 1000 }],
    }));
  },
  reapFireworks: (now) => {
    const cur = get().fireworks;
    const next = cur.filter((f) => now - f.spawnedAt < 2.4);
    if (next.length !== cur.length) set({ fireworks: next });
  },

  cinematic: {
    active: false,
    targetX: 0, targetY: 0, targetZ: 0,
    cameraX: 0, cameraY: 8, cameraZ: 0,
    endsAt: 0,
  },
  startCinematic: (target, camera, duration) => set({
    cinematic: {
      active: true,
      targetX: target[0], targetY: target[1], targetZ: target[2],
      cameraX: camera[0], cameraY: camera[1], cameraZ: camera[2],
      endsAt: performance.now() / 1000 + duration,
    },
  }),
  endCinematic: () => set((s) => ({ cinematic: { ...s.cinematic, active: false } })),

  startGame: () => set({
    gameStartedAt: performance.now() / 1000,
    shotsFired: 0, shotsHit: 0, kills: 0,
    score: 0, comboCount: 0, lastKillAt: -999,
    powerUpDrops: [], activePowerUps: [],
  }),

  reset: () => set({
    blobs: [], splats: [], beams: [], hitParticles: [],
    blobsToSpawn: [], spawnedBlobsCount: 0, kills: 0,
    shake: 0, damageFlashAt: -999, debris: [], crashFlashAt: -999,
    waveIndex: 0, waveState: 'pre-waves', intermissionEndsAt: 0,
    timeOfDay: 0.15, slowMo: 1, slowMoEndsAt: 0, dialogue: [],
    shotsFired: 0, shotsHit: 0, gameStartedAt: 0,
    // Transient gameplay/visual arrays + scoring — cleared so a non-reload
    // re-entry into combat never inherits a prior run's projectiles, popups,
    // power-ups, or score (startGame() re-zeros scoring too, belt-and-braces).
    projectiles: [], floatingTexts: [], fireworks: [],
    powerUpDrops: [], activePowerUps: [],
    score: 0, comboCount: 0, lastKillAt: -999,
  }),
}));

export const BLOB_COLORS: { body: string; glow: string }[] = [
  { body: '#a0e84a', glow: '#5cb85c' }, // lime (hopper)
  { body: '#e26aa1', glow: '#a83a3a' }, // magenta (hopper variant)
  { body: '#5ac8e6', glow: '#3a6db0' }, // cyan (hopper variant)
  { body: '#c89adf', glow: '#7a3aa6' }, // lavender (hopper variant)
  { body: '#ff6a3a', glow: '#a82a08' }, // sprinter (orange-red)
  { body: '#a832c8', glow: '#5a1080' }, // splitter (poison purple)
  { body: '#3afff0', glow: '#1a8090' }, // boss (cyan-king)
];

export const BLOB_COLOR_FOR_KIND = (kind: BlobKind, variantIdx: number): { body: string; glow: string } => {
  if (kind === 'sprinter') return BLOB_COLORS[4];
  if (kind === 'splitter') return BLOB_COLORS[5];
  if (kind === 'boss') return BLOB_COLORS[6];
  return BLOB_COLORS[variantIdx % 4];
};

declare global {
  interface Window { __combat?: unknown; }
}
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__combat = useCombatStore;
}
