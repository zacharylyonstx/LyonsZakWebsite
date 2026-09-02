// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/hero/Playhouse.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { Text } from '@react-three/drei';

// Kid-sized backyard playhouse modeled on the real "68" clubhouse: light grey-white
// board walls, two big front windows with a white "68" placard between them, a play
// serving-counter ledge, and a door on the +X side you can walk through (its wall
// colliders are emitted by HeroHouse10600.buildPlayhouseColliders).
export const PLAYHOUSE_W = 3.6;
export const PLAYHOUSE_H = 2.25;
export const PLAYHOUSE_D = 3.0;
const WALL = '#e2e6e9';
const TRIM = '#ffffff';
const ROOFC = '#c9ced2';

function Panel({ x, y, z, w, h, d = 0.1, color = WALL }: { x: number; y: number; z: number; w: number; h: number; d?: number; color?: string }) {
  return (
    <mesh position={[x, y, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function PlayWindow({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh><boxGeometry args={[0.92, 1.0, 0.05]} /><meshStandardMaterial color="#bfe0ef" emissive="#dff0f8" emissiveIntensity={0.35} metalness={0.1} roughness={0.1} /></mesh>
      {/* white frame */}
      <mesh position={[0, 0.52, 0.02]}><boxGeometry args={[1.02, 0.08, 0.06]} /><meshStandardMaterial color={TRIM} /></mesh>
      <mesh position={[0, -0.52, 0.02]}><boxGeometry args={[1.02, 0.08, 0.06]} /><meshStandardMaterial color={TRIM} /></mesh>
      {[-0.51, 0.51].map((dx, i) => <mesh key={i} position={[dx, 0, 0.02]}><boxGeometry args={[0.08, 1.08, 0.06]} /><meshStandardMaterial color={TRIM} /></mesh>)}
      <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.06, 1.0, 0.05]} /><meshStandardMaterial color={TRIM} /></mesh>
    </group>
  );
}

export function Playhouse({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const hw = PLAYHOUSE_W / 2;   // 1.8
  const hd = PLAYHOUSE_D / 2;   // 1.5
  const H = PLAYHOUSE_H;
  const zf = -hd;               // front (faces the deck / -Z)
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Floor pad */}
      <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[PLAYHOUSE_W + 0.1, 0.12, PLAYHOUSE_D + 0.1]} /><meshStandardMaterial color="#b08458" roughness={0.95} /></mesh>

      {/* ---- FRONT wall (-Z): DOOR gap (LEFT, x=0.55..1.45 in local = viewer's left,
           filled by the openable Door in HeroHouse10600), WINDOW + counter (RIGHT),
           "68" placard up top — matches the photo from the porch ---- */}
      <Panel x={1.625} y={H / 2} z={zf} w={0.35} h={H} />                   {/* left edge (viewer left) */}
      <Panel x={1.0} y={2.07} z={zf} w={0.9} h={0.36} />                    {/* header above the door */}
      <Panel x={0.1} y={H / 2} z={zf} w={0.9} h={H} />                      {/* pier between door & window */}
      <Panel x={-0.9} y={0.4} z={zf} w={1.1} h={0.8} />                     {/* counter base under window */}
      <Panel x={-0.9} y={2.02} z={zf} w={1.1} h={0.46} />                   {/* above window */}
      <Panel x={-1.625} y={H / 2} z={zf} w={0.35} h={H} />                  {/* right edge */}
      <PlayWindow x={-0.9} y={1.3} z={zf - 0.02} />
      {/* "68" white circle placard up top (disc faces -Z) */}
      <mesh position={[-0.2, 1.92, zf - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 28]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.7} />
      </mesh>
      <Text position={[-0.2, 1.92, zf - 0.1]} rotation={[0, Math.PI, 0]} fontSize={0.3} color="#3a4654" anchorX="center" anchorY="middle">68</Text>
      {/* Serving counter ledge under the window */}
      <mesh position={[-0.9, 0.82, zf - 0.34]} castShadow receiveShadow><boxGeometry args={[1.2, 0.06, 0.6]} /><meshStandardMaterial color="#d8cbb0" roughness={0.85} /></mesh>

      {/* ---- BACK wall (+Z) ---- */}
      <Panel x={0} y={H / 2} z={hd} w={PLAYHOUSE_W} h={H} />

      {/* ---- LEFT (-X) + RIGHT (+X) walls: solid (thin in X, running along Z) ---- */}
      <mesh position={[-hw, H / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.1, H, PLAYHOUSE_D]} /><meshStandardMaterial color={WALL} roughness={0.85} /></mesh>
      <mesh position={[hw, H / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.1, H, PLAYHOUSE_D]} /><meshStandardMaterial color={WALL} roughness={0.85} /></mesh>

      {/* ---- Slanted roof ---- */}
      <mesh position={[0, H + 0.12, 0.1]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[PLAYHOUSE_W + 0.35, 0.12, PLAYHOUSE_D + 0.45]} />
        <meshStandardMaterial color={ROOFC} roughness={0.8} />
      </mesh>
      {/* warm interior light so the inside reads when you walk in */}
      <pointLight position={[0, 1.4, 0]} intensity={2.4} distance={5} decay={2} color="#fff2dc" />
    </group>
  );
}
