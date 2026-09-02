// Scene 5 — THE BAND. Three flat photo planes (no depth mesh — see
// bandRig.ts's file header for why) at two world depths: the barn-gig and
// band-practice photos sit at z=0 (dadRig's convention — the camera moves,
// the plane doesn't); the "Lost in Austin" record sits nearer the camera
// (bandRig.RECORD_WORLD_Z), a real object in depth space rather than a
// full-bleed photograph. Reuses THE BUILDER's panel material verbatim
// (panelMaterial.ts's edge-feather + opacity shader was already built for
// "a flat plane, not a depth mesh" — exactly this scene's own case) instead
// of inventing a new shader.
//
// Rendering stack (bottom to top, the shared Canvas/camera every scene
// since THE DRUMMER mounts, App's .stage):
//   gig mesh       — the barn-porch night gig, feathered into the dusk.
//   glow sprite    — a small, subtle amber bleed behind the record only
//                    (GLOW_ALPHA is dialed well below THE BUILDER's own
//                    "screen glow" — a record sleeve catches light, it
//                    doesn't emit it).
//   record mesh    — the album sleeve, tilted, nearer the camera.
//   practice mesh  — the band-practice-with-kids photo, same feather.
//
// THE AUDIO DISCOVERY (the scene's one interactive beat): RecordAffordance
// below is a DOM component, mounted unconditionally (like BuilderCaptions),
// that tracks the record panel's own projected screen position every frame
// and owns the play/pause state machine (recordPlayer.ts). It is
// deliberately NOT the <Pocket> component — Pocket.tsx holds the journey
// timeline while its dialog is open, and this affordance must let the
// visitor keep scrolling while the excerpt plays (the brief: "never
// hijacks scroll"). What IS reused from the pocket grammar is its own
// shouldCloseOnSignal rule ("pocket laws apply either way" — see
// recordPlayer.ts's header): any scroll input while playing stops it.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  glowTexture,
  loadPanelTexture,
  makePanelMaterial,
  type PanelFeather,
  type PanelMaterialHandle,
} from '../builder/panelMaterial';
import {
  BAND_END,
  FEATHER,
  FOV_DEG,
  GIG_ASPECT,
  PRACTICE_ASPECT,
  REST_Z,
  cameraPose,
  gigLayout,
  gigOpacity,
  practiceLayout,
  practiceOpacity,
  projectPoint,
  recordAffordanceAnchor,
  recordLayout,
  recordOpacity,
  sceneActive,
} from './bandRig';
import {
  STOP_FADE_MS,
  createRecordPlayerController,
  fadeValue,
  onPotentialStopSignal,
} from './recordPlayer';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import { Pocket, type PocketHandle } from '../../pockets/Pocket';
import { PocketCard, PocketEmbed } from '../../pockets/PocketCard';
import { JUKEBOX_CONTENT, OST_VIDEO_CONTENT } from '../../pockets/bandPockets';
import {
  RECORD_PILL_GAP_PX,
  RECORD_PILL_SIDE_GAP_PX,
  gigGlintAnchor,
  gigGlintOpacity,
} from './bandRig';

export { BAND_END };

const GIG_URL = '/assets/band/gig.jpg';
const RECORD_URL = '/assets/band/album.jpg';
const PRACTICE_URL = '/assets/band/practice.jpg';
const EXCERPT_URL = '/assets/band/lost-in-austin-excerpt.m4a';

/** The record's own feather — tighter than the full-bleed photos' (a small
 *  object's edges melt in over a shorter fraction of its own size than a
 *  full-bleed frame's do). A faint rim (0.14, well below THE BUILDER's own
 *  screen-rim default of 0.4) reads as a sleeve's own printed edge catching
 *  ambient light, not a glowing UI element. */
const RECORD_FEATHER: PanelFeather = { left: 0.045, right: 0.045, top: 0.045, bottom: 0.045 };
/** A stronger rim than THE BUILDER's screen default (0.4 there is for a
 *  glowing UI element; 0.22 here is tuned so the sleeve's own edge catches
 *  a believable hairline of ambient light without reading as backlit). */
const RECORD_RIM = 0.22;

