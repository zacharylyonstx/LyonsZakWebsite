// Scene 6 — THE WEIRD ONES. The model-break beat: two flat panels (MF-1 the
// PCB macro, primary/near; the CenTex banner selfie, secondary/far — no
// depth mesh exists for either, so this reuses THE BUILDER/THE BAND's own
// "stills + parallax" physics verbatim) followed by a single TV object
// (tvMaterial.ts's own bezel+screen shader) playing Zak's fabricated EAS
// broadcast.
//
// THE ONE SIGNED WALL-CLOCK EXCEPTION IN THIS SCENE: the TV's own playing
// <video> element (muted, looped, no audio track at all — stripped at
// prepare time). Every OTHER pixel this scene draws — the bezel, the
// scanline/vignette shader math, both panels, the museum label, the
// discovery glint — is a pure function of (journey t, viewport). This
// mirrors the v1 archive's own desksweep.mjs precedent for a monitor video:
// pin/exclude the ONE decoding element from a byte-determinism sweep,
// verify everything else is untouched. See scene6-report.md for the exact
// tsweep exclusion.
//
// prefers-reduced-motion ALSO governs the TV's own content motion here (a
// first for this film — every prior scene's reducedMotion only pinned the
// CAMERA, because no prior scene had actual video content to begin with):
// under reducedMotion, the TV shows the broadcast's own opening frame as a
// plain static texture through the SAME shader, never the playing video —
// ordinary prefers-reduced-motion practice, and the brief's own law.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  glowTexture as ambientGlowTexture,
  loadPanelTexture,
  makePanelMaterial,
  type PanelFeather,
  type PanelMaterialHandle,
} from '../builder/panelMaterial';
import {
  coolGlowTexture,
  makeTvMaterial,
  makeTvVideoElement,
  makeTvVideoTexture,
  type TvMaterialHandle,
} from './tvMaterial';
import {
  FEATHER,
  FOV_DEG,
  REST_Z,
  SCREEN_MARGIN,
  WEIRD_END,
  cameraPose,
  mf1CaptionAnchor,
  projectPoint,
  sceneActive,
  tvGlintOpacity,
  tvLayout,
  tvOpacity,
  weirdGlintAt,
  weirdPanelLayout,
  weirdPanelOpacity,
} from './weirdRig';
import { AlienPrankPocket } from '../../pockets/AlienPrankPocket';
import type { PocketHandle } from '../../pockets/Pocket';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';

export { WEIRD_END };

const MF1_URL = '/assets/weird/mf1.jpg';
const BANNER_URL = '/assets/weird/banner.jpg';
const EAS_VIDEO_URL = '/assets/weird/eas-broadcast.mp4';
const EAS_STATIC_URL = '/assets/weird/eas-static.jpg';

const MF1_LABEL = 'MF-1 — CENTEX PARANORMAL, 2015';

interface FlatRig {
  mesh: THREE.Mesh;
  handle: PanelMaterialHandle;
}

function buildFlatRig(tex: THREE.Texture, feather: PanelFeather, rim: number): FlatRig {
  const handle = makePanelMaterial(tex, feather, rim);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
  return { mesh, handle };
}

function disposeFlatRig(rig: FlatRig): void {
  rig.mesh.geometry.dispose();
  rig.handle.material.dispose();
}

interface TvRig {
  mesh: THREE.Mesh;
  handle: TvMaterialHandle;
  /** Set only in the live (non-reducedMotion) edition — owns play()/pause()
   *  and is torn down on unmount/edition switch. */
  video: HTMLVideoElement | null;
  texture: THREE.Texture;
}

/** Builds the TV rig for the CURRENT edition. Static under reducedMotion
 *  (a plain loaded image, THE BUILDER's own loadPanelTexture, through the
 *  identical shader) — playing video otherwise. Texture-agnostic by design
 *  (tvMaterial.ts's own header): the two editions differ only in which
 *  Texture is bound to `uMap`. */
