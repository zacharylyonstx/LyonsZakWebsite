// The v2 shell: dusk ground + film grain (DOM), one fixed Canvas behind the
// scene layers (the world every scene will render into), the quiet fast lane,
// and the scroll host that gives the page its honest scrollbar. Scenes arrive
// next; the grammar — scroll = travel through a damped timeline — is fully
// live here, and the opening title card (THE DRUMMER's DOM half) composes the
// first frame per docs/v2-direction.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  createScrollTimeline,
  type ScrollTimeline,
} from './timeline/scrollTimeline';
import {
  SEGMENTS,
  JOURNEY_PX,
  segmentProgress,
  type SegmentName,
} from './timeline/segments';
import { dampingFor, dprMaxFor, isCoarsePointer } from './timeline/filmViewport';
import { ContactCard, type ContactCardHandle } from './contact/ContactCard';
import { Subtitle } from './film/Subtitle';
import {
  DrummerPhotoLayer,
  DrummerFrontCanvas,
  DrummerFallback,
} from './scenes/drummer/DrummerScene';
import { cueOpacity, nameState, nameTagDip } from './scenes/drummer/drummerRig';
import {
  BuilderPanels,
  BuilderCaptions,
  BuilderFallback,
} from './scenes/builder/BuilderScene';
import { DadPhotos, DadFallback } from './scenes/dad/DadScene';
import {
  NeighborhoodPhotos,
  NeighborhoodHeroDom,
  NeighborhoodStill,
} from './scenes/neighborhood/NeighborhoodScene';
import {
  BandPhotos,
  BandFallback,
  RecordAffordance,
  GigVideoDiscovery,
} from './scenes/band/BandScene';
import {
  TeaspanksPanel,
  TeaspanksLabel,
  TeaspanksDiscovery,
  TeaspanksFallback,
} from './scenes/teaspanks/TeaspanksScene';
import {
  WeirdPanels,
  WeirdLabel,
  WeirdDiscovery,
  WeirdFallback,
} from './scenes/weird/WeirdScene';
import {
  KeeperPhotos,
  KeeperEndCard,
  KeeperFallback,
} from './scenes/keeper/KeeperScene';
import { SignGlowEgg } from './scenes/keeper/SignGlowEgg';
import { DrumHitEgg } from './scenes/drummer/DrumHitEgg';
import { SoundToggle } from './audio/SoundToggle';
import { AmbientBedController } from './audio/AmbientBedController';

/** The site's ground color — the token --dusk. The Canvas's clear color is
 *  this hue at alpha 0: transparent for now, so the DOM dusk GRADIENT behind
 *  it shows through (never flat black); a scene that owns the whole frame
 *  raises its own clearAlpha against the same base. */
const DUSK = '#171e2e';

/** Debug hooks for scripts/qa.mjs (the byte-sweep harness). App publishes
 *  the journey instruments; the REAL journey<->crossing mapping and the
 *  crossing's own instruments (refresh/getState/uniforms/...) are published
 *  by THE NEIGHBORHOOD (NeighborhoodHeroDom + CrossingScene's rig) — the
 *  v1 HeroScene pattern, now live. */
declare global {
  interface Window {
    crossingDebug?: {
      refresh?: () => void;
      heroMap?: { pForT: (t: number) => number; tForP: (p: number) => number };
      getState?: () => { p: number };
      journeyT?: () => number;
      journeyTarget?: () => number;
      [key: string]: unknown;
    };
  }
}

/** Which segment owns journey position t (last segment wins at t=1). */
function segmentAt(t: number): SegmentName {
  const names = Object.keys(SEGMENTS) as SegmentName[];
  for (const name of names) {
    if (t < SEGMENTS[name][1]) return name;
  }
  return names[names.length - 1];
}

function Header({ onOpenCard }: { onOpenCard: () => void }) {
  return (
    <header className="fastlane">
      {/* The identity block is the film's contact card (2026-09-03): one
          tap on the name, anywhere in the journey, opens the card — the suit
          headshot, the number, the vCard. The amber glint after the name is
          the site's own "look closer" mark (pocket-glint's language). */}
      <button
        type="button"
        className="fastlane-identity fastlane-identity-btn"
        onClick={onOpenCard}
        aria-haspopup="dialog"
        aria-controls="contact-card-dialog"
      >
        <span className="fastlane-name">
          Zak Lyons
          <span className="fastlane-glint" aria-hidden="true" />
        </span>
        <span className="fastlane-role">Senior Software Engineer</span>
        <span className="sr-only">— open contact card</span>
      </button>
      <div className="fastlane-right">
        {/* Ship-pass item 1: the master sound toggle — quiet, in the header,
            discoverable but never nagging. */}
        <SoundToggle />
        <nav className="fastlane-nav" aria-label="Professional">
          <a href="/resume">Resume</a>
          <a href="/experience">Experience</a>
          <a href="/projects">Projects</a>
          <a href="/contact">Contact</a>
        </nav>
      </div>
    </header>
  );
}

