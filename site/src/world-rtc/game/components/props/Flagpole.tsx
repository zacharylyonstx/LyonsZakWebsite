// VENDORED from ~/Game (branch cine-mode @ aba458e): src/components/props/Flagpole.tsx
// Copied into the a2-crossing experiment sandbox (LyonsZak.com vertical slice) — see src/vendor/game/ATTRIBUTION.md.
//
// CROSSING MODIFICATION (a2, fix round 1): the flag-wave useFrame (tilting
// flagRef by state.clock.elapsedTime) is removed. It read wall-clock time and
// was gated only by isNearPlayer(…,40) against the sandbox's FIXED player
// spawn (dad @ (-2.5,0,10) — this sandbox has no player controller, so that
// point never moves), so it animated continuously and unconditionally
// whenever a flagpole was within 40m of it — including through the whole
// departure/street-reveal region (p≈0.7–1.0). That breaks "every frame is a
// pure function of scrollY" (byte-exact scrub-reversibility is verified for
// the crossing). Same rationale as Atmosphere.tsx's clouds/motes removal.
// The flag now renders static at its authored pose.
import { useRef } from 'react';
import * as THREE from 'three';
import type { Mesh } from 'three';

interface FlagpoleProps {
  position: [number, number, number];
  height?: number;
  /** 'tx' for Texas, 'us' for American */
  flag?: 'tx' | 'us';
}

export function Flagpole({ position, height = 6, flag = 'tx' }: FlagpoleProps) {
  const flagRef = useRef<Mesh>(null);

  return (
    <group position={position}>
      {/* base */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.2, 12]} />
        <meshStandardMaterial color="#cdc6b8" roughness={0.85} />
      </mesh>
      {/* pole */}
      <mesh position={[0, height / 2 + 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, height, 10]} />
        <meshStandardMaterial color="#dcd8d0" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* finial ball */}
      <mesh position={[0, height + 0.3, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#c8a32a" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* flag */}
      <group position={[0, height - 0.3, 0]}>
        <mesh ref={flagRef} position={[1.0, 0, 0]} castShadow>
          <planeGeometry args={[2.0, 1.2]} />
          {flag === 'tx' ? <TexasFlagMaterial /> : <USFlagMaterial />}
        </mesh>
      </group>
    </group>
  );
}

function TexasFlagMaterial() {
  // Hoist (left) blue stripe with star, then white top band, red bottom band.
  // Approximated as a single emissive map via canvas.
  return <meshStandardMaterial color="white" map={makeFlagTexture('tx')} side={2} />;
}

function USFlagMaterial() {
  return <meshStandardMaterial color="white" map={makeFlagTexture('us')} side={2} />;
}

let txCache: import('three').Texture | null = null;
let usCache: import('three').Texture | null = null;

function makeFlagTexture(kind: 'tx' | 'us'): THREE.Texture {
  if (kind === 'tx' && txCache) return txCache;
  if (kind === 'us' && usCache) return usCache;
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;
  if (kind === 'tx') {
    ctx.fillStyle = '#0a3161';
    ctx.fillRect(0, 0, 67, 120);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(67, 0, 133, 60);
    ctx.fillStyle = '#bf0a30';
    ctx.fillRect(67, 60, 133, 60);
    ctx.fillStyle = '#f0f0f0';
    drawStar(ctx, 33, 60, 5, 22, 9);
  } else {
    ctx.fillStyle = '#bf0a30';
    ctx.fillRect(0, 0, 200, 120);
    for (let i = 0; i < 13; i += 2) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, (120 / 13) * i, 200, 120 / 13);
    }
    ctx.fillStyle = '#0a3161';
    ctx.fillRect(0, 0, 80, 65);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  if (kind === 'tx') txCache = tex; else usCache = tex;
  return tex;
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
