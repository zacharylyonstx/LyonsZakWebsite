// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/Atmosphere.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (a2): Atmosphere() renders only SceneEnvironment.
// SkyClouds and SunMotes are wall-clock-animated (drifting clouds, floating
// sparkle motes) — they break the crossing's "every frame is a pure function
// of scrollY" determinism (scrub-reversibility is verified byte-exact), and
// the cream mote discs read as artifacts against the projected photograph.
// The hero photo's light is bright diffuse overcast, not sparkle weather.
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Sparkles, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { useCombatStore } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useGameStore } from '../state/gameStore';
import { isTouchDevice } from '../systems/touchInput';

// Atmosphere & image-based lighting. Keeps the game's stylized low-poly look
// but elevates it with a real sky reflected in glass/cars, warm golden-hour
// depth, drifting clouds, and floating sun motes — an Austin-afternoon feel.
// Everything is driven by combatStore.timeOfDay (0 = bright midday → 1 = night)
// and yields to the tornado storm, so night (munchies) and storms stay correct.
// Heavier pieces (clouds, motes, env resolution) are gated for touch devices.

const TOUCH = isTouchDevice();
const ENV_RES = TOUCH ? 64 : 128;

/** Procedural sky environment (offline — no network HDR fetch). Provides the
 *  reflections the material system used to fake with Fresnel hacks. */
function SceneEnvironment() {
  useFrame(({ scene }) => {
    const t = useCombatStore.getState().timeOfDay;
    const storm = useTornadoStore.getState().stormIntensity;
    // Full strength at midday, fading to a faint glint at night and in storms.
    const day = Math.max(0, 1 - t * 1.15);
    scene.environmentIntensity = Math.max(0.04, 0.62 * day) * (1 - storm * 0.8);
  });
  return (
    <Environment resolution={ENV_RES} frames={1} background={false}>
      {/* Sky-blue dome captured as the base reflection. */}
      <color attach="background" args={['#bcd8ef']} />
      {/* Warm Texas sun glint — what windows and car paint catch. */}
      <Lightformer form="circle" intensity={3.2} color="#fff2d6" scale={9} position={[14, 11, -10]} />
      {/* Cool sky fill from above. */}
      <Lightformer form="rect" intensity={1.1} color="#cfe6ff" scale={[36, 36, 1]} position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* Warm green ground bounce from below. */}
      <Lightformer form="rect" intensity={0.45} color="#9bbf7a" scale={[36, 36, 1]} position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </Environment>
  );
}

/** A few soft clouds drifting high over the neighborhood (desktop only). */
function SkyClouds() {
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const storm = useTornadoStore((s) => s.stormIntensity);
  const gameMode = useGameStore((s) => s.gameMode);
  if (TOUCH || gameMode === 'munchies' || storm > 0.15 || timeOfDay > 0.6) return null;
  const fade = Math.max(0, 1 - timeOfDay * 1.6);
  return (
    <Clouds material={THREE.MeshBasicMaterial} limit={120} range={90}>
      <Cloud seed={11} position={[-46, 40, -55]} bounds={[26, 5, 12]} volume={9} segments={26} opacity={0.42 * fade} speed={0.16} color="#ffffff" growth={5} />
      <Cloud seed={29} position={[40, 46, -85]} bounds={[30, 6, 14]} volume={11} segments={28} opacity={0.36 * fade} speed={0.12} color="#fbf7ef" growth={6} />
      <Cloud seed={47} position={[6, 52, -120]} bounds={[34, 6, 16]} volume={12} segments={30} opacity={0.30 * fade} speed={0.1} color="#eef4ff" growth={6} />
      <Cloud seed={63} position={[-30, 58, -165]} bounds={[38, 6, 16]} volume={12} segments={28} opacity={0.26 * fade} speed={0.09} color="#f4f8ff" growth={6} />
      <Cloud seed={81} position={[58, 44, 12]} bounds={[24, 5, 12]} volume={9} segments={24} opacity={0.3 * fade} speed={0.13} color="#fffaf0" growth={5} />
    </Clouds>
  );
}

/** Floating pollen / dust motes catching the afternoon sun (desktop only). */
function SunMotes() {
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const storm = useTornadoStore((s) => s.stormIntensity);
  const gameMode = useGameStore((s) => s.gameMode);
  if (TOUCH || gameMode === 'munchies' || storm > 0.2 || timeOfDay > 0.55) return null;
  return (
    <Sparkles
      count={60}
      scale={[70, 10, 70]}
      position={[0, 5, -20]}
      size={3}
      speed={0.25}
      opacity={0.55}
      color="#fff3d6"
    />
  );
}

export function Atmosphere() {
  // CROSSING MODIFICATION: clouds + motes disabled (see file header).
  void SkyClouds;
  void SunMotes;
  return <SceneEnvironment />;
}
