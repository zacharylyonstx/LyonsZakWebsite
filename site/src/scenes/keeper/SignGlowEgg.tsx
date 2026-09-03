// THE KEEPER'S EASTER EGG (ship-pass item 2b) — click/tap the TEXAS sign's
// own lettering and its backlight warms briefly: a one-shot CSS glow pulse,
// user-initiated and so explicitly outside the frame-determinism law that
// governs scroll-driven pixels (DETERMINISM.md's own carve-out for
// user-initiated state, the same one THE BAND's record excerpt and THE
// WEIRD ONES's TEXAS... erm, tinfoil-hat pocket already rely on). Mounted
// unconditionally like DrumHitEgg; the same reducedMotion flag collapses
// the live-camera and reducedMotion/no-WebGL editions into one component.
import { useEffect, useRef } from 'react';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import {
  cameraPose,
  projectPoint,
  signHotspotActive,
  signTextAnchorWorld,
  signTextHotspotSize,
} from './keeperRig';
import { filmHeight } from '../../timeline/filmViewport';

/** How long the CSS pulse (and its reduced-motion opacity swap) stays
 *  visible before the class is removed — matches the keyframe's own
 *  duration (styles.css's sign-glow-pulse) so a rapid re-click always finds
 *  the class already cleared and can restart the animation cleanly. */
const GLOW_DURATION_MS = 1600;
const GLOW_DURATION_REDUCED_MS = 500;

export function SignGlowEgg({
  timeline,
  reducedMotion,
}: {
  timeline: ScrollTimeline | null;
  reducedMotion: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const btn = btnRef.current;
      const glow = glowRef.current;
      if (!btn || !glow) return;
      if (!signHotspotActive(value)) {
        btn.style.pointerEvents = 'none';
        btn.tabIndex = -1;
        btn.style.transform = 'translate3d(-9999px, -9999px, 0)';
        glow.style.transform = 'translate3d(-9999px, -9999px, 0)';
        return;
      }
      const w = window.innerWidth;
      const h = filmHeight();
      const cam = cameraPose(value, reducedMotion);
      const anchor = signTextAnchorWorld(w, h);
      const screen = projectPoint(anchor, cam, w, h);
      const size = signTextHotspotSize(w, h, screen.depth);
      const transform =
        `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0) ` +
        'translate(-50%, -50%)';
      for (const el of [btn, glow]) {
        el.style.width = `${size.width.toFixed(1)}px`;
        el.style.height = `${size.height.toFixed(1)}px`;
        el.style.transform = transform;
      }
      btn.style.pointerEvents = 'auto';
      btn.tabIndex = 0;
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline, reducedMotion]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const fire = () => {
    const glow = glowRef.current;
    if (!glow) return;
    glow.classList.remove('sign-glow-firing');
    void glow.offsetWidth; // force reflow so a rapid re-click restarts the animation
    glow.classList.add('sign-glow-firing');
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => glow.classList.remove('sign-glow-firing'),
      reducedMotion ? GLOW_DURATION_REDUCED_MS : GLOW_DURATION_MS,
    );
  };

  return (
    <>
      <div ref={glowRef} className="sign-glow" aria-hidden="true" />
      <button
        ref={btnRef}
        type="button"
        className="egg-hotspot"
        aria-label="Warm the TEXAS sign's backlight"
        onClick={fire}
      />
    </>
  );
}
