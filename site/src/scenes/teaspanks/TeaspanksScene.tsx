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
  lyricOpacity,
  lyricRisePx,
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
import {
  TEASPANKS_CONTENT,
  TEASPANKS_LYRIC,
  TEASPANKS_SONG,
} from '../../pockets/teaspanks';
import {
  STOP_FADE_MS,
  createRecordPlayerController,
  fadeValue,
  onPotentialStopSignal,
} from '../band/recordPlayer';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import { filmHeight } from '../../timeline/filmViewport';

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
      const h = filmHeight();
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

/** THE LYRIC — the chapter's title card: Luke's line, alone on the dusk
 *  before the frame arrives (2026-09-03). DOM, centered, opacity + a small
 *  rise as pure functions of progress (reversible, byte-stable). Real
 *  material: see TEASPANKS_LYRIC's provenance note. */
export function TeaspanksLyric({ timeline }: { timeline: ScrollTimeline | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = ref.current;
      if (!el) return;
      const opacity = lyricOpacity(value);
      el.style.opacity = opacity.toFixed(4);
      el.style.visibility = opacity > 0.0005 ? 'visible' : 'hidden';
      el.style.transform = `translate3d(0, ${lyricRisePx(value).toFixed(2)}px, 0)`;
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);
  return (
    <div ref={ref} className="lyric-card" aria-hidden="true">
      <p className="lyric-eyebrow">{TEASPANKS_LYRIC.eyebrow}</p>
      <p className="lyric-text">
        {TEASPANKS_LYRIC.lines.map((line, i) => (
          <span key={i} className="lyric-line">
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

/** The two pills (HEAR the song · WATCH the video) + the song's audio + the
 *  video's pocket. One projected wrapper carries both pills (a row under the
 *  frame's right edge in landscape, a centered stack in portrait); its
 *  opacity is the pill envelope. The song follows THE RECORD's grammar
 *  exactly (recordPlayer.ts): never autoplay, any scroll input stops it
 *  with a fade, the journey is never held; opening the video pocket stops
 *  it first so two players never overlap. Mounted unconditionally
 *  (App.tsx) like every other DOM affordance. */
export function TeaspanksDiscovery({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<PocketHandle>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeRafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const cancelFade = () => {
    if (fadeRafRef.current != null) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  };

  const controllerRef = useRef(
    createRecordPlayerController({
      startAudio: () => {
        cancelFade();
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = 1;
        void audio.play().catch(() => {});
        setPlaying(true);
      },
      stopAudio: () => {
        cancelFade();
        const audio = audioRef.current;
        if (!audio || audio.paused) {
          setPlaying(false);
          return;
        }
        const startVolume = audio.volume;
        const startedAt = performance.now();
        const tick = () => {
          const el = audioRef.current;
          if (!el) return;
          const elapsed = performance.now() - startedAt;
          el.volume = fadeValue(elapsed, STOP_FADE_MS, startVolume, 0);
          if (elapsed < STOP_FADE_MS) {
            fadeRafRef.current = requestAnimationFrame(tick);
          } else {
            el.pause();
            el.currentTime = 0;
            fadeRafRef.current = null;
          }
        };
        fadeRafRef.current = requestAnimationFrame(tick);
        setPlaying(false);
      },
    }),
  );

  useEffect(() => cancelFade, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = groupRef.current;
      if (!el) return;
      const opacity = pillOpacity(value);
      const inert = opacity <= 0.05;
      el.style.opacity = opacity.toFixed(4);
      el.style.pointerEvents = inert ? 'none' : 'auto';
      el.setAttribute('aria-hidden', inert ? 'true' : 'false');
      for (const b of Array.from(el.querySelectorAll('button'))) b.tabIndex = inert ? -1 : 0;
      if (opacity <= 0.0005) return;
      const w = window.innerWidth;
      const h = filmHeight();
      const cam = cameraPose(value, reducedMotion);
      const screen = projectPoint(pillAnchor(w, h), cam, w, h);
      el.style.left = `${screen.x.toFixed(1)}px`;
      el.style.top = `${screen.y.toFixed(1)}px`;
      el.style.transform =
        pillAlign(w, h) === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, 0)';
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  // Scroll-away stops the song (listeners exist only while playing).
  useEffect(() => {
    if (!playing) return;
    const onWheel = () => onPotentialStopSignal(controllerRef.current, { kind: 'wheel' });
    const onTouchMove = () =>
      onPotentialStopSignal(controllerRef.current, { kind: 'touchmove' });
    const onKeyDown = (e: KeyboardEvent) =>
      onPotentialStopSignal(controllerRef.current, { kind: 'key', key: e.key });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [playing]);

  const toggleSong = () => {
    if (controllerRef.current.state() === 'playing') controllerRef.current.stop();
    else controllerRef.current.play();
  };

  const openVideo = () => {
    controllerRef.current.stop();
    pocketRef.current?.open();
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={TEASPANKS_SONG.excerptUrl}
        preload="none"
        aria-hidden="true"
        onEnded={() => controllerRef.current.stop()}
      />
      <div ref={groupRef} className="teaspanks-pills" aria-hidden="true">
        <button
          type="button"
          className={`film-pill teaspanks-hear${playing ? ' is-playing' : ''}`}
          aria-pressed={playing}
          aria-label={playing ? TEASPANKS_SONG.ariaLabelPlaying : TEASPANKS_SONG.ariaLabel}
          tabIndex={-1}
          onClick={toggleSong}
        >
          <span className="film-pill-row">
            <span className="film-pill-icon" aria-hidden="true">
              {playing ? '■' : '♪'}
            </span>
            <span className="film-pill-label">
              {playing ? TEASPANKS_SONG.pillLabelPlaying : TEASPANKS_SONG.pillLabel}
            </span>
            {playing && <span className="film-pill-indicator" aria-hidden="true" />}
          </span>
          <span className="film-pill-sub">{TEASPANKS_SONG.pillSub}</span>
        </button>
        <button
          type="button"
          className="film-pill teaspanks-watch"
          aria-label={TEASPANKS_CONTENT.ariaLabel}
          tabIndex={-1}
          onClick={openVideo}
        >
          <span className="film-pill-row">
            <span className="film-pill-icon" aria-hidden="true">
              ▶
            </span>
            <span className="film-pill-label">{TEASPANKS_CONTENT.pillLabel}</span>
          </span>
          <span className="film-pill-sub">{TEASPANKS_CONTENT.pillSub}</span>
        </button>
      </div>
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
      const lay = panelLayout(window.innerWidth, filmHeight());
      const wpp = (2 * REST_Z * Math.tan((FOV_DEG * Math.PI) / 360)) / filmHeight();
      const scale = lay.worldPerPx / wpp; // rest-camera projection of the REF_Z layout
      const width = lay.rect.width * scale;
      const height = lay.rect.height * scale;
      const cx = window.innerWidth / 2 + lay.meshX / wpp;
      const cy = filmHeight() / 2 - lay.meshY / wpp;
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

