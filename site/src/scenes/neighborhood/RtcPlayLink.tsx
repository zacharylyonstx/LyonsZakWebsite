// The visible invitation to play the real game (2026-09-01, Zak's note:
// "there should be a link to it royal-tara-cove.netlify.app"). The mailbox
// glint + pocket remain the deeper look (the aerial view + the why); this
// is the plain, always-legible door: a labeled link pill that lands under
// the LYONS mailbox as the camera settles and stays through the dusk. A
// real <a> — opens in a new tab so the film keeps the visitor's place.
//
// Placement: anchored to the same projected mailbox point the glint uses
// (arrivalGlintAt / stillGlintAt), one reading-row below it. Opacity is a
// pure function of journey t: the street-local RTC_PLAY_WINDOW × the hero
// layer's own opacity (so it dissolves with the street into THE BAND).
import { useEffect, useRef } from 'react';
import type { ScrollTimeline } from '../../timeline/scrollTimeline';
import { anchorOpacity } from '../../pockets/mug';
import { RTC_INVITE_CONTENT } from '../../pockets/rtcInvite';
import { RTC_PLAY_WINDOW, heroLayerOpacity, streetProgress } from './neighborhoodRig';

/** Screen-px below the glint point where the pill's top edge sits. */
const PILL_DROP_PX = 30;
/** Minimum gap between the pill and either viewport edge. */
const EDGE_PX = 12;

export function RtcPlayLink({
  timeline,
  anchor,
}: {
  timeline: ScrollTimeline | null;
  anchor: { x: number; y: number; inFrame: boolean };
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  useEffect(() => {
    if (!timeline) return;
    const apply = (value: number) => {
      const el = ref.current;
      if (!el) return;
      const a = anchorRef.current;
      const opacity = a.inFrame
        ? anchorOpacity(streetProgress(value), RTC_PLAY_WINDOW) * heroLayerOpacity(value)
        : 0;
      const inert = opacity <= 0.05;
      el.style.opacity = opacity.toFixed(4);
      el.style.pointerEvents = inert ? 'none' : 'auto';
      el.tabIndex = inert ? -1 : 0;
      el.setAttribute('aria-hidden', inert ? 'true' : 'false');
      // Centered under the mailbox point, but never off the viewport: the
      // portrait settle puts the box near the right edge.
      const w = window.innerWidth;
      const half = el.offsetWidth / 2;
      const cx = Math.min(Math.max(a.x * w, half + EDGE_PX), w - half - EDGE_PX);
      el.style.left = `${cx.toFixed(1)}px`;
      el.style.top = `${(a.y * window.innerHeight + PILL_DROP_PX).toFixed(1)}px`;
    };
    apply(timeline.value());
    return timeline.onFrame(apply);
  }, [timeline]);

  return (
    <a
      ref={ref}
      className="film-pill rtc-play"
      href={RTC_INVITE_CONTENT.linkHref}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
      aria-hidden="true"
    >
      <span className="film-pill-row">
        <span className="film-pill-icon" aria-hidden="true">
          ▶
        </span>
        <span className="film-pill-label">Play Royal Tara Cove</span>
      </span>
      <span className="film-pill-sub">the real game · free · in your browser</span>
    </a>
  );
}
