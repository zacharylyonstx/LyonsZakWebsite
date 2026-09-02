// THE DRUMMER'S EASTER EGG (ship-pass item 2a) — click/tap the drum kit
// itself, hear ONE real drum hit. Mounted unconditionally, like
// RecordAffordance/BuilderCaptions: the same component serves the live-
// camera edition and the reducedMotion/no-WebGL edition (the caller
// collapses both into one `reducedMotion` flag — the App.tsx convention).
// No glint, no visible chrome at all — "cursor:pointer only" per the brief,
// this one is for finders. A real <button>, so it's keyboard-reachable
// (Tab, then Enter/Space) for free; the drum hit itself only plays when the
// master sound toggle is on — silently does nothing otherwise, never
// blocking anything.
import { useEffect, useRef } from 'react';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import {
  cameraPose,
  drumKitAnchorWorld,
  drumKitHotspotActive,
  drumKitHotspotSize,
  projectPoint,
} from './drummerRig';
import { getSoundStore } from '../../audio/soundStore';

// public/audio/ (not public/assets/, which stays gitignored per site/
// .gitignore's own "decoded production assets" rule) — this file is small,
// real, source-controlled, the same exception the résumé PDF and the
// self-hosted fonts already carry.
const HIT_URL = '/audio/drum-hit.mp3';

export function DrumHitEgg({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const btn = btnRef.current;
      if (!btn) return;
      if (!drumKitHotspotActive(value)) {
        btn.style.pointerEvents = 'none';
        btn.tabIndex = -1;
        btn.style.transform = 'translate3d(-9999px, -9999px, 0)';
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cam = cameraPose(value, reducedMotion);
      const anchor = drumKitAnchorWorld(w, h);
      const screen = projectPoint(anchor, cam, w, h);
      const size = drumKitHotspotSize(w, h, screen.depth);
      btn.style.width = `${size.width.toFixed(1)}px`;
      btn.style.height = `${size.height.toFixed(1)}px`;
      btn.style.transform =
        `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0) ` +
        'translate(-50%, -50%)';
      btn.style.pointerEvents = 'auto';
      btn.tabIndex = 0;
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  const handleActivate = () => {
    if (!getSoundStore().isEnabled()) return; // silent no-op — never blocks anything
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  };

  return (
    <>
      <audio ref={audioRef} src={HIT_URL} preload="auto" aria-hidden="true" />
      <button
        ref={btnRef}
        type="button"
        className="egg-hotspot"
        aria-label="Hit the drums"
        onClick={handleActivate}
      />
    </>
  );
}