/** THE DRUMMER's DOM half — ZAK / LYONS set huge and staggered, LYONS' tail
 *  diving BEHIND Zak via the occlusion canvas above this layer. Motion and
 *  fade come from the drummer rig: the name rides between the flag (far)
 *  and Zak (near) as its own depth layer — a pure function of the damped
 *  value, reversible, byte-stable, no wall-clock. */
function NameCard({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      if (cardRef.current) {
        const ns = nameState(value, reducedMotion);
        cardRef.current.style.opacity = ns.opacity.toFixed(4);
        cardRef.current.style.transform = `translate3d(${ns.x}px, ${ns.y}px, 0)`;
      }
      if (tagRef.current) {
        // Composes with cardRef's opacity via nested CSS opacity — do not
        // multiply by ns.opacity by hand (see nameTagDip's doc comment).
        tagRef.current.style.opacity = nameTagDip(value).toFixed(4);
      }
      if (cueRef.current) {
        cueRef.current.style.opacity = cueOpacity(value).toFixed(4);
      }
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  return (
    <>
      <div ref={cardRef} className="name-display">
        <h1 className="name-words">
          <span className="nw-line">Zak</span>
          <span className="nw-line nw-line2">Lyons</span>
        </h1>
        <div ref={tagRef} className="name-tag">
          <hr className="name-rule" aria-hidden="true" />
          <p className="name-voice">Senior software engineer. Texas.</p>
        </div>
      </div>
      <div ref={cueRef} className="scroll-cue" aria-hidden="true">
        Scroll
      </div>
    </>
  );
}

/** ?debug=1 readout: raw + damped journey position and the owning segment. */
function DebugReadout({ timeline }: { timeline: ScrollTimeline | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number, target: number) => {
      if (!ref.current) return;
      const seg = segmentAt(value);
      const local = segmentProgress(value, SEGMENTS[seg]);
      ref.current.textContent =
        `t ${value.toFixed(4)}  target ${target.toFixed(4)}\n` +
        `${seg} ${local.toFixed(3)}`;
    };
    apply(timeline.value(), timeline.target());
    return timeline.onFrame(apply);
  }, [timeline]);
  return <div ref={ref} className="debug-readout" />;
}