async function buildTvRig(maxAniso: number, reducedMotion: boolean): Promise<TvRig> {
  if (reducedMotion) {
    const tex = await loadPanelTexture(EAS_STATIC_URL, maxAniso);
    const handle = makeTvMaterial(tex, SCREEN_MARGIN);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
    return { mesh, handle, video: null, texture: tex };
  }
  const video = makeTvVideoElement(EAS_VIDEO_URL);
  const texture = makeTvVideoTexture(video);
  const handle = makeTvMaterial(texture, SCREEN_MARGIN);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
  // Muted, silent-source, loop — never gated on a user gesture (no audio to
  // violate the no-autoplay-with-sound law even in principle; see
  // tvMaterial.ts's header). Fails quiet, exactly the record/desk-video
  // precedent, if a browser ever declines anyway.
  void video.play().catch(() => {});
  return { mesh, handle, video, texture };
}

function disposeTvRig(rig: TvRig): void {
  rig.mesh.geometry.dispose();
  rig.handle.material.dispose();
  rig.texture.dispose();
  if (rig.video) {
    rig.video.pause();
    rig.video.removeAttribute('src');
    rig.video.load();
    rig.video.remove();
  }
}

/** The WebGL half — mounts inside App's main Canvas, as a LATER sibling of
 *  BandPhotos so THE WEIRD ONES's own camera writes take priority the
 *  instant its sceneActive range opens (the standing mount-order pattern). */
export function WeirdPanels({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const { gl } = useThree();
  const [mf1Tex, setMf1Tex] = useState<THREE.Texture | null>(null);
  const [bannerTex, setBannerTex] = useState<THREE.Texture | null>(null);
  const [tvRig, setTvRig] = useState<TvRig | null>(null);

  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    Promise.all([loadPanelTexture(MF1_URL, maxAniso), loadPanelTexture(BANNER_URL, maxAniso)]).then(
      ([mf1, banner]) => {
        if (alive) {
          setMf1Tex(mf1);
          setBannerTex(banner);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [gl]);

  // Rebuilt whenever reducedMotion flips (a live OS-setting toggle mid-
  // session is rare but real — see App.tsx's matchMedia listener) so the
  // TV always shows the edition its CURRENT motion preference calls for.
  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    let built: TvRig | null = null;
    buildTvRig(maxAniso, reducedMotion).then((rig) => {
      if (!alive) {
        disposeTvRig(rig);
        return;
      }
      built = rig;
      setTvRig(rig);
    });
    return () => {
      alive = false;
      if (built) disposeTvRig(built);
    };
  }, [gl, reducedMotion]);

  const mf1Rig = useMemo(() => (mf1Tex ? buildFlatRig(mf1Tex, FEATHER, 0) : null), [mf1Tex]);
  const bannerRig = useMemo(
    () => (bannerTex ? buildFlatRig(bannerTex, FEATHER, 0) : null),
    [bannerTex],
  );

  useEffect(() => {
    return () => {
      if (mf1Rig) disposeFlatRig(mf1Rig);
    };
  }, [mf1Rig]);
  useEffect(() => {
    return () => {
      if (bannerRig) disposeFlatRig(bannerRig);
    };
  }, [bannerRig]);

  const glow = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: coolGlowTexture(),
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

  // A faint amber ambient echo behind the MF-1 panel only — "a lit object
  // in the dusk," THE BAND's own record-glow reasoning, at an even fainter
  // alpha (a PCB's LEDs catch light; they don't backlight the whole board).
  const mf1Glow = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: ambientGlowTexture(),
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
      mf1Glow.geometry.dispose();
      (mf1Glow.material as THREE.Material).dispose();
    };
  }, [mf1Glow]);

  useFrame(({ camera, size }) => {
    const t = timeline.value();

    if (!sceneActive(t)) {
      if (mf1Rig) mf1Rig.mesh.visible = false;
      if (bannerRig) bannerRig.mesh.visible = false;
      if (tvRig) tvRig.mesh.visible = false;
      glow.visible = false;
      mf1Glow.visible = false;
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

    if (mf1Rig) {
      mf1Rig.mesh.visible = true;
      const lay = weirdPanelLayout('mf1', size.width, size.height);
      mf1Rig.mesh.scale.set(lay.width, lay.height, 1);
      mf1Rig.mesh.position.set(lay.x, lay.y, lay.z);
      mf1Rig.mesh.rotation.y = lay.rotY;
      const op = weirdPanelOpacity('mf1', t);
      mf1Rig.handle.setOpacity(op);

      mf1Glow.visible = op > 0.0005;
      if (mf1Glow.visible) {
        mf1Glow.position.set(lay.x, lay.y, lay.z - 0.05);
        mf1Glow.scale.set(lay.width * 1.15, lay.height * 1.15, 1);
        (mf1Glow.material as THREE.MeshBasicMaterial).opacity = op * 0.14;
      }
    }

    if (bannerRig) {
      bannerRig.mesh.visible = true;
      const lay = weirdPanelLayout('banner', size.width, size.height);
      bannerRig.mesh.scale.set(lay.width, lay.height, 1);
      bannerRig.mesh.position.set(lay.x, lay.y, lay.z);
      bannerRig.mesh.rotation.y = lay.rotY;
      bannerRig.handle.setOpacity(weirdPanelOpacity('banner', t));
    }

    if (tvRig) {
      tvRig.mesh.visible = true;
      const lay = tvLayout(size.width, size.height);
      tvRig.mesh.scale.set(lay.width, lay.height, 1);
      tvRig.mesh.position.set(lay.x, lay.y, lay.z);
      tvRig.mesh.rotation.y = lay.rotY;
      const op = tvOpacity(t);
      tvRig.handle.setOpacity(op);
      if (
        tvRig.video &&
        tvRig.video.paused &&
        op > 0.0005 &&
        (window as unknown as { crossingDebug?: { videosPinned?: boolean } }).crossingDebug
          ?.videosPinned !== true
      ) {
        // A second, cheap play() attempt (idempotent if already playing) —
        // covers the rare case where the first attempt above lost a race
        // with the element's own metadata load. Stands down while the QA
        // driver has the film's videos pinned (qa.mjs tsweep --pinvideo →
        // crossingDebug.videosPinned, the desksweep precedent) — before
        // Scene 7 added a second ambient loop this resume only ever held
        // still by luck (the EAS loop's pinned window is static bars).
        void tvRig.video.play().catch(() => {});
      }

      glow.visible = op > 0.0005;
      if (glow.visible) {
        glow.position.set(lay.x, lay.y, lay.z - 0.08);
        glow.scale.set(lay.width * 1.3, lay.height * 1.3, 1);
        (glow.material as THREE.MeshBasicMaterial).opacity = op * 0.3;
      }
    }
  });

  return (
    <>
      {mf1Rig && <primitive object={mf1Rig.mesh} />}
      <primitive object={mf1Glow} />
      {bannerRig && <primitive object={bannerRig.mesh} />}
      <primitive object={glow} />
      {tvRig && <primitive object={tvRig.mesh} />}
    </>
  );
}

