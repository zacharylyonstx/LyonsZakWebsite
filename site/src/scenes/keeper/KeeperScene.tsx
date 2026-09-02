// Scene 7 — THE KEEPER. The final scene and the film's cadence: the
// hand-built TEXAS sign at dusk (depth mesh — the film's best pure light),
// the candle-lit plaque for Luke as a small glowing object in the dark
// (video texture) with Penny's keepsake box deeper in the frame, Zak's own
// day one → now finale pair, and then the signature — the end card
// (KeeperEndCard below), real DOM that holds the page's terminal frame.
//
// THE ONE SIGNED WALL-CLOCK EXCEPTION IN THIS SCENE: the plaque's playing
// <video> element (muted, looped, no audio track at all — none existed in
// the source and -an strips defensively at derive time). This is the
// film's SECOND such exception, THE WEIRD ONES's TV being the first — the
// same pattern exactly: qa.mjs tsweep --pinvideo pins every such element
// to a fixed decoded frame before captures (and sets
// crossingDebug.videosPinned so the per-frame resume below stands down —
// the v1 desksweep's deskVideoPinned precedent). Every OTHER pixel this
// scene draws is a pure function of (journey t, viewport).
//
// prefers-reduced-motion governs the plaque's content motion too (the TV
// precedent): under reducedMotion the plaque shows a real still from the
// same prepared loop through the IDENTICAL panel material — never the
// playing video.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { makeDepthMesh } from '../../crossing/makeDepthMesh';
import { patchKeeperMaterial } from './patchKeeperMaterial';
import {
  glowTexture,
  loadPanelTexture,
  makePanelMaterial,
  type PanelMaterialHandle,
} from '../builder/panelMaterial';
import { makeTvVideoElement, makeTvVideoTexture } from '../weird/tvMaterial';
import { WEIRD_END } from '../weird/weirdRig';
import { shouldRevealPostscript } from './endCardEasterEgg';
import {
  FEATHER,
  FOV_DEG,
  KEEPER_END,
  PLAQUE_FEATHER,
  REST_Z,
  cameraPose,
  carryMix,
  carryMix2,
  endCardOpacity,
  keeperPanelLayout,
  keeperPanelOpacity,
  sceneActive,
  signLayout,
  signOpacity,
} from './keeperRig';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';

export { KEEPER_END };

const SIGN_PHOTO_URL = '/assets/keeper/sign.jpg';
const SIGN_DEPTH_URL = '/assets/keeper/sign-depth.png';
const PLAQUE_VIDEO_URL = '/assets/keeper/plaque-loop.mp4';
const PLAQUE_STATIC_URL = '/assets/keeper/plaque-static.jpg';
const PENNY_URL = '/assets/keeper/penny.jpg';
/** The finale triptych (2026-09-01): day one (2017) → Penny → Luke. */
const DAYONE_URL = '/assets/keeper/dayone.jpg';
const NOW_PENNY_URL = '/assets/keeper/now-penny.jpg';
const NOW_LUKE_URL = '/assets/keeper/now-luke.jpg';

/** Mesh grid resolution (longer side) — the dad/drummer choice. */
const SEGMENTS_RES = 320;

interface SignAssets {
  photo: THREE.Texture;
  depth: THREE.Texture;
}

let signPromise: Promise<SignAssets> | null = null;

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

function loadSignAssets(): Promise<SignAssets> {
  if (!signPromise) {
    signPromise = Promise.all([loadTexture(SIGN_PHOTO_URL), loadTexture(SIGN_DEPTH_URL)]).then(
      ([photo, depth]) => {
        // Raw bytes in, raw bytes out — the proven pipeline every depth
        // mesh in this film uses.
        for (const tex of [photo, depth]) {
          tex.colorSpace = THREE.NoColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
        }
        return { photo, depth };
      },
    );
  }
  return signPromise;
}

interface PanelRig {
  mesh: THREE.Mesh;
  handle: PanelMaterialHandle;
}

