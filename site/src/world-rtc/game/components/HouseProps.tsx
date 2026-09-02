// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/HouseProps.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (G1.1 Task 3): ParkedCar's group carries
// userData.crossingNoBatch — its transform is driven per-frame from the
// playStore registry (registration + first positioning happen across the
// first few frames), so baking it into the static batch is a race: a bake
// that lands before the first positioning frame freezes every car at the
// world origin. Cars are semantically dynamic objects; they stay individual
// draws (~a few dozen), excluded from the cinematic static batch by
// construction. See src/cinematicWorld.ts.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { HouseConfig, Lot } from '../types';
import type { HouseProps as HousePropsData } from '../world/props';
import { usePlayStore } from '../state/playStore';
import { useTornadoStore } from '../state/tornadoStore';
import { getCarThrow } from '../world/tornadoCarThrow';
import { Truck } from './props/Truck';
import { Sedan } from './props/Sedan';
import { GolfCart } from './props/GolfCart';
import { BBQGrill } from './props/BBQGrill';
import { BasketballHoop } from './props/BasketballHoop';
import { TrashBins } from './props/TrashBins';
import { PatioSet } from './props/PatioSet';
import { GardenBed } from './props/GardenBed';
import { Hose } from './props/Hose';
import { Bike } from './props/Bike';
import { Flagpole } from './props/Flagpole';
import { Basketball } from './props/Basketball';
import { Cat } from './props/Cat';
import { Sprinkler } from './props/Sprinkler';
import { LOT_FRONT_RADIUS, frontStripReach } from '../world/streetLayout';

const GARAGE_W = 5.6;

interface HousePropsRendererProps {
  config: HouseConfig;
  lot: Lot;
  data: HousePropsData;
}

/** Convert house-local (x, y, z) to world (x, y, z). */
function toWorld(lx: number, ly: number, lz: number, pivot: [number, number], yaw: number): [number, number, number] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return [pivot[0] + lx * cy + lz * sy, ly, pivot[1] - lx * sy + lz * cy];
}

/** The parked car — rendered in WORLD space from its live registered spot, so it
 *  stays wherever the last driver left it. Hidden while someone is driving it
 *  (the driven copy follows the driver via RiddenBikes). In tornado mode, when
 *  the funnel reaches it the car is RIPPED off the driveway: sucked up, spun,
 *  tumbled through the vortex, then flung out and gone. */
/** A parked, drivable car. Generic over playStore.cars — also used by the
 * across-the-boulevard zone for its golf cart. Hides while driven; tornado
 * mode can rip it into the funnel. */
