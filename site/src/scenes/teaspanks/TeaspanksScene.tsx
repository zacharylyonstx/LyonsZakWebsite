// TEASPANKS — the continuity re-cut's new chapter (2026-09-01): after THE
// BAND (the adult life) the register breaks into absurd-sweet — the music
// video Zak produced from Luke's drive-through song, with both kids in it.
//
// The frame is a 16:9 panel at world z=0 (THE BAND's gig-plane treatment)
// whose texture is a SILENT looping excerpt of the video itself (the EAS-TV
// precedent: makeTvVideoElement + VideoTexture, resumed per frame, pinned by
// the qa harness's --pinvideo). Reduced motion gets the still; no WebGL
// gets the feathered still in DOM. The museum label and the WATCH pill are
// DOM, projected through the scene camera every frame (the museum-label
// move) — the pill opens the pocket with the real video, sound on.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  loadPanelTexture,
  makePanelMaterial,
  type PanelMaterialHandle,
} from '../builder/panelMaterial';
import { makeTvVideoElement, makeTvVideoTexture } from '../weird/tvMaterial';
import {
  FEATHER,
  FOV_DEG,
  PANEL_ASPECT,
  REST_Z,
  TEASPANKS_END,
  cameraPose,
  labelAnchor,
  panelLayout,
  panelOpacity,
  pillAlign,
  pillAnchor,
  pillOpacity,
  projectPoint,
  sceneActive,
} from './teaspanksRig';
import { Pocket, type PocketHandle } from '../../pockets/Pocket';
import { PocketCard, PocketEmbed } from '../../pockets/PocketCard';
import { TEASPANKS_CONTENT } from '../../pockets/teaspanks';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';

export { TEASPANKS_END };

const STILL_URL = '/assets/teaspanks/still.jpg';
const LOOP_URL = '/assets/teaspanks/loop.mp4';

interface PanelRig {
  mesh: THREE.Mesh;
  handle: PanelMaterialHandle;
  video: HTMLVideoElement | null;
  texture: THREE.Texture;
}

async function buildPanelRig(maxAniso: number, reducedMotion: boolean): Promise<PanelRig> {
  if (reducedMotion) {
    const tex = await loadPanelTexture(STILL_URL, maxAniso);
    const handle = makePanelMaterial(tex, FEATHER, 0);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
    return { mesh, handle, video: null, texture: tex };
  }
  const video = makeTvVideoElement(LOOP_URL);
  const texture = makeTvVideoTexture(video);
  const handle = makePanelMaterial(texture, FEATHER, 0);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handle.material);
  void video.play().catch(() => {});
  return { mesh, handle, video, texture };
}

function disposePanelRig(rig: PanelRig): void {
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

/** The WebGL half — mounts inside App's main Canvas after BandPhotos and
 *  before WeirdPanels (the standing mount-order pattern: a later sibling's
 *  camera writes win the instant its segment opens). */
export function TeaspanksPanel({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const { gl } = useThree();
  const [rig, setRig] = useState<PanelRig | null>(null);

  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    let built: PanelRig | null = null;
    buildPanelRig(maxAniso, reducedMotion).then((r) => {
      if (!alive) {
        disposePanelRig(r);
        return;
      }
      built = r;
      setRig(r);
    });
    return () => {
      alive = false;
      if (built) disposePanelRig(built);
    };
  }, [gl, reducedMotion]);

  useFrame(({ camera, size }) => {
    const t = timeline.value();
    if (!sceneActive(t)) {
      if (rig) rig.mesh.visible = false;
      return;
    }
    const pose = cameraPose(t, reducedMotion);
    camera.position.set(pose.x, pose.y, pose.z);
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.fov !== undefined && pc.fov !== FOV_DEG) {
      pc.fov = FOV_DEG;
      pc.updateProjectionMatrix();
    }
    if (!rig) return;
    rig.mesh.visible = true;
    const lay = panelLayout(size.width, size.height);
    rig.mesh.scale.set(lay.meshScale, lay.meshScale / PANEL_ASPECT, 1);
    rig.mesh.position.set(lay.meshX, lay.meshY, 0);
    const op = panelOpacity(t);
    rig.handle.setOpacity(op);
    // Resume the loop whenever the frame is on screen (browsers pause
    // background media; a scrub back in must never find a frozen frame) —
    // unless the qa harness has pinned videos for a byte sweep.
    if (
      rig.video &&
      rig.video.paused &&
      op > 0.0005 &&
      (window as unknown as { crossingDebug?: { videosPinned?: boolean } }).crossingDebug
        ?.videosPinned !== true
    ) {
      void rig.video.play().catch(() => {});
    }
  });

  return rig ? <primitive object={rig.mesh} /> : null;
}

