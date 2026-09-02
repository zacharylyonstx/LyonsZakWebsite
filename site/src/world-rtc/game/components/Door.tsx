// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/Door.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useGameStore } from '../state/gameStore';

const DOOR_T = 0.06;

interface DoorProps {
  /** Globally unique door id. */
  id: string;
  /** Door center in HOUSE-LOCAL space (x, z). z is typically -halfD. */
  x: number;
  z: number;
  width: number;
  height: number;
  color: string;
  trimColor: string;
  /** House world transform — used to register a world-space prompt center. */
  houseWorldX: number;
  houseWorldZ: number;
  houseYaw: number;
  /** Hinge side. Default 'left' opens inward to the right. */
  hinge?: 'left' | 'right';
  /** Decorative: render a normal closed door but don't make it openable
   *  (used for neighbor houses, which are solid and have no interior). */
  decorative?: boolean;
}

/**
 * A door: hinged panel + trim + porch step. Animates open/closed via a target
 * angle interpolated each frame. Registers its world position with the store
 * so the player controller can detect proximity and toggle it.
 */
export function Door({
  id,
  x,
  z,
  width,
  height,
  color,
  trimColor,
  houseWorldX,
  houseWorldZ,
  houseYaw,
  hinge = 'left',
  decorative = false,
}: DoorProps) {
  const panelGroup = useRef<Group>(null);
  const registerDoor = useGameStore((s) => s.registerDoor);
  const doors = useGameStore((s) => s.doors);

  useEffect(() => {
    if (decorative) return; // not openable — skip registration
    // Compute world XZ of the door center.
    const cy = Math.cos(houseYaw);
    const sy = Math.sin(houseYaw);
    const wx = houseWorldX + x * cy + z * sy;
    const wz = houseWorldZ - x * sy + z * cy;
    registerDoor(
      id,
      {
        // Tight AABB at the door's world position so when closed it blocks.
        minX: wx - width / 2,
        maxX: wx + width / 2,
        minZ: wz - DOOR_T,
        maxZ: wz + DOOR_T,
        minY: 0,
        maxY: height,
        passable: false,
        tag: id,
      },
      wx,
      wz,
    );
  }, [id, x, z, width, height, houseWorldX, houseWorldZ, houseYaw, registerDoor, decorative]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const g = panelGroup.current;
    if (!g) return;
    const door = doors[id];
    const targetAngle = door?.open ? (hinge === 'left' ? -Math.PI / 1.6 : Math.PI / 1.6) : 0;
    const cur = g.rotation.y;
    const k = Math.min(1, 9 * dt);
    g.rotation.y = cur + (targetAngle - cur) * k;
  });

  const hingeX = hinge === 'left' ? -width / 2 + DOOR_T : width / 2 - DOOR_T;
  const panelOffset = hinge === 'left' ? width / 2 - DOOR_T : -width / 2 + DOOR_T;

  return (
    <group position={[x, 0, z]}>
      {/* trim */}
      <mesh position={[-width / 2 - 0.07, height / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.14, height + 0.24, 0.2]} />
        <meshStandardMaterial color={trimColor} roughness={0.7} />
      </mesh>
      <mesh position={[width / 2 + 0.07, height / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.14, height + 0.24, 0.2]} />
        <meshStandardMaterial color={trimColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, height + 0.18, 0]} castShadow>
        <boxGeometry args={[width + 0.28, 0.14, 0.22]} />
        <meshStandardMaterial color={trimColor} roughness={0.7} />
      </mesh>
      {/* porch step */}
      <mesh position={[0, 0.08, -0.32]} castShadow receiveShadow>
        <boxGeometry args={[width + 1.2, 0.16, 0.7]} />
        <meshStandardMaterial color="#bbb5a8" roughness={0.85} />
      </mesh>

      {/* door panel — hinged */}
      <group ref={panelGroup} position={[hingeX, height / 2 + 0.1, 0]}>
        <mesh position={[panelOffset, 0, 0]} castShadow>
          <boxGeometry args={[width - DOOR_T * 2, height - 0.06, DOOR_T]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        {/* knob */}
        <mesh position={[panelOffset + (hinge === 'left' ? width / 2 - 0.18 : -(width / 2 - 0.18)), 0, DOOR_T / 2 + 0.005]} castShadow>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#c8a32a" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}