function buildPanelRig(
  tex: THREE.Texture,
  feather: { left: number; right: number; top: number; bottom: number },
): PanelRig {
  // rim 0 — THE WEIRD ONES's photo-panel convention: these are lit objects
  // melting into dusk, not UI screens needing a silhouette catch-light.
  const handle = makePanelMaterial(tex, feather, 0);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
  return { mesh, handle };
}

function disposePanelRig(rig: PanelRig): void {
  rig.mesh.geometry.dispose();
  rig.handle.material.dispose();
}

interface PlaqueRig extends PanelRig {
  /** Set only in the live (non-reducedMotion) edition. */
  video: HTMLVideoElement | null;
  texture: THREE.Texture;
}

/** The plaque rig for the CURRENT edition — static still under
 *  reducedMotion, playing video otherwise; both through the identical
 *  panel material (texture-agnostic uMap, the TV-rig pattern exactly). */
async function buildPlaqueRig(maxAniso: number, reducedMotion: boolean): Promise<PlaqueRig> {
  if (reducedMotion) {
    const tex = await loadPanelTexture(PLAQUE_STATIC_URL, maxAniso);
    return { ...buildPanelRig(tex, PLAQUE_FEATHER), video: null, texture: tex };
  }
  const video = makeTvVideoElement(PLAQUE_VIDEO_URL);
  const texture = makeTvVideoTexture(video);
  const rig = buildPanelRig(texture, PLAQUE_FEATHER);
  // Muted, silent-source, loop — no audio track exists to ever unmute (the
  // no-autoplay-with-sound law holds by construction).
  void video.play().catch(() => {});
  return { ...rig, video, texture };
}

function disposePlaqueRig(rig: PlaqueRig): void {
  disposePanelRig(rig);
  rig.texture.dispose();
  if (rig.video) {
    rig.video.pause();
    rig.video.removeAttribute('src');
    rig.video.load();
    rig.video.remove();
  }
}

/** The WebGL half — mounts inside App's main Canvas as the LAST scene
 *  sibling, so THE KEEPER's camera writes take priority the instant its
 *  sceneActive range opens (the standing mount-order pattern). */