/** The DOM half — the MF-1 museum label (THE BUILDER's own panel-caption
 *  convention exactly) tracking mf1CaptionAnchor's live projected position. */
export function WeirdLabel({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const labelRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = labelRef.current;
      if (!el) return;
      const opacity = weirdPanelOpacity('mf1', value);
      if (opacity <= 0.0005) {
        el.style.opacity = '0';
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraPose(value, reducedMotion);
      const anchor = mf1CaptionAnchor(w, h);
      const screen = projectPoint(anchor, cam, w, h);
      el.style.transform = `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0)`;
      el.style.opacity = opacity.toFixed(4);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  return (
    <p ref={labelRef} className="panel-caption" aria-hidden="true">
      {MF1_LABEL}
    </p>
  );
}

/**
 * THE DISCOVERY — the TV's own pocket glint. Mounted unconditionally
 * (BuilderCaptions/RecordAffordance's convention): one implementation for
 * the live edition AND the reducedMotion/no-WebGL edition, distinguished
 * only by which camera pose the (resize-recomputed, not per-frame-tracked
 * — weirdGlintAt's own doc comment) anchor projects through.
 */
export function WeirdDiscovery({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const pocketRef = useRef<PocketHandle>(null);
  const [glintAt, setGlintAt] = useState(() => {
    const cam = reducedMotion ? { x: 0, y: 0, z: REST_Z } : WEIRD_END;
    return weirdGlintAt(
      typeof window === 'undefined' ? 1600 : window.innerWidth,
      typeof window === 'undefined' ? 1000 : window.innerHeight,
      cam,
    );
  });

  useEffect(() => {
    const compute = () => {
      const cam = reducedMotion ? { x: 0, y: 0, z: REST_Z } : WEIRD_END;
      setGlintAt(weirdGlintAt(window.innerWidth, window.innerHeight, cam));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [reducedMotion]);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      pocketRef.current?.setGlintOpacity(tvGlintOpacity(value));
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return <AlienPrankPocket ref={pocketRef} glintAt={glintAt} timeline={timeline} />;
}

/** No-WebGL branch (also serves reducedMotion's own "TV shows a static
 *  frame" law, via the SAME static asset the live edition's reducedMotion
 *  branch loads through its shader — WeirdScene's own visual, not just its
 *  fallback, matches). Real, descriptive alt text throughout (the dad/band
 *  precedent): a real product, a real founder photo, and a real broadcast
 *  frame ARE this scene's content. */
export function WeirdFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const mf1Ref = useRef<HTMLImageElement>(null);
  const bannerRef = useRef<HTMLImageElement>(null);
  const tvRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const place = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mf1Lay = weirdPanelLayout('mf1', w, h);
      const wppMf1 = (2 * (REST_Z - mf1Lay.z) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
      if (mf1Ref.current) {
        mf1Ref.current.style.left = `${(w / 2 + (mf1Lay.x - mf1Lay.width / 2) / wppMf1).toFixed(1)}px`;
        mf1Ref.current.style.top = `${(h / 2 - (mf1Lay.y + mf1Lay.height / 2) / wppMf1).toFixed(1)}px`;
        mf1Ref.current.style.width = `${(mf1Lay.width / wppMf1).toFixed(1)}px`;
        mf1Ref.current.style.height = `${(mf1Lay.height / wppMf1).toFixed(1)}px`;
      }
      const bannerLay = weirdPanelLayout('banner', w, h);
      const wppBanner = (2 * (REST_Z - bannerLay.z) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
      if (bannerRef.current) {
        bannerRef.current.style.left =
          `${(w / 2 + (bannerLay.x - bannerLay.width / 2) / wppBanner).toFixed(1)}px`;
        bannerRef.current.style.top =
          `${(h / 2 - (bannerLay.y + bannerLay.height / 2) / wppBanner).toFixed(1)}px`;
        bannerRef.current.style.width = `${(bannerLay.width / wppBanner).toFixed(1)}px`;
        bannerRef.current.style.height = `${(bannerLay.height / wppBanner).toFixed(1)}px`;
      }
      const tvLay = tvLayout(w, h);
      const wppTv = (2 * (REST_Z - tvLay.z) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
      if (tvRef.current) {
        tvRef.current.style.left = `${(w / 2 + (tvLay.x - tvLay.width / 2) / wppTv).toFixed(1)}px`;
        tvRef.current.style.top = `${(h / 2 - (tvLay.y + tvLay.height / 2) / wppTv).toFixed(1)}px`;
        tvRef.current.style.width = `${(tvLay.width / wppTv).toFixed(1)}px`;
        tvRef.current.style.height = `${(tvLay.height / wppTv).toFixed(1)}px`;
      }
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (mf1Ref.current) mf1Ref.current.style.opacity = weirdPanelOpacity('mf1', value).toFixed(4);
      if (bannerRef.current)
        bannerRef.current.style.opacity = weirdPanelOpacity('banner', value).toFixed(4);
      if (tvRef.current) tvRef.current.style.opacity = tvOpacity(value).toFixed(4);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="stage weird-fallback">
      <img
        ref={mf1Ref}
        src="/assets/weird/mf1-feathered.webp"
        alt="A hand holds a custom green circuit board labeled MF-1: a 3-digit 7-segment display, three toggle switches, and rows of red, amber, and teal LEDs — CenTex Paranormal's own ghost-hunting hardware product, 2015."
        draggable={false}
      />
      <img
        ref={bannerRef}
        src="/assets/weird/banner-feathered.webp"
        alt="Zak, smiling, in a selfie taken directly in front of a printed CenTex Paranormal trade-show banner with a ghost-hand logo."
        draggable={false}
      />
      <img
        ref={tvRef}
        className="weird-tv-fallback"
        src={EAS_STATIC_URL}
        alt="A television screen showing SMPTE color bars under a black title card reading EMERGENCY BROADCAST SYSTEM — the opening frame of Zak's own fabricated alien-invasion broadcast."
        draggable={false}
      />
    </div>
  );
}
