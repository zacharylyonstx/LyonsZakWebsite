// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/props/Basketball.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { usePlayStore, ballPositions } from '../../state/playStore';
import { isNearPlayer } from '../../systems/distance';
import { swishSound } from '../../audio';
import { isInRoom, broadcastBasket } from '../../net/room';
import type { CharacterId } from '../../types';

interface BasketballProps {
  position: [number, number, number];
  id: string;
}

/**
 * A driveway basketball. Walk into it to kick it (casual dribbling). The active
 * character can press E to pick it up (held in front), then click/space to shoot
 * an assisted arc at the nearest hoop — a make scores (swish + family count).
 */
export function Basketball({ position, id }: BasketballProps) {
  const meshRef = useRef<Mesh>(null);
  const velocity = useRef({ x: 0, y: 0, z: 0 });
  const pos = useRef({ x: position[0], y: 0.16, z: position[2] });
  const lastShotT = useRef(0);
  const shooter = useRef<CharacterId | null>(null);
  const inFlight = useRef(false);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const activeId = myCharacterId ?? fallbackActive;

  useFrame((_, dtRaw) => {
    const play = usePlayStore.getState();
    ballPositions[id] = { x: pos.current.x, z: pos.current.z };
    const m = meshRef.current;
    if (!m) return;
    const dt = Math.min(dtRaw, 0.1);

    // Held: float in front of the holder at chest height.
    if (play.heldBall && play.heldBall.ballId === id) {
      const holder = positions[play.heldBall.by];
      const hy = yaws[play.heldBall.by];
      pos.current.x = holder.x - Math.sin(hy) * 0.5;
      pos.current.z = holder.z - Math.cos(hy) * 0.5;
      pos.current.y = 1.3;
      velocity.current.x = velocity.current.y = velocity.current.z = 0;
      inFlight.current = false;
      m.position.set(pos.current.x, pos.current.y, pos.current.z);
      m.rotation.y += dt * 1.5;
      return;
    }

    // Consume a shot impulse aimed at this ball.
    if (play.shotImpulse && play.shotImpulse.ballId === id && play.shotImpulse.t !== lastShotT.current) {
      lastShotT.current = play.shotImpulse.t;
      velocity.current.x = play.shotImpulse.vx;
      velocity.current.y = play.shotImpulse.vy;
      velocity.current.z = play.shotImpulse.vz;
      shooter.current = play.shotImpulse.by;
      inFlight.current = true;
      pos.current.y = Math.max(pos.current.y, 1.3);
      play.clearShot();
    }

    if (!isNearPlayer(pos.current.x, pos.current.z, 60)) {
      m.position.set(pos.current.x, pos.current.y, pos.current.z);
      return;
    }

    // Idle kick (only when not flying from a shot).
    if (!inFlight.current) {
      const player = positions[activeId];
      const dist = Math.hypot(pos.current.x - player.x, pos.current.z - player.z);
      if (dist < 0.7 && Math.abs(velocity.current.x) + Math.abs(velocity.current.z) < 0.5) {
        velocity.current.x = -Math.sin(yaws[activeId]) * 5.5;
        velocity.current.z = -Math.cos(yaws[activeId]) * 5.5;
        velocity.current.y = 4.5;
      }
    }

    const prevY = pos.current.y;

    // Physics: gravity + integrate.
    velocity.current.y -= 18 * dt;
    pos.current.x += velocity.current.x * dt;
    pos.current.y += velocity.current.y * dt;
    pos.current.z += velocity.current.z * dt;

    // Rim score sensor: descending through a hoop rim plane within rimR.
    if (inFlight.current && velocity.current.y < 0) {
      for (const h of Object.values(play.hoops)) {
        if (prevY >= h.rimY && pos.current.y < h.rimY) {
          const dd = Math.hypot(pos.current.x - h.x, pos.current.z - h.z);
          if (dd < h.rimR) {
            const who = shooter.current ?? activeId;
            play.scoreBasket(who, performance.now());
            swishSound();
            if (isInRoom()) broadcastBasket(who);
            inFlight.current = false;
            break;
          }
        }
      }
    }

    // Wall collision: balls bounce off house walls instead of rolling through
    // them. Resolve out the shallowest face and reflect that velocity component.
    if (Math.abs(velocity.current.x) + Math.abs(velocity.current.z) > 0.02) {
      const R = 0.16;
      const REST = 0.5;
      const cols = useGameStore.getState().staticColliders;
      for (const c of cols) {
        if (pos.current.y > (c.maxY ?? 8) + R || pos.current.y < (c.minY ?? 0)) continue;
        if (pos.current.x <= c.minX - R || pos.current.x >= c.maxX + R) continue;
        if (pos.current.z <= c.minZ - R || pos.current.z >= c.maxZ + R) continue;
        const penLeft = pos.current.x - (c.minX - R);
        const penRight = (c.maxX + R) - pos.current.x;
        const penFront = pos.current.z - (c.minZ - R);
        const penBack = (c.maxZ + R) - pos.current.z;
        const minPen = Math.min(penLeft, penRight, penFront, penBack);
        if (minPen === penLeft) { pos.current.x = c.minX - R; if (velocity.current.x > 0) velocity.current.x = -velocity.current.x * REST; }
        else if (minPen === penRight) { pos.current.x = c.maxX + R; if (velocity.current.x < 0) velocity.current.x = -velocity.current.x * REST; }
        else if (minPen === penFront) { pos.current.z = c.minZ - R; if (velocity.current.z > 0) velocity.current.z = -velocity.current.z * REST; }
        else { pos.current.z = c.maxZ + R; if (velocity.current.z < 0) velocity.current.z = -velocity.current.z * REST; }
      }
    }

    // Ground bounce.
    if (pos.current.y < 0.16) {
      pos.current.y = 0.16;
      inFlight.current = false;
      if (velocity.current.y < -0.5) velocity.current.y = -velocity.current.y * 0.55;
      else velocity.current.y = 0;
      velocity.current.x *= 0.82;
      velocity.current.z *= 0.82;
      if (Math.abs(velocity.current.x) < 0.05) velocity.current.x = 0;
      if (Math.abs(velocity.current.z) < 0.05) velocity.current.z = 0;
    }

    m.position.set(pos.current.x, pos.current.y, pos.current.z);
    const spin = Math.hypot(velocity.current.x, velocity.current.z);
    if (spin > 0.05) {
      m.rotation.x += spin * dt * 1.5;
      m.rotation.z += spin * dt * 0.8;
    }
  });

  return (
    <mesh ref={meshRef} position={[position[0], 0.16, position[2]]} castShadow>
      <sphereGeometry args={[0.16, 16, 16]} />
      <meshStandardMaterial color="#d8662a" roughness={0.9} />
    </mesh>
  );
}