/** The museum label — DOM, projected through the scene camera. */
export function TeaspanksLabel({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = ref.current;
      if (!el) return;
      const opacity = pillOpacity(value);
      if (opacity <= 0.0005) {
        el.style.opacity = '0';
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraPose(value, reducedMotion);
      const screen = projectPoint(labelAnchor(w, h), cam, w, h);
      el.style.transform = `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0)`;
      el.style.opacity = opacity.toFixed(4);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);
  return (
    <p ref={ref} className="panel-caption" aria-hidden="true">
      <span className="caption-long">{TEASPANKS_CONTENT.label}</span>
      <span className="caption-short">{TEASPANKS_CONTENT.labelShort}</span>
    </p>
  );
}

/** The WATCH pill + its pocket (the real video, sound on). Mounted
 *  unconditionally (App.tsx) like every other DOM affordance; the pocket's
 *  own glint stays off-screen — the pill is its control. */
export function TeaspanksDiscovery({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const pillRef = useRef<HTMLButtonElement>(null);
  const pocketRef = useRef<PocketHandle>(null);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = pillRef.current;
      if (!el) return;
      const opacity = pillOpacity(value);
      const inert = opacity <= 0.05;
      el.style.opacity = opacity.toFixed(4);
      el.style.pointerEvents = inert ? 'none' : 'auto';
      el.tabIndex = inert ? -1 : 0;
      el.setAttribute('aria-hidden', inert ? 'true' : 'false');
      if (opacity <= 0.0005) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraPose(value, reducedMotion);
      const screen = projectPoint(pillAnchor(w, h), cam, w, h);
      el.style.left = `${screen.x.toFixed(1)}px`;
      el.style.top = `${screen.y.toFixed(1)}px`;
      el.style.transform =
        pillAlign(w, h) === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)';
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className="film-pill teaspanks-watch"
        aria-label={TEASPANKS_CONTENT.ariaLabel}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => pocketRef.current?.open()}
      >
        <span className="film-pill-row">
          <span className="film-pill-icon" aria-hidden="true">
            ▶
          </span>
          <span className="film-pill-label">{TEASPANKS_CONTENT.pillLabel}</span>
        </span>
        <span className="film-pill-sub">{TEASPANKS_CONTENT.pillSub}</span>
      </button>
      <Pocket
        ref={pocketRef}
        id="teaspanks"
        glintAt={{ x: -1, y: -1 }}
        label={TEASPANKS_CONTENT.ariaLabel}
        timeline={timeline}
      >
        <PocketCard
          title={TEASPANKS_CONTENT.title}
          media={
            <PocketEmbed
              src={TEASPANKS_CONTENT.embedSrc}
              title={TEASPANKS_CONTENT.embedTitle}
              kind="video"
            />
          }
          caption={TEASPANKS_CONTENT.caption}
          linkHref={TEASPANKS_CONTENT.linkHref}
          linkLabel={TEASPANKS_CONTENT.linkLabel}
        />
      </Pocket>
    </>
  );
}

/** No-WebGL edition: the feathered still, placed by the same layout math
 *  at the rest camera (the BandFallback convention). */
export function TeaspanksFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const lay = panelLayout(window.innerWidth, window.innerHeight);
      const wpp = (2 * REST_Z * Math.tan((FOV_DEG * Math.PI) / 360)) / window.innerHeight;
      const scale = lay.worldPerPx / wpp; // rest-camera projection of the REF_Z layout
      const width = lay.rect.width * scale;
      const height = lay.rect.height * scale;
      const cx = window.innerWidth / 2 + lay.meshX / wpp;
      const cy = window.innerHeight / 2 - lay.meshY / wpp;
      el.style.left = `${(cx - width / 2).toFixed(1)}px`;
      el.style.top = `${(cy - height / 2).toFixed(1)}px`;
      el.style.width = `${width.toFixed(1)}px`;
      el.style.height = `${height.toFixed(1)}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);
  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (ref.current) ref.current.style.opacity = panelOpacity(value).toFixed(4);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);
  return (
    <div className="stage band-fallback">
      <img
        ref={ref}
        src="/assets/teaspanks/still-feathered.webp"
        alt="A frame from the TeaSpanks music video, black-and-white with the colors popped: Luke, in an orange shirt and sunglasses, mid-swing on a real drum kit; Penny beside him singing into a toy microphone with one hand raised."
        draggable={false}
      />
    </div>
  );
}