/** The record's glow bleed — self-critique fix (scene5-report.md): the
 *  first pass (scale 1.4, alpha 0.4) read as "a screen" (THE BUILDER's own
 *  panel-glow language, borrowed too directly) rather than "a printed
 *  sleeve catching light." Pulled tight and faint — just enough ambient
 *  bleed to keep the object from looking pasted onto flat black — and the
 *  rim highlight above carries most of the "this has an edge" work instead. */
const GLOW_SCALE = 1.18;
const GLOW_ALPHA = 0.16;

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

interface BandTextures {
  gig: THREE.Texture;
  record: THREE.Texture;
  practice: THREE.Texture;
}

/** The WebGL half — mounts inside App's main Canvas (z1), as a LATER
 *  sibling of NeighborhoodPhotos so THE BAND's own camera writes take
 *  priority the instant its sceneActive range opens (the standing
 *  mount-order pattern every scene since THE DAD has used). */
export function BandPhotos({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline;
  reducedMotion: boolean;
}) {
  const { gl } = useThree();
  const [textures, setTextures] = useState<BandTextures | null>(null);

  useEffect(() => {
    let alive = true;
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    Promise.all([
      loadPanelTexture(GIG_URL, maxAniso),
      loadPanelTexture(RECORD_URL, maxAniso),
      loadPanelTexture(PRACTICE_URL, maxAniso),
    ]).then(([gig, record, practice]) => {
      if (alive) setTextures({ gig, record, practice });
    });
    return () => {
      alive = false;
    };
  }, [gl]);

  const rigs = useMemo(() => {
    if (!textures) return null;
    return {
      gig: buildFlatRig(textures.gig, FEATHER, 0),
      record: buildFlatRig(textures.record, RECORD_FEATHER, RECORD_RIM),
      practice: buildFlatRig(textures.practice, FEATHER, 0),
    };
  }, [textures]);

  useEffect(() => {
    if (!rigs) return;
    return () => {
      disposeFlatRig(rigs.gig);
      disposeFlatRig(rigs.record);
      disposeFlatRig(rigs.practice);
    };
  }, [rigs]);

  const glow = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // NOT additive — same reasoning as every prior scene's glow: this
        // Canvas clears to alpha 0, and additive blending leaves too little
        // alpha for the DOM composite step to carry the color forward.
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    );
    mesh.renderOrder = 1; // behind the record, above the gig plane
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
      if (rigs) {
        rigs.gig.mesh.visible = false;
        rigs.record.mesh.visible = false;
        rigs.practice.mesh.visible = false;
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

    if (rigs) {
      rigs.gig.mesh.visible = true;
      const gLay = gigLayout(size.width, size.height);
      rigs.gig.mesh.scale.set(gLay.meshScale, gLay.meshScale / GIG_ASPECT, 1);
      rigs.gig.mesh.position.set(gLay.meshX, gLay.meshY, 0);
      rigs.gig.handle.setOpacity(gigOpacity(t));

      rigs.practice.mesh.visible = true;
      const pLay = practiceLayout(size.width, size.height);
      rigs.practice.mesh.scale.set(pLay.meshScale, pLay.meshScale / PRACTICE_ASPECT, 1);
      rigs.practice.mesh.position.set(pLay.meshX, pLay.meshY, 0);
      rigs.practice.handle.setOpacity(practiceOpacity(t));

      rigs.record.mesh.visible = true;
      const rLay = recordLayout(size.width, size.height);
      rigs.record.mesh.scale.set(rLay.width, rLay.height, 1);
      rigs.record.mesh.position.set(rLay.x, rLay.y, rLay.z);
      rigs.record.mesh.rotation.y = rLay.rotY;
      const rOpacity = recordOpacity(t);
      rigs.record.handle.setOpacity(rOpacity);

      glow.visible = rOpacity > 0.0005;
      if (glow.visible) {
        glow.position.set(rLay.x, rLay.y, rLay.z - 0.06);
        glow.scale.set(rLay.width * GLOW_SCALE, rLay.height * GLOW_SCALE, 1);
        (glow.material as THREE.MeshBasicMaterial).opacity = rOpacity * GLOW_ALPHA;
      }
    }
  });

  return (
    <>
      {rigs && <primitive object={rigs.gig.mesh} />}
      <primitive object={glow} />
      {rigs && <primitive object={rigs.record.mesh} />}
      {rigs && <primitive object={rigs.practice.mesh} />}
    </>
  );
}

