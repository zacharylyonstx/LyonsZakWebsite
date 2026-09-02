// VENDORED UNMODIFIED from ~/Game (branch cine-mode @ aba458e): src/components/House.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { HouseConfig, Lot } from '../types';
import { Roof } from './Roof';
import { Door } from './Door';
import { HouseInterior } from './HouseInterior';
import { WindowUnit, EntryPortico, GableAccent, CoachLight } from './houseDetail';
import { mat } from '../world/materials';
import { destructionProgress, destructionPhases } from '../world/houseDestruction';
import { useTornadoStore } from '../state/tornadoStore';
import { getHouseDamage } from '../world/tornadoDamage';

// How many flying pieces a house can shed (roof shingles + siding planks + brick
// chunks). One instanced mesh per house; inert (hidden) until the storm damages it.
const PIECE_COUNT = 96;

const STORY_H = 3.0;
const GARAGE_W = 5.6;
const GARAGE_H = 2.4;
const DOOR_W = 1.05;
const DOOR_H = 2.15;
const WALL_T = 0.18;

// Authentic Avery Ranch / Acme-brick + James-Hardie palettes (researched: real
// DR Horton 2004-2010 tract homes). Selected per house from the address seed so
// every home on the street looks distinct.
const BRICKS = ['#9e4b3c', '#8a4636', '#985641', '#6e4a38', '#a06b4e', '#c2a878', '#cbb893', '#a8987e'];
const SIDINGS = ['#c9b79c', '#a8997e', '#b3a894', '#cfc4b0', '#d8ccad', '#9fa288', '#c2cac4', '#7c8b92'];
const ROOFS = ['#5b4e3f', '#6a6258', '#4a4843', '#5e5a53', '#6b6258'];
const DOORS = ['#7a4e2c', '#3a2a1e', '#1c1c1a', '#27374b', '#34433a', '#6e2a24', '#ede7da'];
// Shutter colours, black-weighted (black listed twice).
const SHUTTERS = ['#1c1c1a', '#1c1c1a', '#2b2520', '#23352a', '#5a2a24', '#1f2a3c'];

function seedFor(address: string): number {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  return h;
}

interface HouseProps {
  config: HouseConfig;
  lot: Lot;
}

