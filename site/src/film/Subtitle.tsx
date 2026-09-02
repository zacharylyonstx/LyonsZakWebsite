// The voice-line component — the film's lower third.
//
// One element, always mounted; each frame it resolves which VoiceLine (if
// any) owns the current journey position and writes text + opacity straight
// to the DOM (no React state per frame, the same zero-re-render discipline
// the v1 scenes used). The fade envelope is a PURE function of the damped
// journey value — no CSS transitions, no wall-clock — so a settled frame is
// byte-identical no matter how it was reached (the qa.mjs sweep's law).
//
// Accessibility: the line lands in an aria-live="polite" region, updated
// only when the ACTIVE LINE CHANGES (never per opacity tick), so screen
// readers hear each line once, in order, as the visitor travels.
import { useEffect, useRef } from 'react';
import type { ScrollTimeline } from '../timeline/scrollTimeline';
import { VOICE_LINES, type VoiceLine } from './voice';

/** Fraction of a line's window spent fading at each end. */
const FADE_FRACTION = 0.18;

/** Smoothstep — gentle ends, no linear pop. */
function smooth(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

export interface SubtitleState {
  /** Index into `lines`, or -1 when no line owns t. */
  index: number;
  /** 0..1 fade envelope at t (0 when index is -1). */
  opacity: number;
}

/** Pure resolver: which line is on screen at journey position t, how faded
 *  in. Exported for tests (voice.test.ts drives it directly). */
export function subtitleStateAt(
  t: number,
  lines: readonly VoiceLine[] = VOICE_LINES,
): SubtitleState {
  for (let i = 0; i < lines.length; i++) {
    const [start, end] = lines[i].window;
    if (t < start || t > end) continue;
    const span = end - start;
    if (span <= 0) return { index: i, opacity: 1 };
    const fade = span * FADE_FRACTION;
    const fadeIn = smooth((t - start) / fade);
    const fadeOut = smooth((end - t) / fade);
    return { index: i, opacity: Math.min(fadeIn, fadeOut) };
  }
  return { index: -1, opacity: 0 };
}

export function Subtitle({ timeline }: { timeline: ScrollTimeline | null }) {
  const lineRef = useRef<HTMLParagraphElement>(null);
  const shownIndex = useRef(-1);

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = lineRef.current;
      if (!el) return;
      const { index, opacity } = subtitleStateAt(value);
      if (index !== shownIndex.current) {
        shownIndex.current = index;
        // Text changes only on line change — the aria-live contract above.
        el.textContent = index >= 0 ? VOICE_LINES[index].text : '';
      }
      el.style.opacity = opacity.toFixed(4);
    };
    apply(timeline.value()); // paint the mount frame (e.g. after a reload
    // restored mid-journey) without waiting a frame
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <div className="subtitle-layer">
      <p ref={lineRef} className="subtitle-line" aria-live="polite" />
    </div>
  );
}