/** aria-label text for the affordance's current state — plain language, no
 *  jargon, for a visitor who has never heard of Law By The Gun. */
function recordAriaLabel(playing: boolean): string {
  return playing
    ? 'Stop playing the Lost in Austin excerpt'
    : "Play a 30 second excerpt from Lost in Austin — Law By The Gun's 2016 album";
}

/**
 * THE AUDIO DISCOVERY — a DOM component mounted unconditionally (mirrors
 * BuilderCaptions: one implementation serves the live-camera edition AND
 * the reducedMotion/no-WebGL edition via the same `reducedMotion` flag,
 * which pins the projection to the REST camera instead of tracking a dolly
 * that isn't happening). Owns the <audio> element and the play/pause state
 * machine; App.tsx mounts this once, next to BuilderCaptions/Subtitle.
 */
export function RecordAffordance({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const jukeRef = useRef<HTMLButtonElement>(null);
  const jukePocketRef = useRef<PocketHandle>(null);
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
      // The excerpt file's own first second is already faded in (baked at
      // finalization — see scene5-report.md), so starting playback needs
      // no JS fade of its own: just arm the volume and go. NO AUTOPLAY —
      // this only ever runs from inside the click handler below, a direct
      // user gesture.
      startAudio: () => {
        cancelFade();
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = 1;
        void audio.play().catch(() => {
          // Autoplay-policy rejection shouldn't be reachable (this is
          // always a direct click/Enter/Space gesture), but fails quiet
          // and inert rather than throwing if a browser ever disagrees.
        });
        setPlaying(true);
      },
      // Scroll-away (or the visible button, toggled) cannot be baked into
      // the file ahead of time — this is the one JS-driven fade in the
      // scene, and it is explicitly exempt from the frame-determinism law
      // (the scene brief: "audio state is user-initiated and does not
      // affect rendering determinism").
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

  // Position + visibility: a pure function of journey position + viewport,
  // written straight to the DOM every frame — BuilderCaptions' convention.
  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const btn = btnRef.current;
      const juke = jukeRef.current;
      if (!btn) return;
      const opacity = recordOpacity(value);
      if (opacity <= 0.0005) {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        btn.tabIndex = -1;
        if (juke) {
          juke.style.opacity = '0';
          juke.style.pointerEvents = 'none';
          juke.tabIndex = -1;
        }
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraPose(value, reducedMotion);
      const anchor = recordAffordanceAnchor(w, h);
      const screen = projectPoint(anchor, cam, w, h);
      // translate(-50%, -50%) resolves against the BUTTON's own box (unlike
      // a percentage margin, which would resolve against the viewport) —
      // this is what centers the pill on its tracked point.
      // Two pills share the tracked point: side by side in landscape (each
      // half a gap off center), stacked one reading-row apart in portrait
      // (the pills are DOM, so gaps are reading distances, not world ones).
      const stacked = h > w * 1.05 || w < 720;
      btn.style.transform = stacked
        ? `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0) translate(-50%, -50%)`
        : `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0) translate(calc(-100% - ${RECORD_PILL_SIDE_GAP_PX / 2}px), -50%)`;
      btn.style.opacity = opacity.toFixed(4);
      btn.style.pointerEvents = 'auto';
      btn.tabIndex = 0;
      if (juke) {
        juke.style.transform = stacked
          ? `translate3d(${screen.x.toFixed(1)}px, ${(screen.y + RECORD_PILL_GAP_PX).toFixed(1)}px, 0) translate(-50%, -50%)`
          : `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0) translate(${RECORD_PILL_SIDE_GAP_PX / 2}px, -50%)`;
        juke.style.opacity = opacity.toFixed(4);
        juke.style.pointerEvents = 'auto';
        juke.tabIndex = 0;
      }
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  // Grammar: any scroll input while playing stops it (pocket laws apply
  // even though this isn't a <Pocket> — see recordPlayer.ts's header). The
  // listener only exists while actually playing, so ignoring the
  // affordance entirely costs nothing (no listeners attached at all).
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

  const handleClick = () => {
    if (controllerRef.current.state() === 'playing') controllerRef.current.stop();
    else controllerRef.current.play();
  };

  /** THE JUKEBOX: opening the Spotify pocket stops the excerpt first — two
   *  players never overlap. */
  const openJukebox = () => {
    controllerRef.current.stop();
    jukePocketRef.current?.open();
  };

  return (
    <>
      {/* No `controls` — the button below is the whole accessible surface;
          aria-hidden keeps a headless element out of the a11y tree twice. */}
      <audio
        ref={audioRef}
        src={EXCERPT_URL}
        preload="none"
        aria-hidden="true"
        onEnded={() => controllerRef.current.stop()}
      />
      <button
        ref={btnRef}
        type="button"
        className="record-affordance"
        aria-pressed={playing}
        aria-label={recordAriaLabel(playing)}
        onClick={handleClick}
      >
        <span className="record-affordance-icon" aria-hidden="true">
          {playing ? '■' : '▶'}
        </span>
        <span className="record-affordance-label">
          {playing ? 'PLAYING — LOST IN AUSTIN' : 'LOST IN AUSTIN, 2016 — 30 SECONDS'}
        </span>
        {playing && <span className="record-affordance-indicator" aria-hidden="true" />}
      </button>
      <button
        ref={jukeRef}
        type="button"
        className="record-affordance record-affordance--jukebox"
        aria-label={JUKEBOX_CONTENT.glintLabel}
        onClick={openJukebox}
      >
        <span className="record-affordance-icon" aria-hidden="true">
          ♪
        </span>
        <span className="record-affordance-label">THE WHOLE RECORD — PICK A TRACK</span>
      </button>
      {/* The jukebox pocket's own glint stays off-screen and inert (the
          pill above is its control); the Pocket still owns hold/focus/close. */}
      <Pocket
        ref={jukePocketRef}
        id="jukebox"
        glintAt={{ x: -1, y: -1 }}
        label={JUKEBOX_CONTENT.glintLabel}
        timeline={timeline}
      >
        <PocketCard
          title={JUKEBOX_CONTENT.title}
          media={
            <PocketEmbed
              src={JUKEBOX_CONTENT.embedSrc}
              title={JUKEBOX_CONTENT.embedTitle}
              kind="spotify"
            />
          }
          caption={JUKEBOX_CONTENT.caption}
          linkHref={JUKEBOX_CONTENT.linkHref}
          linkLabel={JUKEBOX_CONTENT.linkLabel}
        />
      </Pocket>
    </>
  );
}

/** THE MUSIC VIDEO discovery — a glint on the empty drum kit in the gig
 *  frame (that frame IS a still from the "One Song Town" video), projected
 *  through the live camera every frame so it stays on the kit while the
 *  frame breathes. Opens a pocket with the band's own YouTube upload.
 *  Mounted unconditionally (App.tsx) like RecordAffordance: the same
 *  component serves the live and the reduced/no-WebGL editions. */
export function GigVideoDiscovery({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const pocketRef = useRef<PocketHandle>(null);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const handle = pocketRef.current;
      if (!handle) return;
      const opacity = gigGlintOpacity(value);
      if (opacity <= 0) {
        handle.setGlintOpacity(0);
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraPose(value, reducedMotion);
      const screen = projectPoint(gigGlintAnchor(w, h), cam, w, h);
      handle.setGlintPosition(screen.x / w, screen.y / h);
      handle.setGlintOpacity(opacity);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  return (
    <Pocket
      ref={pocketRef}
      id="ost-video"
      glintAt={{ x: 0.5, y: 0.5 }}
      label={OST_VIDEO_CONTENT.glintLabel}
      timeline={timeline}
    >
      <PocketCard
        title={OST_VIDEO_CONTENT.title}
        media={
          <PocketEmbed
            src={OST_VIDEO_CONTENT.embedSrc}
            title={OST_VIDEO_CONTENT.embedTitle}
            kind="video"
          />
        }
        caption={OST_VIDEO_CONTENT.caption}
        linkHref={OST_VIDEO_CONTENT.linkHref}
        linkLabel={OST_VIDEO_CONTENT.linkLabel}
      />
    </Pocket>
  );
}

/**
 * No-WebGL branch: the three graded photos as plain, feather-masked images
 * placed by the SAME layout math (the gig/practice photos project as CSS
 * rects directly — dadRig's own convention; the record projects through the
 * REST camera — builderRig's fallback convention, since it's positioned by
 * WORLD depth rather than a viewport fraction alone). RecordAffordance is
 * mounted separately (unconditionally, like BuilderCaptions) and needs no
 * duplicate here.
 *
 * Like THE DAD's fallback (and unlike THE BUILDER's), these three images
 * carry REAL, descriptive alt text rather than aria-hidden decorative
 * emptiness: a real gig, a real record, and his own kids at a real practice
 * ARE this scene's content, not illustration alongside it.
 */
export function BandFallback({ timeline }: { timeline: ScrollTimeline | null }) {
  const gigRef = useRef<HTMLImageElement>(null);
  const recordRef = useRef<HTMLImageElement>(null);
  const practiceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const place = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const gLay = gigLayout(w, h);
      if (gigRef.current) {
        gigRef.current.style.left = `${gLay.rect.left.toFixed(1)}px`;
        gigRef.current.style.top = `${gLay.rect.top.toFixed(1)}px`;
        gigRef.current.style.width = `${gLay.rect.width.toFixed(1)}px`;
        gigRef.current.style.height = `${gLay.rect.height.toFixed(1)}px`;
      }
      const pLay = practiceLayout(w, h);
      if (practiceRef.current) {
        practiceRef.current.style.left = `${pLay.rect.left.toFixed(1)}px`;
        practiceRef.current.style.top = `${pLay.rect.top.toFixed(1)}px`;
        practiceRef.current.style.width = `${pLay.rect.width.toFixed(1)}px`;
        practiceRef.current.style.height = `${pLay.rect.height.toFixed(1)}px`;
      }
      // The record's own world footprint, projected through the site-wide
      // REST camera (0, 0, REST_Z) — the same static-projection convention
      // BuilderFallback uses for its two depth-positioned panels.
      const rLay = recordLayout(w, h);
      if (recordRef.current) {
        const wpp = (2 * (REST_Z - rLay.z) * Math.tan((FOV_DEG * Math.PI) / 360)) / h;
        const left = w / 2 + (rLay.x - rLay.width / 2) / wpp;
        const top = h / 2 - (rLay.y + rLay.height / 2) / wpp;
        recordRef.current.style.left = `${left.toFixed(1)}px`;
        recordRef.current.style.top = `${top.toFixed(1)}px`;
        recordRef.current.style.width = `${(rLay.width / wpp).toFixed(1)}px`;
        recordRef.current.style.height = `${(rLay.height / wpp).toFixed(1)}px`;
      }
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (gigRef.current) gigRef.current.style.opacity = gigOpacity(value).toFixed(4);
      if (recordRef.current) recordRef.current.style.opacity = recordOpacity(value).toFixed(4);
      if (practiceRef.current)
        practiceRef.current.style.opacity = practiceOpacity(value).toFixed(4);
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="stage band-fallback">
      <img
        ref={gigRef}
        src="/assets/band/gig-feathered.webp"
        alt="Three bandmates play under string lights on a lit barn porch at night, an empty drum kit between them — Law By The Gun, mid gig."
        draggable={false}
      />
      <img
        ref={recordRef}
        src="/assets/band/album.jpg"
        alt="The cover of Law By The Gun's 2016 album, Lost in Austin: an Austin skyline silhouette at sunset over a translucent Texas highway map."
        draggable={false}
      />
      <img
        ref={practiceRef}
        src="/assets/band/practice-feathered.webp"
        alt="Two bandmates rehearse on guitar in Zak's living room while his two kids stand together in the middle of the room, one wearing green ear protection."
        draggable={false}
      />
    </div>
  );
}