export function House({ config, lot }: HouseProps) {
  const wallH = config.stories * STORY_H;
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  // ~6:12 pitch (rise = depth/4 → rise/(depth/2) = 0.5), with a floor so very
  // shallow footprints still read as a pitched roof, not a slab.
  const roofH = Math.max(2.2, config.depth / 4);

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const doorCenterX = config.garageOnLeft ? halfW - 1.6 : -halfW + 1.6;

  // Per-house varied palette (seeded by address). Brick front, lap siding on
  // the sides/rear/gables, varied roof/door/shutter colors.
  const seed = seedFor(config.address);
  const brickColor = BRICKS[seed % BRICKS.length];
  const sidingColor = SIDINGS[(seed >> 3) % SIDINGS.length];
  const roofColor = ROOFS[(seed >> 6) % ROOFS.length];
  const doorColor = DOORS[(seed >> 9) % DOORS.length];
  const shutterColor = SHUTTERS[(seed >> 11) % SHUTTERS.length];
  const trimColor = '#f2efe8';
  const winGrid = (seed >> 7) % 3; // 0=2x2, 1=3x2, 2=2x3 grid style
  const hasShutters = (seed % 4) !== 0; // ~75% of houses have shutters
  const hasFrontGable = config.stories === 2 && !config.hipped && ((seed >> 4) & 1) === 0; // ~half of 2-story
  const sidingMaterial = mat.lapSiding(sidingColor);
  const brickMaterial = mat.brick(brickColor);

  // Destruction refs (tornado-mode). Progressive damage overhaul:
  //   • the funnel RAMPS damage (0..1) on every house it passes near
  //   • houses shed real roof shingles / siding planks / brick chunks that get
  //     sucked UP into the funnel, tumble through, then fall + scatter on the lawn
  //   • a graze leaves the house standing but battered (roof torn, leaning,
  //     pieces shed); a DIRECT HIT collapses it to a near-total wreck
  //   • dust burst + low rubble materialize on a direct hit
  const bodyRef = useRef<THREE.Group>(null);
  const roofRef = useRef<THREE.Group>(null);
  const rubbleRef = useRef<THREE.Mesh>(null);
  const rubbleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const debrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const dustMeshRef = useRef<THREE.Mesh>(null);
  const dustMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Static per-piece descriptors (stable per house instance): what kind of
  // wreckage it is, where it tears off from, its size/colour, the damage level
  // at which it detaches, and its launch impulse + spin.
  const pieces = useMemo(() => {
    const roofY = wallH + roofH * 0.45;
    const arr = [];
    for (let i = 0; i < PIECE_COUNT; i++) {
      const r = i / PIECE_COUNT;
      let kind: 'shingle' | 'siding' | 'brick';
      if (r < 0.5) kind = 'shingle';
      else if (r < 0.82) kind = 'siding';
      else kind = 'brick';
      let ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, color: string, threshold: number;
      if (kind === 'shingle') {
        // Roof shingles peel FIRST (low thresholds) and fly the most.
        ox = (Math.random() - 0.5) * config.width;
        oy = roofY + Math.random() * roofH * 0.4;
        oz = (Math.random() - 0.5) * config.depth;
        sx = 0.4 + Math.random() * 0.25; sy = 0.05; sz = 0.34 + Math.random() * 0.2;
        color = roofColor;
        threshold = 0.12 + Math.random() * 0.5;
      } else if (kind === 'siding') {
        // Siding planks off the walls at mid damage.
        const onSide = Math.random() < 0.6;
        ox = onSide ? (Math.random() < 0.5 ? -halfW : halfW) : (Math.random() - 0.5) * config.width;
        oz = onSide ? (Math.random() - 0.5) * config.depth : (Math.random() < 0.5 ? -halfD : halfD);
        oy = 0.5 + Math.random() * (wallH - 0.5);
        sx = 0.8 + Math.random() * 0.5; sy = 0.13; sz = 0.08;
        color = sidingColor;
        threshold = 0.4 + Math.random() * 0.45;
      } else {
        // Brick chunks off the front — only torn loose by a near-direct hit.
        ox = (Math.random() - 0.5) * config.width;
        oy = 0.5 + Math.random() * (wallH - 0.5);
        oz = -halfD;
        sx = 0.45 + Math.random() * 0.25; sy = 0.28 + Math.random() * 0.18; sz = 0.32;
        color = brickColor;
        threshold = 0.62 + Math.random() * 0.38;
      }
      const ang = Math.random() * Math.PI * 2;
      const outSpeed = 2 + Math.random() * 4;
      arr.push({
        kind, ox, oy, oz, sx, sy, sz, color, threshold,
        vx0: Math.cos(ang) * outSpeed,
        vy0: 2 + Math.random() * 4,
        vz0: Math.sin(ang) * outSpeed,
        spinX: (Math.random() - 0.5) * 8,
        spinY: (Math.random() - 0.5) * 8,
        spinZ: (Math.random() - 0.5) * 8,
      });
    }
    return arr;
  }, [config.width, config.depth, wallH, roofH, halfW, halfD, roofColor, sidingColor, brickColor]);

  // Mutable per-piece runtime state (position / velocity / rotation / flags).
  const pieceState = useMemo(
    () => pieces.map((p) => ({
      x: p.ox, y: p.oy, z: p.oz, vx: 0, vy: 0, vz: 0,
      rx: 0, ry: 0, rz: 0, detached: false, resting: false,
    })),
    [pieces],
  );
  const colorsApplied = useRef(false);
  const tmpDebrisObj = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dtRaw) => {
    const body = bodyRef.current;
    const roof = roofRef.current;
    const rubble = rubbleRef.current;
    const rubMat = rubbleMatRef.current;
    const debris = debrisMeshRef.current;
    const dust = dustMeshRef.current;
    const dustMat = dustMatRef.current;
    if (!body) return;
    const now = performance.now() / 1000;
    const dt = Math.min(dtRaw, 0.05);
    const damage = getHouseDamage(config.address);              // 0..1 progressive
    const collapseP = destructionProgress(config.address, now); // 0..1 direct-hit timeline
    const destroyed = collapseP > 0;

    // Fully intact: reset and bail. Also the path for EVERY house in non-tornado
    // modes (damage is always 0 there), so this adds no cost outside tornado.
    if (damage <= 0 && !destroyed) {
      body.scale.set(1, 1, 1);
      body.rotation.set(0, 0, 0);
      body.visible = true;
      if (roof) { roof.scale.set(1, 1, 1); roof.position.set(0, wallH + 0.1, 0); roof.rotation.set(0, 0, 0); }
      if (rubble) rubble.visible = false;
      if (debris) debris.visible = false;
      if (dust) dust.visible = false;
      return;
    }

    // Tint each piece its material colour once (roof/siding/brick).
    if (debris && !colorsApplied.current) {
      for (let i = 0; i < pieces.length; i++) debris.setColorAt(i, new THREE.Color(pieces[i].color));
      if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
      colorsApplied.current = true;
    }

    // Funnel position in this house's LOCAL space (pieces ride toward it).
    const ts = useTornadoStore.getState();
    const relWX = ts.tornadoX - lot.housePivot[0];
    const relWZ = ts.tornadoZ - lot.housePivot[1];
    const cy = Math.cos(-lot.houseYaw);
    const sy = Math.sin(-lot.houseYaw);
    const funnelLocalX = relWX * cy - relWZ * sy;
    const funnelLocalZ = relWX * sy + relWZ * cy;
    const funnelActive = ts.tornadoOpacity > 0.2;

    // --- Structural deformation ---
    const ph = destructionPhases(collapseP);
    if (roof) {
      // Shingles tear off → roof shrinks (battered); a direct hit launches it.
      const roofShrink = destroyed ? Math.min(1, collapseP * 1.8) : Math.min(0.85, damage * 0.95);
      if (destroyed) {
        const liftP = Math.min(1, collapseP * 1.8);
        roof.position.set(Math.sin(collapseP * 7) * 1.5, wallH + 0.1 + liftP * 9 - liftP * liftP * 4, Math.cos(collapseP * 5) * 1.2);
        roof.rotation.set(collapseP * 7, collapseP * 4, collapseP * 5);
      } else {
        roof.position.set(0, wallH + 0.1, 0);
        roof.rotation.set(damage * 0.12, 0, damage * 0.1);
      }
      roof.scale.setScalar(Math.max(0.04, 1 - roofShrink * 0.9));
    }
    // Body leans with damage; a DIRECT HIT collapses it to a low jagged remnant
    // (a near-total wreck — never fully flat, so the ruin still reads).
    const lean = Math.max(damage * 0.22, destroyed ? ph.wallShrink * 0.4 : 0);
    body.rotation.z = -lean;
    if (destroyed) {
      const severity = Math.max(0.4, damage);    // direct hits ≈ 1
      const remnant = 0.28 - severity * 0.18;    // 0.10..0.21 of original height
      body.scale.set(1, Math.max(remnant, 1 - ph.wallShrink * (1 - remnant)), 1);
    } else {
      body.scale.set(1, 1, 1);                    // grazed → still standing
    }
    body.visible = true;

    // --- Flying pieces (roof shingles / siding planks / brick chunks) ---
    if (debris) {
      debris.visible = true;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const s = pieceState[i];
        if (!s.detached) {
          if (damage >= p.threshold || destroyed) {
            s.detached = true;
            s.x = p.ox; s.y = p.oy; s.z = p.oz;
            s.vx = p.vx0; s.vy = p.vy0; s.vz = p.vz0;
          } else {
            // Still attached → hidden (the house mesh shows it in place).
            tmpDebrisObj.position.set(0, -1000, 0);
            tmpDebrisObj.scale.setScalar(0);
            tmpDebrisObj.rotation.set(0, 0, 0);
            tmpDebrisObj.updateMatrix();
            debris.setMatrixAt(i, tmpDebrisObj.matrix);
            continue;
          }
        }
        if (!s.resting) {
          const dx = funnelLocalX - s.x;
          const dz = funnelLocalZ - s.z;
          const d = Math.hypot(dx, dz) || 0.001;
          const captured = funnelActive && d < 16 && s.y < 34;
          if (captured) {
            const k = 1 - d / 16;
            s.vx += (dx / d) * 26 * k * dt - (dz / d) * 16 * k * dt; // suck inward + swirl
            s.vz += (dz / d) * 26 * k * dt + (dx / d) * 16 * k * dt;
            s.vy += 18 * dt;                                          // strong updraft
            if (s.vy > 18) s.vy = 18;
          } else {
            s.vy -= 18 * dt;                                          // gravity once clear
            s.vx *= 0.99; s.vz *= 0.99;
          }
          s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
          s.rx += p.spinX * dt; s.ry += p.spinY * dt; s.rz += p.spinZ * dt;
          const restY = 0.06 + p.sy * 0.5;
          if (s.y <= restY && s.vy < 0 && !captured) {
            s.y = restY; s.vx = s.vy = s.vz = 0; s.resting = true;
            s.rx = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;       // lie roughly flat
          }
        }
        tmpDebrisObj.position.set(s.x, s.y, s.z);
        tmpDebrisObj.rotation.set(s.rx, s.ry, s.rz);
        tmpDebrisObj.scale.set(p.sx, p.sy, p.sz);
        tmpDebrisObj.updateMatrix();
        debris.setMatrixAt(i, tmpDebrisObj.matrix);
      }
      debris.instanceMatrix.needsUpdate = true;
    }

    // Dust burst + low rubble only on a direct hit.
    if (dust && dustMat) {
      if (destroyed) {
        dust.visible = true;
        const dustP = Math.min(1, collapseP * 1.2);
        dust.scale.setScalar(1 + dustP * 16);
        dustMat.opacity = 0.5 * (1 - dustP);
      } else {
        dust.visible = false;
      }
    }
    if (rubble) {
      rubble.visible = destroyed && ph.rubble > 0;
      if (rubMat) rubMat.opacity = ph.rubble * 0.9;
    }
  });

  return (
    <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
      {/* Foundation slab — always visible (even after destruction) */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[config.width + 0.5, 0.1, config.depth + 0.5]} />
        <meshStandardMaterial color="#9c9890" roughness={0.85} />
      </mesh>

      {/* Rubble pile (visible after destruction completes) */}
      <mesh ref={rubbleRef} position={[0, 0.5, 0]} visible={false}>
        <boxGeometry args={[config.width * 0.9, 1.0, config.depth * 0.9]} />
        <meshStandardMaterial
          ref={rubbleMatRef}
          color="#6a5040"
          roughness={1}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Flying wreckage — roof shingles / siding planks / brick chunks, each
          tinted per-instance to its real material colour. Inert until the storm
          tears the house apart. */}
      <instancedMesh
        ref={debrisMeshRef}
        args={[undefined, undefined, PIECE_COUNT]}
        visible={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>

      {/* Dust burst sphere */}
      <mesh ref={dustMeshRef} position={[0, 2, 0]} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          ref={dustMatRef}
          color="#a89888"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      <group ref={bodyRef}>

      {/* Side walls (lap siding) */}
      <SolidWall position={[-halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={sidingMaterial} />
      <SolidWall position={[halfW, wallH / 2 + 0.1, 0]} args={[WALL_T, wallH, config.depth]} material={sidingMaterial} />

      {/* Back wall (lap siding) */}
      <SolidWall position={[0, wallH / 2 + 0.1, halfD]} args={[config.width, wallH, WALL_T]} material={sidingMaterial} />

      {/* Front wall (brick veneer) with garage + front-door cutouts */}
      <FrontWallWithCutouts
        width={config.width}
        height={wallH}
        thickness={WALL_T}
        material={brickMaterial}
        z={-halfD}
        openings={[
          { x: garageCenterX, w: GARAGE_W, h: GARAGE_H },
          { x: doorCenterX, w: DOOR_W, h: DOOR_H },
        ]}
      />

      {/* Roof + gable end fillers (only for gable roofs) — separate ref so the
          roof can independently drop/scale during the destruction animation */}
      <group ref={roofRef} position={[0, wallH + 0.1, 0]}>
        <Roof
          width={config.width}
          depth={config.depth}
          height={roofH}
          color={roofColor}
          hipped={config.hipped}
        />
        {!config.hipped && (
          <>
            <GableEnd width={config.width} depth={config.depth} height={roofH} material={sidingMaterial} side="left" />
            <GableEnd width={config.width} depth={config.depth} height={roofH} material={sidingMaterial} side="right" />
          </>
        )}
      </group>

      {/* Front door (animated, openable, registers as a Door for interaction) */}
      <Door
        id={`house-${config.address}`}
        x={doorCenterX}
        z={-halfD}
        width={DOOR_W}
        height={DOOR_H}
        color={doorColor}
        trimColor={trimColor}
        houseWorldX={lot.housePivot[0]}
        houseWorldZ={lot.housePivot[1]}
        houseYaw={lot.houseYaw}
      />

      {/* Garage door */}
      <GarageDoor x={garageCenterX} z={-halfD} />

      {/* Windows on every elevation + shutters */}
      <FacadeDetail
        width={config.width}
        depth={config.depth}
        stories={config.stories}
        garageOnLeft={config.garageOnLeft}
        garageCenterX={garageCenterX}
        doorCenterX={doorCenterX}
        halfD={halfD}
        halfW={halfW}
        trimColor={trimColor}
        shutterColor={hasShutters ? shutterColor : null}
        winGrid={winGrid}
      />

      {/* Covered entry over the front door + coach light */}
      <EntryPortico x={doorCenterX} z={-halfD - 0.05} doorH={DOOR_H} postColor={trimColor} roofColor={roofColor} />
      <CoachLight position={[doorCenterX + (config.garageOnLeft ? -1.0 : 1.0), 1.9, -halfD - 0.12]} />

      {/* Front-facing siding gable over the garage (box-breaker, 2-story) */}
      {hasFrontGable && (
        <GableAccent
          centerX={garageCenterX}
          baseY={wallH + 0.1}
          width={GARAGE_W + 1.4}
          height={Math.min(2.0, (GARAGE_W + 1.4) / 4)}
          z={-halfD - 0.04}
          sidingColor={sidingColor}
        />
      )}

      {/* Foundation shrubs along the front (non-garage side) */}
      <FoundationShrubs halfW={halfW} halfD={halfD} garageOnLeft={config.garageOnLeft} seed={seed} />

      {/* Address plaque next to the front door */}
      <AddressPlaque
        address={config.address}
        x={config.garageOnLeft ? halfW - 0.5 : -halfW + 0.5}
        y={2.6}
        z={-halfD - 0.06}
      />

      {/* Fascia/soffit band under the eaves (crisp white) + thin shadow reveal */}
      <mesh position={[0, wallH + 0.12, 0]}>
        <boxGeometry args={[config.width + 0.62, 0.14, config.depth + 0.62]} />
        <meshStandardMaterial color="#f2efe8" roughness={0.7} />
      </mesh>
      <mesh position={[0, wallH + 0.02, 0]}>
        <boxGeometry args={[config.width + 0.5, 0.06, config.depth + 0.5]} />
        <meshStandardMaterial color="#3a342a" />
      </mesh>
      {/* Belt course where brick (1st story) meets siding (2-story only) */}
      {config.stories === 2 && (
        <mesh position={[0, STORY_H + 0.05, -halfD - 0.06]} castShadow>
          <boxGeometry args={[config.width + 0.1, 0.16, 0.12]} />
          <meshStandardMaterial color={trimColor} roughness={0.7} />
        </mesh>
      )}
      </group> {/* end bodyRef wrapper */}

      {/* Cozy living room — every house is enterable. Renders only when near. */}
      <HouseInterior
        width={config.width}
        depth={config.depth}
        worldX={lot.housePivot[0]}
        worldZ={lot.housePivot[1]}
        seed={config.address.charCodeAt(2) * 13 + config.address.charCodeAt(4) * 7}
      />
    </group>
  );
}

/** A low row of foundation shrubs along the front (non-garage half). */
function FoundationShrubs({ halfW, halfD, garageOnLeft, seed }: { halfW: number; halfD: number; garageOnLeft: boolean; seed: number }) {
  // Door/window side is OPPOSITE the garage. Place a tidy row of bushes there.
  const sign = garageOnLeft ? 1 : -1; // +1 = right half, -1 = left half
  const z = -halfD - 0.5;
  const greens = ['#3f7a3f', '#4a8246', '#3a6e3c', '#558a4e'];
  const n = 5;
  const shrubs: React.ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const x = sign * (1.0 + i * (halfW - 1.4) / n);
    const r = 0.42 + ((seed >> (i + 1)) % 5) * 0.04;
    shrubs.push(
      <mesh key={i} position={[x, r * 0.7, z]} castShadow scale={[1, 0.8, 1]}>
        <icosahedronGeometry args={[r, 1]} />
        <meshStandardMaterial color={greens[(seed + i) % greens.length]} roughness={0.95} flatShading />
      </mesh>,
    );
  }
  return <>{shrubs}</>;
}