export function ParkedCar({ carId }: { carId: string }) {
  const car = usePlayStore((s) => s.cars[carId]);
  const driven = usePlayStore((s) =>
    Object.values(s.riding).some((r) => r && r.vehicle === 'car' && r.bikeId === carId));
  const ref = useRef<Group>(null);
  const st = useRef({
    inited: false, done: false, ejected: false,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, spinX: 0, spinY: 0, spinZ: 0,
  });

  useFrame((_, dtRaw) => {
    const g = ref.current;
    if (!g || !car) return;
    const throwAt = getCarThrow(carId);
    if (throwAt == null) {
      // Resting on the driveway (every mode except a tornado that's reached it).
      g.visible = true;
      g.position.set(car.x, 0, car.z);
      g.rotation.set(0, car.yaw, 0);
      const s = st.current; s.inited = false; s.done = false; s.ejected = false;
      return;
    }
    const s = st.current;
    if (s.done) { g.visible = false; return; }
    const dt = Math.min(dtRaw, 0.05);
    if (!s.inited) {
      s.inited = true; g.visible = true;
      s.x = car.x; s.y = 0; s.z = car.z;
      s.vx = 0; s.vy = 4; s.vz = 0;
      s.rx = 0; s.ry = car.yaw; s.rz = 0;
      s.spinX = (Math.random() - 0.5) * 5;
      s.spinY = (Math.random() - 0.5) * 4;
      s.spinZ = (Math.random() - 0.5) * 5;
    }
    const t = useTornadoStore.getState();
    const dx = t.tornadoX - s.x;
    const dz = t.tornadoZ - s.z;
    const d = Math.hypot(dx, dz) || 0.001;
    if (!s.ejected) {
      const k = Math.min(1, 20 / d);
      s.vx += (dx / d) * 26 * dt - (dz / d) * 22 * dt * k; // suck inward + swirl
      s.vz += (dz / d) * 26 * dt + (dx / d) * 22 * dt * k;
      s.vy += 20 * dt;                                      // ripped skyward
      if (s.vy > 20) s.vy = 20;
      if (s.y > 20) {                                       // flung out the top
        s.ejected = true;
        const out = 12 + Math.random() * 8;
        s.vx = (dx / d) * -out - (dz / d) * out * 0.5;
        s.vz = (dz / d) * -out + (dx / d) * out * 0.5;
        s.vy = 6;
      }
    } else {
      s.vy -= 18 * dt; s.vx *= 0.99; s.vz *= 0.99;           // gravity
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.rx += s.spinX * dt; s.ry += s.spinY * dt; s.rz += s.spinZ * dt;
    if ((s.ejected && s.y < -3) || d > 130) { s.done = true; g.visible = false; return; }
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(s.rx, s.ry, s.rz);
  });

  if (!car || driven) return null;
  const body = car.kind === 'truck'
    ? <Truck position={[0, 0, 0]} rotation={0} color={car.color} />
    : car.kind === 'golfcart'
      ? <GolfCart position={[0, 0, 0]} rotation={0} />
      : <Sedan position={[0, 0, 0]} rotation={0} color={car.color} />;
  // CROSSING MODIFICATION (see header): store-positioned -> never static-batch.
  return <group ref={ref} userData={{ crossingNoBatch: true }}>{body}</group>;
}

export function HousePropsRenderer({ config, lot, data }: HousePropsRendererProps) {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  // Curb props (hoop, bins, ball, mailbox) sit at the real curved sidewalk edge,
  // which the bulb curve + the hero's radiusOffset push further out than the flat
  // front-yard depth. (Straight houses fall back to the flat depth.)
  const sidewalkZ = -halfD - frontStripReach(config.position, lot.housePivot, lot.houseYaw, halfD, garageCenterX, LOT_FRONT_RADIUS);
  const driveZCenter = -halfD - 4; // truck parked near the garage end of the driveway
  const backyardZ = halfD + 6;

  // Compute world positions for physics-driven props (cat, ball, sprinkler).
  const ballSide = config.garageOnLeft ? 1 : -1;
  const ballLocal: [number, number, number] = [
    garageCenterX + ballSide * (GARAGE_W / 2 + 1.2),
    0,
    sidewalkZ + 0.5,
  ];
  const catLocal: [number, number, number] = [
    config.garageOnLeft ? halfW - 3 : -halfW + 3,
    0,
    -halfD - 5.5,
  ];
  const sprinklerLocal: [number, number, number] = [0, 0, halfD + 9];

  // Register hoop rim + bike spots (world coords) for the free-roam play layer.
  useEffect(() => {
    const pivot = lot.housePivot;
    const yaw = lot.houseYaw;
    if (data.tags.has('hoop')) {
      const hoopX = garageCenterX + ballSide * (GARAGE_W / 2 + 0.6);
      const hoopZ = sidewalkZ - 0.4;
      // Hoop is drawn with rotation=Math.PI, so its local rim (0,2.85,0.65)
      // sits at house-local (hoopX, 2.85, hoopZ-0.65).
      const rim = toWorld(hoopX, 2.85, hoopZ - 0.65, pivot, yaw);
      // Scoring radius: generous enough for the kids when aimed, tight enough
      // that a bad-angle / long shot actually clanks.
      usePlayStore.getState().registerHoop(config.address, { x: rim[0], z: rim[2], rimY: rim[1], rimR: 0.42 });
    }
    if (data.tags.has('bike')) {
      const bx = garageCenterX - (config.garageOnLeft ? 1.6 : -1.6);
      const w = toWorld(bx, 0, -halfD - 1.6, pivot, yaw);
      usePlayStore.getState().registerBike({ id: `${config.address}-bike`, x: w[0], z: w[2], color: '#3a6db0' });
    }
    if (data.tags.has('kidsBikes')) {
      const a = toWorld(garageCenterX - 1.5, 0, -halfD - 1.4, pivot, yaw);
      const b = toWorld(garageCenterX - 0.4, 0, -halfD - 1.6, pivot, yaw);
      usePlayStore.getState().registerBike({ id: `${config.address}-kbike-0`, x: a[0], z: a[2], color: '#e26aa1' });
      usePlayStore.getState().registerBike({ id: `${config.address}-kbike-1`, x: b[0], z: b[2], color: '#5cb85c' });
    }
    // Register the parked car (truck/sedan) so the player can hop in and drive it.
    const carKind: 'truck' | 'sedan' | null = data.tags.has('truck') ? 'truck' : (data.tags.has('sedan') ? 'sedan' : null);
    if (carKind) {
      const w = toWorld(garageCenterX, 0, driveZCenter, pivot, yaw);
      usePlayStore.getState().registerCar({
        id: `${config.address}-car`,
        x: w[0], z: w[2],
        color: data.vehicleColor ?? '#3f72c4',
        kind: carKind,
        yaw: yaw + Math.PI,
      });
    }
  }, [config.address, config.garageOnLeft, garageCenterX, ballSide, sidewalkZ, halfD, driveZCenter, lot, data]);

  return (
    <>
      {/* House-local group: all decoration that should rotate with the house. */}
      <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
        {data.tags.has('hoop') && (
          <BasketballHoop
            position={[
              garageCenterX + ballSide * (GARAGE_W / 2 + 0.6),
              0,
              sidewalkZ - 0.4,
            ]}
            rotation={Math.PI}
          />
        )}

        {data.tags.has('bins') && (
          <TrashBins
            position={[
              (config.garageOnLeft ? halfW - 1.8 : -halfW + 1.8) * 0.7,
              0,
              sidewalkZ - 0.5,
            ]}
          />
        )}

        {data.tags.has('gardenBed') && (
          <GardenBed
            position={[
              config.garageOnLeft ? halfW - 2.5 : -halfW + 2.5,
              0,
              -halfD - 0.6,
            ]}
          />
        )}

        {data.tags.has('hose') && (
          <Hose
            position={[
              config.garageOnLeft ? -halfW + 0.3 : halfW - 0.3,
              0,
              0,
            ]}
            rotation={config.garageOnLeft ? Math.PI / 2 : -Math.PI / 2}
          />
        )}

        {data.tags.has('bike') && (
          <Bike
            id={`${config.address}-bike`}
            position={[
              garageCenterX - (config.garageOnLeft ? 1.6 : -1.6),
              0,
              -halfD - 1.6,
            ]}
            rotation={-Math.PI / 2}
            color="#3a6db0"
          />
        )}

        {data.tags.has('kidsBikes') && (
          <>
            <Bike
              id={`${config.address}-kbike-0`}
              position={[garageCenterX - 1.5, 0, -halfD - 1.4]}
              rotation={-Math.PI / 2.5}
              color="#e26aa1"
              scale={0.78}
            />
            <Bike
              id={`${config.address}-kbike-1`}
              position={[garageCenterX - 0.4, 0, -halfD - 1.6]}
              rotation={-Math.PI / 2 + 0.4}
              color="#5cb85c"
              scale={0.7}
            />
          </>
        )}

        {data.tags.has('patio') && (
          <>
            <PatioSet position={[1.5, 0, backyardZ]} />
            <BBQGrill position={[-2.0, 0, backyardZ + 1.5]} rotation={-Math.PI / 4} />
          </>
        )}

        {data.tags.has('flagpole') && (
          <Flagpole
            position={[
              config.garageOnLeft ? -halfW - 1.0 : halfW + 1.0,
              0,
              -halfD - 4.0,
            ]}
            flag="tx"
          />
        )}
      </group>

      {/* World-space sibling group for physics-driven / player-aware props. */}
      {/* Parked car lives in world space so it stays where the last driver left it. */}
      {(data.tags.has('truck') || data.tags.has('sedan')) && (
        <ParkedCar carId={`${config.address}-car`} />
      )}
      {/* A few basketballs in the driveway so the whole family can play together. */}
      {data.tags.has('hoop') && [
        [ballLocal[0], 0, ballLocal[2]],
        [ballLocal[0] + 1.3, 0, ballLocal[2] + 0.5],
        [ballLocal[0] - 0.7, 0, ballLocal[2] + 1.0],
      ].map((bl, i) => (
        <Basketball
          key={i}
          id={`${config.address}-ball-${i}`}
          position={toWorld(bl[0], bl[1], bl[2], lot.housePivot, lot.houseYaw)}
        />
      ))}
      {config.isHero && (
        <Cat
          position={toWorld(catLocal[0], catLocal[1], catLocal[2], lot.housePivot, lot.houseYaw)}
          rotation={lot.houseYaw + Math.PI / 4}
        />
      )}
      {data.tags.has('hose') && (
        <Sprinkler position={toWorld(sprinklerLocal[0], sprinklerLocal[1], sprinklerLocal[2], lot.housePivot, lot.houseYaw)} />
      )}
    </>
  );
}