export function KeeperPhotos({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const { gl } = useThree();
  const [sign, setSign] = useState<SignAssets | null>(null);
  const [pennyTex, setPennyTex] = useState<THREE.Texture | null>(null);
  const [plaqueRig, setPlaqueRig] = useState<PlaqueRig | null>(null);

  useEffect(() => {
    let alive = true;
    loadSignAssets().then((a) => {
      if (alive) setSign(a);
    });
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    loadPanelTexture(PENNY_URL, maxAniso).then((tex) => {
      if (alive) setPennyTex(tex);
    });
    return () => {
      alive = false;
    };
  }, [gl]);

  // Beat-3 textures per edition (delight item 3): the live edition carries
  // the aligned carry pair (then->now crossfade); reducedMotion keeps Zak's
  // own composed diptych, exactly as before. Rebuilt when the preference
  // flips (the plaque-rig precedent).
  const [carryTex, setCarryTex] = useState<{
    then: THREE.Texture;
    now: THREE.Texture;
    now2: THREE.Texture;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    Promise.all([
      loadPanelTexture(DAYONE_URL, maxAniso),
      loadPanelTexture(NOW_PENNY_URL, maxAniso),
      loadPanelTexture(NOW_LUKE_URL, maxAniso),
    ]).then(([then_, now, now2]) => {
      if (alive) setCarryTex({ then: then_, now, now2 });
    });
    return () => {
      alive = false;
    };
  }, [gl]);

  // Rebuilt whenever reducedMotion flips (the TV-rig precedent) so the
  // plaque always shows the edition its CURRENT motion preference calls for.
  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    let built: PlaqueRig | null = null;
    buildPlaqueRig(maxAniso, reducedMotion).then((rig) => {
      if (!alive) {
        disposePlaqueRig(rig);
        return;
      }
      built = rig;
      setPlaqueRig(rig);
    });
    return () => {
      alive = false;
      if (built) disposePlaqueRig(built);
    };
  }, [gl, reducedMotion]);

  const signRig = useMemo(() => {
    if (!sign) return null;
    const mesh = makeDepthMesh(sign.photo, sign.depth, { segments: SEGMENTS_RES });
    const uniforms = patchKeeperMaterial(mesh);
    // Displacement rays emanate from the pose the live camera actually
    // arrives at as THE KEEPER opens (the dad-scene convention).
    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uDisplaceOrigin.value.set(WEIRD_END.x, WEIRD_END.y, WEIRD_END.z);
    return { mesh, uniforms };
  }, [sign]);

  useEffect(() => {
    if (!signRig) return;
    return () => {
      signRig.mesh.geometry.dispose();
      (signRig.mesh.material as THREE.Material).dispose();
    };
  }, [signRig]);

  const pennyRig = useMemo(() => (pennyTex ? buildPanelRig(pennyTex, FEATHER) : null), [pennyTex]);
  /** The live edition's carry pair — THEN beneath, NOW above at a hair less
   *  depth so three.js's own transparent sort always draws it second; the
   *  crossfade is NOW's opacity (carryMix x the beat's shared window). */
  const carryRigs = useMemo(
    () =>
      carryTex
        ? {
            then: buildPanelRig(carryTex.then, FEATHER),
            now: buildPanelRig(carryTex.now, FEATHER),
            now2: buildPanelRig(carryTex.now2, FEATHER),
          }
        : null,
    [carryTex],
  );

  useEffect(() => {
    return () => {
      if (pennyRig) disposePanelRig(pennyRig);
    };
  }, [pennyRig]);
  useEffect(() => {
    return () => {
      if (carryRigs) {
        disposePanelRig(carryRigs.then);
        disposePanelRig(carryRigs.now);
        disposePanelRig(carryRigs.now2);
      }
    };
  }, [carryRigs]);

  // Candle warmth: the shared amber glow behind the plaque — "a lit object
  // in the dusk," the MF-1/record reasoning, at candle strength.
  const glow = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    );
    mesh.renderOrder = 1;
    return mesh;
  }, []);

  useEffect(() => {
    return () => {
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
    };
  }, [glow]);

  useFrame(({ camera, size }) => {
    const t = timeline.value();

    if (!sceneActive(t)) {
      if (signRig) signRig.mesh.visible = false;
      if (plaqueRig) plaqueRig.mesh.visible = false;
      if (pennyRig) pennyRig.mesh.visible = false;
      if (carryRigs) {
        carryRigs.then.mesh.visible = false;
        carryRigs.now.mesh.visible = false;
        carryRigs.now2.mesh.visible = false;
      }
      glow.visible = false;
      return;
    }

    const pose = cameraPose(t, reducedMotion);
    camera.position.set(pose.x, pose.y, pose.z);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const pc = camera as THREE.PerspectiveCamera;
      if (pc.fov !== FOV_DEG) {
        pc.fov = FOV_DEG;
        pc.updateProjectionMatrix();
      }
    }

    if (signRig) {
      signRig.mesh.visible = true;
      const lay = signLayout(size.width, size.height);
      signRig.mesh.scale.setScalar(lay.meshScale);
      signRig.mesh.position.set(lay.meshX, lay.meshY, 0);
      signRig.uniforms.uOpacity.value = signOpacity(t);
      (signRig.mesh.material as THREE.ShaderMaterial).uniforms.uDepthScale.value =
        lay.depthScale;
    }

    if (plaqueRig) {
      plaqueRig.mesh.visible = true;
      const lay = keeperPanelLayout('plaque', size.width, size.height);
      plaqueRig.mesh.scale.set(lay.width, lay.height, 1);
      plaqueRig.mesh.position.set(lay.x, lay.y, lay.z);
      plaqueRig.mesh.rotation.y = lay.rotY;
      const op = keeperPanelOpacity('plaque', t);
      plaqueRig.handle.setOpacity(op);
      if (
        plaqueRig.video &&
        plaqueRig.video.paused &&
        op > 0.0005 &&
        (window as unknown as { crossingDebug?: { videosPinned?: boolean } }).crossingDebug
          ?.videosPinned !== true
      ) {
        // Cheap idempotent re-attempt for the metadata-load race (the TV
        // precedent) — standing down while the QA driver has the film's
        // videos pinned (the desksweep deskVideoPinned precedent).
        void plaqueRig.video.play().catch(() => {});
      }

      glow.visible = op > 0.0005;
      if (glow.visible) {
        glow.position.set(lay.x, lay.y, lay.z - 0.06);
        glow.scale.set(lay.width * 1.6, lay.height * 1.2, 1);
        (glow.material as THREE.MeshBasicMaterial).opacity = op * 0.2;
      }
    }

    if (pennyRig) {
      pennyRig.mesh.visible = true;
      const lay = keeperPanelLayout('penny', size.width, size.height);
      pennyRig.mesh.scale.set(lay.width, lay.height, 1);
      pennyRig.mesh.position.set(lay.x, lay.y, lay.z);
      pennyRig.mesh.rotation.y = lay.rotY;
      pennyRig.handle.setOpacity(keeperPanelOpacity('penny', t));
    }

    if (carryRigs) {
      const lay = keeperPanelLayout('carry', size.width, size.height);
      const windowOp = keeperPanelOpacity('carry', t);
      const mix = carryMix(t);
      const mix2 = carryMix2(t);
      for (const [rig, z, op] of [
        [carryRigs.then, lay.z, windowOp],
        [carryRigs.now, lay.z + 0.002, windowOp * mix],
        [carryRigs.now2, lay.z + 0.004, windowOp * mix2],
      ] as const) {
        rig.mesh.visible = op > 0.0005;
        rig.mesh.scale.set(lay.width, lay.height, 1);
        rig.mesh.position.set(lay.x, lay.y, z);
        rig.mesh.rotation.y = lay.rotY;
        rig.handle.setOpacity(op);
      }
    }
  });

  return (
    <>
      {signRig && <primitive object={signRig.mesh} />}
      {pennyRig && <primitive object={pennyRig.mesh} />}
      <primitive object={glow} />
      {plaqueRig && <primitive object={plaqueRig.mesh} />}
      {carryRigs && <primitive object={carryRigs.then.mesh} />}
      {carryRigs && <primitive object={carryRigs.now.mesh} />}
      {carryRigs && <primitive object={carryRigs.now2.mesh} />}
    </>
  );
}