/** Windows on EVERY elevation. Front: colonial grids + shutters; sides/rear:
 *  plain glass, no shutters (the real DR Horton cost-saving pattern). */
function FacadeDetail({
  width, depth, stories, garageOnLeft, garageCenterX, doorCenterX, halfD, halfW, trimColor, shutterColor, winGrid,
}: {
  width: number; depth: number; stories: 1 | 2;
  garageOnLeft: boolean; garageCenterX: number; doorCenterX: number;
  halfD: number; halfW: number; trimColor: string; shutterColor: string | null; winGrid: number;
}) {
  // Surface-mount offset. Walls are WALL_T thick and CENTERED on ±halfW/±halfD,
  // so a wall's outer face sits half a thickness proud of the nominal plane. The
  // window's white casing sits ~0.045 BEHIND its origin (after the facing flip),
  // so the origin must clear (WALL_T/2 + casing depth) or the glass renders
  // *inside* the wall and the panes show brick. 0.16 keeps the whole unit proud.
  const MOUNT = 0.16;
  const fz = -halfD - MOUNT; // front, glazing faces the street (-Z)
  const [fc, fr] = winGrid === 2 ? [2, 3] : [3, 2]; // front colonial grid
  const sc = shutterColor; // null = this house has no shutters
  const wins: React.ReactElement[] = [];

  // --- FRONT: mulled living-room picture window (anchor) + shutters ---
  const garageInner = garageOnLeft ? garageCenterX + GARAGE_W / 2 : garageCenterX - GARAGE_W / 2;
  const doorInner = garageOnLeft ? doorCenterX - DOOR_W / 2 : doorCenterX + DOOR_W / 2;
  const lrX = (garageInner + doorInner) / 2;
  wins.push(
    <WindowUnit key="lr" position={[lrX, 1.55, fz]} w={2.3} h={1.5} cols={4} rows={2} trimColor={trimColor} shutters={!!sc} shutterColor={sc ?? undefined} facing="-z" />,
  );

  // --- FRONT upper-floor windows (2-story) ---
  if (stories === 2) {
    const upY = STORY_H + 1.55;
    [garageCenterX - 1.4, garageCenterX + 1.4, doorCenterX].forEach((x, i) => {
      wins.push(
        <WindowUnit key={`uf${i}`} position={[x, upY, fz]} w={1.0} h={1.3} cols={fc} rows={fr} trimColor={trimColor} shutters={!!sc} shutterColor={sc ?? undefined} facing="-z" />,
      );
    });
  }

  // --- SIDE windows: plain glass, no grid, no shutters ---
  const sideZ = [-depth * 0.24, depth * 0.12];
  for (const side of [-1, 1] as const) {
    const x = side * (halfW + MOUNT);
    const facing: 'x' | '-x' = side === 1 ? 'x' : '-x';
    sideZ.forEach((sz, i) => {
      wins.push(<WindowUnit key={`s${side}_${i}`} position={[x, 1.5, sz]} w={1.0} h={1.3} cols={1} rows={1} trimColor={trimColor} facing={facing} />);
    });
    if (stories === 2) {
      sideZ.forEach((sz, i) => {
        wins.push(<WindowUnit key={`su${side}_${i}`} position={[x, STORY_H + 1.5, sz]} w={0.9} h={1.1} cols={1} rows={1} trimColor={trimColor} facing={facing} />);
      });
    }
  }

  // --- REAR: kitchen + family windows + a sliding patio door ---
  const rz = halfD + MOUNT;
  wins.push(<WindowUnit key="r1" position={[-width * 0.26, 1.5, rz]} w={1.4} h={1.3} cols={1} rows={1} trimColor={trimColor} facing="z" />);
  wins.push(<WindowUnit key="r2" position={[width * 0.3, 1.5, rz]} w={1.0} h={1.3} cols={1} rows={1} trimColor={trimColor} facing="z" />);
  wins.push(<WindowUnit key="patio" position={[width * 0.02, 1.15, rz]} w={1.9} h={2.1} cols={2} rows={1} trimColor={trimColor} facing="z" />);
  if (stories === 2) {
    [-width * 0.28, 0, width * 0.28].forEach((x, i) => {
      wins.push(<WindowUnit key={`ru${i}`} position={[x, STORY_H + 1.5, rz]} w={0.9} h={1.1} cols={1} rows={1} trimColor={trimColor} facing="z" />);
    });
  }

  return <>{wins}</>;
}

