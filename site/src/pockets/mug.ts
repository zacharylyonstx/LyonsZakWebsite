// The desk segment's pocket content — "the mug pocket teaches stop+interact"
// (docs/content-edit.md §"THE REAL DESK"). Pure data, no JSX (mirrors
// deskChoreography.ts's own split from DeskScene.tsx): DeskScene.tsx wires
// this into a <Pocket> + <PocketCard>.
//
// ASSET STATUS: no real photo exists yet. Searched hard before shipping a
// placeholder (per CLAUDE.md's "search the Photos library hard before
// asking Zak to recreate any asset") — see
// site/assets-src/manifest.desk.json's `mug` entry for the full search
// record (desk-photo.jpg inspected pixel-by-pixel, osxphotos Mug/Coffee Cup
// label queries, ai_caption text search, filesystem search) and
// docs/production-requests.md#mug-photo for the open request. The content
// edit itself (docs/content-edit.md §3) flags this as Zak's pick to make —
// "any real desk object with a story ⚠ Zak picks the object and tells us
// its line" — so this ships a clearly-marked, honest placeholder rather
// than inventing an object or a stock substitute for either the photo or
// the line.

export type MugImage =
  | { kind: 'placeholder'; alt: string }
  | { kind: 'photo'; src: string; alt: string };

export interface MugContent {
  title: string;
  /** Accessible name for the glint control itself. */
  glintLabel: string;
  image: MugImage;
  /** The one self-introducing voice line (brief: one ILLUSTRATIVE caption
   *  line, self-introducing for a stranger). Illustrative until Zak
   *  supplies the real object and his own words — see
   *  docs/production-requests.md#mug-photo. */
  caption: string;
}

export const MUG_CONTENT: MugContent = {
  title: 'The mug',
  glintLabel: 'Look closer — something on the desk',
  image: {
    kind: 'placeholder',
    alt: 'Placeholder — the real photo is pending. See docs/production-requests.md.',
  },
  /* ILLUSTRATIVE */
  caption: 'emotional support hardware. do not refactor.',
};

/** A pocket's screen-space glint anchor: where it sits (viewport fractions,
 *  0..1, origin top-left — see Pocket.tsx's PocketGlintAt) and the
 *  desk-local-progress window (same [fadeInStart, fadeInEnd, fadeOutStart,
 *  fadeOutEnd] envelope shape as deskChoreography.ts's AnnotationBeat) it's
 *  visible/interactive across. A fadeOut pair safely beyond 1 means "never
 *  fades out within this segment" (see the note on each constant below). */
export interface PocketScreenAnchor {
  position: readonly [x: number, y: number];
  window: readonly [number, number, number, number];
}

// ---------------------------------------------------------------------------
// Landscape/desktop anchor. MEASURED, not guessed — same discipline
// deskChoreography.ts's MONITOR_QUAD_PX uses for the monitor quad's own
// corners: a real screenshot of the running scene, coordinates read off it
// by hand, documented here as the source of truth.
//
// Measured at viewport 1440x900, `npm run dev` + `?debug=1`, scrolled to
// journey t=0.37 (desk-local progress 0.964 per the debug readout — the
// camera has essentially arrived at DESK_END_CAMERA: deskChoreography.ts's
// computeDeskCamera uses a single smoothstep ease over the whole segment,
// whose slope is zero at p=1, so the framing is momentarily stable here —
// see task-5-report.md for the calibration screenshot). The point (895,
// 705) in that 1440x900 screenshot lands on a clean, empty patch of desk
// surface just left of the tissue box, in front of the monitor-stand base
// curve — a plausible, uncluttered rest spot for an object, not a claim
// that anything is physically sitting there in the real photo (none is —
// see MUG_CONTENT's header comment).
// ---------------------------------------------------------------------------
export const MUG_GLINT_LANDSCAPE: PocketScreenAnchor = {
  position: [895 / 1440, 705 / 900],
  // Fades in once the camera has nearly settled (p ∈ [0.86, 0.94]). The
  // fade-out (Task 7, closing the old [2, 3] placeholder): the hero layer
  // begins its crossfade over the desk exactly at the segment boundary
  // (desk-local p = 1 — see heroChoreography.ts's HERO_HANDOFF_END), so the
  // glint bows out across [0.97, 1.0] and is fully gone AT the boundary —
  // never floating over the arriving photograph, in either scrub direction.
  // (The desk camera itself stays frozen at DESK_END_CAMERA past the
  // boundary, so the anchor remains valid for the whole fade.)
  window: [0.86, 0.94, 0.97, 1.0],
};

// ---------------------------------------------------------------------------
// Portrait/mobile anchor. Measured at viewport 390x844, same method, but at
// journey t=0.12 (desk-local progress 0.071 — near the START of the
// segment instead of the end): DESK_END_CAMERA_PORTRAIT's "vertical pan up
// to the monitor" framing (see deskChoreography.ts) leaves almost none of
// the open desk surface in view by the time it settles, so there's no
// stable late-segment framing to anchor against on a phone. Near the
// start, the desk clutter is still in frame (both endpoints of a single
// smoothstep have zero slope, same reasoning as the landscape anchor,
// just applied to the other end) — point (230, 465) in that 390x844
// screenshot lands near the monitor-stand base, the least-cluttered patch
// available in that framing. This window is deliberately narrow and closes
// early (before the vertical pan has moved far enough to invalidate the
// anchor) — see docs/production-requests.md#mug-glint-portrait for the
// known limitation this leaves (a tighter, more approximate anchor than
// the landscape one) and why it's a documented gap rather than a blocker.
// ---------------------------------------------------------------------------
export const MUG_GLINT_PORTRAIT: PocketScreenAnchor = {
  position: [230 / 390, 465 / 844],
  window: [0.02, 0.05, 0.1, 0.16],
};

/** Same [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] envelope
 *  deskChoreography.ts's beatOpacity implements — duplicated (not
 *  imported) because it's a tiny, generically useful pure function and
 *  pockets/ shouldn't have to depend on scenes/ for it. Kept here so any
 *  future pocket's screen anchor can reuse it too. */
export function anchorOpacity(
  p: number,
  window: readonly [number, number, number, number],
): number {
  const [inStart, inEnd, outStart, outEnd] = window;
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const smoothstep = (a: number, b: number, x: number) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const fadeIn = smoothstep(inStart, inEnd, p);
  const fadeOut = 1 - smoothstep(outStart, outEnd, p);
  return clamp01(Math.min(fadeIn, fadeOut));
}