/**
 * THE SIGNATURE — the film's last card, real DOM: one final return of the
 * display type, the amber rule, and the contact block. Mounted
 * unconditionally (identical in the full, reducedMotion, and no-WebGL
 * editions — the brief's own law); its ONLY animation input is
 * endCardOpacity(t), written per frame with no CSS transition (the byte
 * law). Below the visible threshold the whole card goes visibility:hidden,
 * which also removes its links from the tab order and the a11y tree — the
 * card exists only once the film has actually arrived at it.
 *
 * NO footer styling, no copyright line, no icon row — set like the last
 * card of a film, left-aligned at the same measure the opening title used
 * (the bookend).
 *
 * THE POSTSCRIPT EASTER EGG (ship-pass item 2c) — the promise in "there's
 * more hidden in here" made literally true: after POSTSCRIPT_CLICK_
 * THRESHOLD clicks anywhere on the card, a tiny mono line fades in naming
 * what's actually findable. A real click handler on the whole `<section>`
 * catches a mouse/touch tap ANYWHERE on the card (including on a link —
 * the link still navigates; the click still counts on its way there); the
 * section is ALSO independently focusable/keydown-activatable (Enter or
 * Space) so a keyboard visitor has a dedicated way to trigger it without
 * needing to leave the page via a real link first.
 */