function SolidWall({
  position,
  args,
  material,
}: {
  position: [number, number, number];
  args: [number, number, number];
  material: THREE.Material;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

interface Opening { x: number; w: number; h: number; }

interface FrontWallProps {
  width: number;
  height: number;
  thickness: number;
  material: THREE.Material;
  z: number;
  openings: Opening[];
}

function FrontWallWithCutouts({ width, height, thickness, material, z, openings }: FrontWallProps) {
  const sorted = [...openings].sort((a, b) => a.x - b.x);
  const panels: React.ReactElement[] = [];
  let cursor = -width / 2;
  let key = 0;

  for (const op of sorted) {
    const opLeft = op.x - op.w / 2;
    const opRight = op.x + op.w / 2;

    if (opLeft - cursor > 0.01) {
      const w = opLeft - cursor;
      panels.push(
        <mesh key={`l${key}`} position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[w, height, thickness]} />
          <primitive object={material} attach="material" />
        </mesh>,
      );
    }

    const aboveH = height - op.h;
    if (aboveH > 0.01) {
      panels.push(
        <mesh key={`a${key}`} position={[op.x, op.h + aboveH / 2 + 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[op.w, aboveH, thickness]} />
          <primitive object={material} attach="material" />
        </mesh>,
      );
    }

    cursor = opRight;
    key += 1;
  }

  if (width / 2 - cursor > 0.01) {
    const w = width / 2 - cursor;
    panels.push(
      <mesh key="r" position={[cursor + w / 2, height / 2 + 0.1, z]} castShadow receiveShadow>
        <boxGeometry args={[w, height, thickness]} />
        <primitive object={material} attach="material" />
      </mesh>,
    );
  }

  return <>{panels}</>;
}

interface GableEndProps {
  width: number;
  depth: number;
  height: number;
  material: THREE.Material;
  side: 'left' | 'right';
}

function GableEnd({ width, depth, height, material, side }: GableEndProps) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-depth / 2, 0);
    s.lineTo(depth / 2, 0);
    s.lineTo(0, height);
    s.closePath();
    return s;
  }, [depth, height]);

  const x = side === 'left' ? -width / 2 : width / 2;
  const yRot = side === 'left' ? -Math.PI / 2 : Math.PI / 2;

  return (
    <mesh position={[x, 0, 0]} rotation={[0, yRot, 0]}>
      <shapeGeometry args={[shape]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function GarageDoor({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* trim header */}
      <mesh position={[0, GARAGE_H + 0.18, 0]} castShadow>
        <boxGeometry args={[GARAGE_W + 0.3, 0.18, 0.22]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.85} />
      </mesh>
      {/* door panel — 4 stacked sections with rounded grooves */}
      {[0, 1, 2, 3].map((i) => {
        const sectionH = (GARAGE_H - 0.05) / 4;
        const yC = 0.1 + sectionH * (i + 0.5);
        return (
          <mesh key={i} position={[0, yC, -0.04]} castShadow>
            <boxGeometry args={[GARAGE_W - 0.05, sectionH - 0.04, 0.06]} />
            <meshStandardMaterial color="#dcd2c0" roughness={0.7} metalness={0.1} />
          </mesh>
        );
      })}
      {/* top windows row (in the topmost section) */}
      <mesh position={[0, 0.1 + (GARAGE_H - 0.05) * 0.875, 0.0]}>
        <boxGeometry args={[GARAGE_W - 0.6, 0.32, 0.02]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.5} roughness={0.2} emissive="#0d1620" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}


function AddressPlaque({
  address,
  x,
  y,
  z,
}: {
  address: string;
  x: number;
  y: number;
  z: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[0.78, 0.3, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
      </mesh>
      <Text
        position={[0, 0, 0.03]}
        fontSize={0.18}
        color="#f5d35a"
        anchorX="center"
        anchorY="middle"
      >
        {address}
      </Text>
    </group>
  );
}