export default function App() {
  const [timeline, setTimeline] = useState<ScrollTimeline | null>(null);
  const contactCardRef = useRef<ContactCardHandle>(null);
  const params = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const debug = params.get('debug') === '1';

  // WebGL availability, probed once — scenes must compose without it
  // (DrummerFallback: same frame, no parallax, no occlusion).
  // Renderer pixel-ratio cap: phones get 1.5, everything else 2
  // (filmViewport.ts's rationale). Read once — a pointer doesn't change.
  const dprMax = useMemo(() => dprMaxFor(isCoarsePointer()), []);

  const webgl = useMemo(() => {
    try {
      const probe = document.createElement('canvas');
      return Boolean(
        probe.getContext('webgl2') ?? probe.getContext('webgl'),
      );
    } catch {
      return false;
    }
  }, []);

  // The low-motion edition's switch: composition intact, dissolves only.
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Journey-position restoration (v1 Task 11's seam fix, cherry-picked):
  // native browser scroll restoration into a JS-rendered page is a race
  // (~50% flaky measured across segments), so the journey owns it — scrollY
  // stored on pagehide, re-applied on back_forward/reload BEFORE the
  // timeline is created, so the damped follower starts already settled at
  // the restored spot (never a teleport, never a catch-up glide).
  // A fresh navigation deliberately starts at the top: browser-back means
  // "take me back to where I was"; a fresh link means "start at the
  // beginning." scrollRestoration goes 'manual' so the native mechanism
  // can't double-fire against this.
  useEffect(() => {
    const JOURNEY_Y_KEY = 'lyonszak.journeyY';
    try {
      window.history.scrollRestoration = 'manual';
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      const stored = window.sessionStorage.getItem(JOURNEY_Y_KEY);
      if (
        stored !== null &&
        (nav?.type === 'back_forward' || nav?.type === 'reload')
      ) {
        // `.journey` is in this same commit, so the document is already its
        // full height; this scroll is honest input, not a hijack — it lands
        // before the timeline below takes its first sample.
        window.scrollTo(0, Number(stored));
      }
    } catch {
      // storage unavailable (private mode etc.) — start at the top.
    }
    const storeY = () => {
      try {
        window.sessionStorage.setItem(JOURNEY_Y_KEY, String(window.scrollY));
      } catch {
        // best-effort only
      }
    };
    window.addEventListener('pagehide', storeY);
    // Dev-only capture instrument (the v1 record-slice method): ?damping=90
    // stiffens the follower so deterministic seek-stepped recordings settle
    // fast. Settled frames are a pure function of position, so the damping
    // value changes nothing about what any frame looks like. Ignored in
    // production builds.
    let damping: number | undefined;
    if (import.meta.env.DEV) {
      const d = Number(new URLSearchParams(window.location.search).get('damping'));
      if (Number.isFinite(d) && d > 0) damping = d;
    }
    // The mobile scroll pass (2026-09-03): the target divides scroll by the
    // film's FIXED length, never by (scrollHeight − innerHeight) — on a
    // phone the toolbar's collapse changes innerHeight mid-scroll, which
    // used to move the film by itself. `.journey` is sized so exactly
    // JOURNEY_PX of scroll is always reachable (styles.css). A finger gets
    // the tighter of the two dampings (filmViewport.ts).
    const coarse = isCoarsePointer();
    const tl = createScrollTimeline({
      damping: damping ?? dampingFor(coarse),
      scrollSource: {
        scrollY: () => window.scrollY,
        maxScroll: () => JOURNEY_PX,
      },
    });
    setTimeline(tl);
    return () => {
      window.removeEventListener('pagehide', storeY);
      tl.dispose();
    };
  }, []);

  // Publish the journey instruments (see the declare global above). The
  // crossing's own hooks (refresh/getState/heroMap/...) arrive from THE
  // NEIGHBORHOOD's modules once its assets resolve.
  useEffect(() => {
    if (!timeline) return;
    if (import.meta.env.DEV || debug) {
      window.crossingDebug = Object.assign(window.crossingDebug ?? {}, {
        journeyT: () => timeline.value(),
        journeyTarget: () => timeline.target(),
      });
    }
  }, [timeline, debug]);

  return (
    <>
      {/* Ship-pass item 1 — no visual output, owns the ambient bed's whole
          start/stop/duck lifecycle against the master sound toggle. */}
      <AmbientBedController />
      <div className="ground" aria-hidden="true" />
      {webgl ? (
        <div className="stage" aria-hidden="true">
          <Canvas
            dpr={[1, dprMax]}
            gl={{ antialias: true, alpha: true }}
            camera={{ fov: 38, position: [0, 0, 5] }}
            // R3F's wrapper div sets inline pointerEvents:'auto' by default,
            // which re-enables hit-testing INSIDE an ancestor's
            // pointer-events:none (CSS pointer-events doesn't cascade past a
            // child that re-opts-in) — so without this, the film's canvases
            // silently swallow clicks/selection on everything below their
            // z-index, page-wide (scene4-report.md concern #6). The film is
            // watched, never clicked: no scene uses R3F pointer events
            // (CrossingScene already carries the same fix from v1).
            style={{ pointerEvents: 'none' }}
            onCreated={({ gl }) => {
              // The dusk base at alpha 0 — see DUSK's doc comment.
              gl.setClearColor(DUSK, 0);
            }}
          >
            {/* Scene worlds mount here (the crossing joins later). */}
            {timeline && (
              <DrummerPhotoLayer
                timeline={timeline}
                reducedMotion={reducedMotion}
              />
            )}
            {timeline && (
              <BuilderPanels timeline={timeline} reducedMotion={reducedMotion} />
            )}
            {/* Mounted AFTER BuilderPanels: the same shared camera object,
                so THE DAD's own writes take priority the instant its
                sceneActive range opens (see DadScene.tsx's mount comment). */}
            {timeline && (
              <DadPhotos timeline={timeline} reducedMotion={reducedMotion} />
            )}
            {/* Later sibling again: THE NEIGHBORHOOD's camera writes take
                priority the instant its segment opens (the standing
                mount-order pattern). */}
            {timeline && (
              <NeighborhoodPhotos
                timeline={timeline}
                reducedMotion={reducedMotion}
              />
            )}
            {/* Later sibling again: THE BAND's own camera writes take
                priority the instant its segment opens (the standing
                mount-order pattern). */}
            {timeline && (
              <BandPhotos timeline={timeline} reducedMotion={reducedMotion} />
            )}
            {/* TEASPANKS (2026-09-01): later sibling — its camera writes win
                the instant its segment opens. */}
            {timeline && (
              <TeaspanksPanel timeline={timeline} reducedMotion={reducedMotion} />
            )}
            {/* Later sibling again: THE WEIRD ONES's own camera writes take
                priority the instant its segment opens (the standing
                mount-order pattern). */}
            {timeline && (
              <WeirdPanels timeline={timeline} reducedMotion={reducedMotion} />
            )}
            {/* Last sibling — the film's last scene: THE KEEPER's camera
                writes take priority the instant its segment opens. */}
            {timeline && (
              <KeeperPhotos timeline={timeline} reducedMotion={reducedMotion} />
            )}
          </Canvas>
        </div>
      ) : (
        <>
          <DrummerFallback timeline={timeline} />
          <BuilderFallback timeline={timeline} />
          <DadFallback timeline={timeline} />
          <BandFallback timeline={timeline} />
          <TeaspanksFallback timeline={timeline} />
          <WeirdFallback timeline={timeline} />
          <KeeperFallback timeline={timeline} />
        </>
      )}
      {/* THE NEIGHBORHOOD's DOM half — beats 2-4. Full edition mounts the
          crossing (early, at boot — its precompile beat is scenes 1-3);
          reduced motion / no WebGL get the before/after static edition
          (same scroll positions, same voice, same pocket). Mounted BEFORE
          Header/NameCard so every DOM layer above (fast lane, subtitles,
          grain) stays above the film. */}
      {timeline && webgl && !reducedMotion && (
        <NeighborhoodHeroDom timeline={timeline} />
      )}
      {timeline && (reducedMotion || !webgl) && (
        <NeighborhoodStill timeline={timeline} includeBuild={!webgl} />
      )}
      <Header onOpenCard={() => contactCardRef.current?.open()} />
      <NameCard timeline={timeline} reducedMotion={reducedMotion} />
      {/* The occlusion layer — Zak and the kit, ABOVE the type (z2, later
          sibling): the depth-mask signature move. */}
      {webgl && timeline && (
        <DrummerFrontCanvas timeline={timeline} reducedMotion={reducedMotion} />
      )}
      {/* pinned === true whenever the CAMERA doesn't actually move — true
          reduced motion, or no WebGL at all (BuilderFallback positions its
          panels with the static REST camera, never the live drift/exit
          pose) — so the caption never tracks motion its own panel isn't
          making. Two independent reasons for "the camera is static",
          collapsed to one flag at this single call site. */}
      <BuilderCaptions timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      {/* THE BAND's audio discovery — mounted unconditionally like
          BuilderCaptions: the SAME component serves the live-camera edition
          and the reducedMotion/no-WebGL edition (which pins the projection
          to the REST camera). Works with no WebGL at all — it's plain
          DOM + <audio>, never gated on `webgl`. */}
      <RecordAffordance timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      {/* THE MUSIC VIDEO discovery on the gig frame's drum kit (2026-09-01) —
          same unconditional mount + reducedMotion||!webgl collapse. */}
      <GigVideoDiscovery timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      {/* THE WEIRD ONES's museum label + discovery glint — mounted
          unconditionally like BuilderCaptions/RecordAffordance, the same
          reducedMotion||!webgl collapse (the fallback TV projects through
          REST too — WeirdFallback's own convention). */}
      {/* TEASPANKS's museum label + WATCH pill/pocket (2026-09-01). */}
      <TeaspanksLabel timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      <TeaspanksDiscovery timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      <WeirdLabel timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      <WeirdDiscovery timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      {/* Ship-pass item 2 — the easter eggs. Mounted unconditionally like
          every other DOM affordance above: reducedMotion||!webgl collapses
          the live-camera and reduced/no-WebGL editions into one component. */}
      <DrumHitEgg timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      <SignGlowEgg timeline={timeline} reducedMotion={reducedMotion || !webgl} />
      <Subtitle timeline={timeline} />
      {/* THE KEEPER's signature — the film's last card (contact block),
          mounted unconditionally: identical DOM in the full, reducedMotion,
          and no-WebGL editions. Under the grain (z3 < z4) like every scene
          layer — the film's surface covers its last card too. */}
      <KeeperEndCard
        timeline={timeline}
        onOpenCard={() => contactCardRef.current?.open()}
      />
      {/* The contact card overlay (2026-09-03) — the pocket grammar: holds
          the journey while open, any scroll closes it, focus is trapped and
          restored. Above the grain (z30, the pocket-overlay tier). */}
      <ContactCard ref={contactCardRef} timeline={timeline} />
      <div className="grain" aria-hidden="true" />
      {debug && <DebugReadout timeline={timeline} />}
      {/* The honest scrollbar: the page's real height, nothing hijacked. */}
      <div className="journey" aria-hidden="true" />
    </>
  );
}