export function KeeperEndCard({ timeline }: { timeline: ScrollTimeline | null }) {
  const cardRef = useRef<HTMLElement>(null);
  const [clicks, setClicks] = useState(0);
  const revealed = shouldRevealPostscript(clicks);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = cardRef.current;
      if (!el) return;
      const opacity = endCardOpacity(value);
      el.style.opacity = opacity.toFixed(4);
      el.style.visibility = opacity > 0.001 ? 'visible' : 'hidden';
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  const bumpClicks = () => setClicks((c) => c + 1);

  return (
    <section
      ref={cardRef}
      className="end-card"
      aria-label="That's me — contact"
      tabIndex={0}
      onClick={bumpClicks}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.key === ' ') e.preventDefault(); // the page is already at its end — nothing to scroll
          bumpClicks();
        }
      }}
    >
      <div className="end-card-inner">
        {/* ILLUSTRATIVE copy (CLAUDE.md law) — placement and register are
            the deliverable; the shipped words await Zak's own pass. */}
        <p className="end-display">That&rsquo;s me &mdash; some of it.</p>
        <p className="end-voice">There&rsquo;s more hidden in here.</p>
        {/* Honest only if true (the brief's own law): the cat is the
            Scene-4 porch delight (PorchLife.tsx — "discovered, not pointed
            at"), the drum is DrumHitEgg, the sign is SignGlowEgg — three
            real findable things this exact ship pass can account for. The
            two pockets (the RTC invite glint in THE NEIGHBORHOOD, the
            alien-prank glint in THE WEIRD ONES) are the honest "still
            more" this line doesn't spoil. role="status" — a real reveal a
            screen reader should hear, not decoration. */}
        {revealed && (
          <p className="end-postscript" role="status">
            found: the cat, the drum, the sign. there&rsquo;s still more. &mdash; z
          </p>
        )}
        <hr className="end-rule" aria-hidden="true" />
        <ul className="end-contact">
          <li>
            <a href="mailto:zacharylyonstx@gmail.com">zacharylyonstx@gmail.com</a>
          </li>
          <li>
            <a href="https://github.com/zacharylyonstx">github.com/zacharylyonstx</a>
          </li>
          <li>
            <a href="https://linkedin.com/in/zacharylyonstx">linkedin.com/in/zacharylyonstx</a>
          </li>
        </ul>
        <p className="end-lane">
          <a href="/resume">Resume</a>
          <span aria-hidden="true"> · </span>
          <a href="/experience">Experience</a>
          <span aria-hidden="true"> · </span>
          <a href="/projects">Projects</a>
          <span aria-hidden="true"> · </span>
          <a href="/contact">Contact</a>
        </p>
      </div>
    </section>
  );
}

/** No-WebGL branch (the reducedMotion "plaque shows a still" law rides the
 *  same static asset). Real, descriptive alt text throughout — these
 *  objects ARE the scene's content (the dad/band/weird precedent). The end
 *  card is NOT duplicated here — KeeperEndCard is already unconditional. */
