# Vendored world subset — attribution

> **Production copy (2026-08-28, production-slice Task 2):** everything under
> `site/src/world-rtc/game/` was extracted byte-identical from the proven
> experiment sandbox `site/experiments/a2-crossing/src/vendor/game/` with
> exactly ONE mechanical change: the two files importing the sandbox's
> `src/cinematicWorld.ts` (`world/materials.ts`, `components/HouseInterior.tsx`)
> now import `../../cinematicWorld` — the same module, which moved with the
> subset to `site/src/world-rtc/cinematicWorld.ts`. The full import closure of
> the crossing's world mount was computed at extraction time: all vendored
> files below are reachable (the stubs — netStore/audio/room/Interior10600 —
> are what MAKE the rest reachable safely), so nothing was pruned. Everything
> below this note is the experiment's attribution record, preserved verbatim.

Everything under `src/vendor/game/` is copied from Zak's game repo:

- **Source repo:** `~/Game` (Royal Tara Cove neighborhood world)
- **Branch / commit:** `cine-mode` @ `aba458e`
- **Copied:** 2026-08-28, for the a2-crossing experiment sandbox
  (LyonsZak.com vertical slice, Task 8). Disposable sandbox copy — the
  source repo remains the single source of truth for world data/components.

Files with the `VENDORED UNMODIFIED` header are byte-identical to the
source (plus that two-line header). Files with a `STUB` header were written
for this sandbox to replace game modules that are out of scope here:

- `state/netStore.ts` — multiplayer store → static single-player stub
- `audio.ts` — game audio → no-op
- `net/room.ts` — P2P room plumbing → never-in-room stub
- `components/hero/Interior10600.tsx` — hero-house interior → empty
  (the crossing only ever sees the exterior)

Five vendored files carry a documented `CROSSING MODIFICATION` header (all
for the same reason: wall-clock-driven `useFrame` animation breaks the
crossing's byte-exact scrub-reversibility — "every frame is a pure function
of scrollY"):

- `components/Atmosphere.tsx` — SkyClouds + SunMotes disabled (wall-clock
  animation breaks the crossing's scrub determinism; the hero photo's light
  is diffuse overcast). SceneEnvironment (IBL) kept.
- `components/props/Flagpole.tsx` — flag-wave animation removed (fix round 1,
  Task 8 review finding). Flag renders static.
- `components/props/Cat.tsx` — wake/breathe/tail-wag animation removed (fix
  round 1, Task 8 review finding). Cat renders static, asleep.
- `components/props/Sprinkler.tsx` — water-particle simulation now computed
  once at a frozen t=0 instead of per-frame from wall-clock time (fix round
  1, Task 8 review finding). Renders a static, motionless spray.
- `components/vegetation/CrepeMyrtle.tsx` — "gentle everyday breeze" trunk
  sway removed (fix round 1, Task 8 review finding; the tornado wind-lean
  branch it shared the `useFrame` with was already dead code in this
  sandbox — no tornado is ever triggered here — but the breeze branch ran
  unconditionally). Renders static, at rest.

Two other vendored files also read `state.clock`/`performance.now()` in a
`useFrame` but were AUDITED and left unmodified because the read is
provably inert in this sandbox (fix round 1, Task 8 review finding):

- `components/vegetation/LiveOak.tsx` — its wind-lean branch requires
  `tornadoStore.windStrength > 0.05`; nothing in this sandbox ever calls
  `setWindStrength`/`setTornadoOpacity`, so the store never leaves its `0`
  default and the branch is dead code (confirmed by grep and by an
  in-browser byte-diff at fixed scrollY showing zero change on every oak).
- `components/House.tsx` — its destruction-physics block has an explicit,
  unconditional early `return` on the very first frame whenever
  `getHouseDamage(address) <= 0 && !destroyed`; nothing in this sandbox ever
  calls `setHouseDestroyed`/ramps damage, so `destroyedHouses` stays `{}`
  for the sandbox's whole lifetime and this is always true.
- `components/props/Basketball.tsx` — reads `performance.now()` (score
  timestamp) and integrates real per-frame `dt` (gravity/kick physics), but
  was verified (in-browser position readout) to settle to an exact static
  rest state (`y=0.16`, velocity `0`) within its first frame and never move
  again: the only trigger for further motion is the player walking within
  0.7m, and all three basketballs (hero house 10600 only — no neighbor
  hoops) sit 4.4–5.6m from the sandbox's fixed player spawn, which never
  moves (no player controller exists here).

GLB model assets referenced by `world/models.ts` are copied (not committed)
into `public/assets/models/` by `scripts/prepare-assets.mjs`; they are Meshy
AI generations owned by Zak (see the source repo's ATTRIBUTION.md).