export function KeeperFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const signRef = useRef<HTMLImageElement>(null);
  const plaqueRef = useRef<HTMLImageElement>(null);
  const pennyRef = useRef<HTMLImageElement>(null);
  const dayoneRef = useRef<HTMLImageElement>(null);
  const nowRef = useRef<HTMLImageElement>(null);
  const now2Ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const place = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sLay = signLayout(w, h);
      if (signRef.current) {
        signRef.current.style.left = `${sLay.rect.left.toFixed(1)}px`;
        signRef.current.style.top = `${sLay.rect.top.toFixed(1)}px`;
        signRef.current.style.width = `${sLay.rect.width.toFixed(1)}px`;
        signRef.current.style.height = `${sLay.rect.height.toFixed(1)}px`;
      }
      // Panels: world layout re-projected through the shared REST camera
      // (the WeirdFallback convention exactly).
      const placePanel = (
        el: HTMLImageElement | null,
        id: 'plaque' | 'penny' | 'carry',
      ) => {
        if (!el) return;
        const lay = keeperPanelLayout(id, w, h);
        const wpp = (2 * (REST_Z - lay.z) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
        el.style.left = `${(w / 2 + (lay.x - lay.width / 2) / wpp).toFixed(1)}px`;
        el.style.top = `${(h / 2 - (lay.y + lay.height / 2) / wpp).toFixed(1)}px`;
        el.style.width = `${(lay.width / wpp).toFixed(1)}px`;
        el.style.height = `${(lay.height / wpp).toFixed(1)}px`;
      };
      placePanel(plaqueRef.current, 'plaque');
      placePanel(pennyRef.current, 'penny');
      placePanel(dayoneRef.current, 'carry');
      placePanel(nowRef.current, 'carry');
      placePanel(now2Ref.current, 'carry');
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (signRef.current) signRef.current.style.opacity = signOpacity(value).toFixed(4);
      if (plaqueRef.current)
        plaqueRef.current.style.opacity = keeperPanelOpacity('plaque', value).toFixed(4);
      if (pennyRef.current)
        pennyRef.current.style.opacity = keeperPanelOpacity('penny', value).toFixed(4);
      // The finale crossfade by the same math as the live edition: DAY ONE
      // holds the beat window, NOW rides carryMix above it.
      const windowOp = keeperPanelOpacity('carry', value);
      if (dayoneRef.current) dayoneRef.current.style.opacity = windowOp.toFixed(4);
      if (nowRef.current) nowRef.current.style.opacity = (windowOp * carryMix(value)).toFixed(4);
      if (now2Ref.current) now2Ref.current.style.opacity = (windowOp * carryMix2(value)).toFixed(4);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="stage keeper-fallback">
      <img
        ref={signRef}
        src="/assets/keeper/sign-feathered.webp"
        alt="A hand-built TEXAS sign glowing at dusk in a garden — carved lettering lit from within, a scale model of the UT tower with lit windows and an orange longhorn cutout behind it, string lights strung through a bare tree overhead."
        draggable={false}
      />
      <img
        ref={pennyRef}
        src="/assets/keeper/penny-feathered.webp"
        alt="A hand-built wooden keepsake box for Penny, its lid open to a wood-burned note — 'You shine with beauty. You lead with kindness. You think with courage. I'll always believe in you. I love you forever. — Dad' — photographed on Zak's desk beside his mouse."
        draggable={false}
      />
      <img
        ref={plaqueRef}
        src="/assets/keeper/plaque-feathered.webp"
        alt="A hand-carved wooden plaque for Luke, lit only by a flickering flame at its center — 'You are strong in spirit. You lead with courage. You stand for what is right. Your fire will light the way. I will always believe in you. I love you forever. — Dad.'"
        draggable={false}
      />
      <img
        ref={dayoneRef}
        src="/assets/keeper/dayone-feathered.webp"
        alt="Day one, 2017: Zak in a surgical cap and gown in the delivery room, looking down at newborn Penny asleep in his arms, swaddled in a striped hospital blanket and a pink-and-blue knit cap."
        draggable={false}
      />
      <img
        ref={nowRef}
        src="/assets/keeper/now-penny-feathered.webp"
        alt="Now: Penny, in a mustard velvet dress and a cowboy hat, riding on Zak's shoulders with her arms flung out wide like wings, both of them grinning, under a grove of live oaks."
        draggable={false}
      />
      <img
        ref={now2Ref}
        src="/assets/keeper/now-luke-feathered.webp"
        alt="And Luke, in the same cowboy hat and an orange henley, laughing open-mouthed on Zak's shoulders in the same grove, Zak looking up at him."
        draggable={false}
      />
    </div>
  );
}
