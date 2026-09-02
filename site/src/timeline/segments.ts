// The journey's segment map: which stretch of the damped timeline (0..1)
// belongs to which scene. These names and bounds are the contract every scene
// consumes — change them here and only here.
//
// v2 (2026-08-29): the scroll film of docs/v2-direction.md. Each scene is one
// true thing about Zak; THE NEIGHBORHOOD is the jewel and gets the film's
// center, because it contains the crossing (real backyard photograph → live
// Royal Tara Cove world), the site's second signature.
//
// CONTINUITY RE-CUT (2026-09-01): the map is now PIXEL-WEIGHTED. Each scene
// declares how many scroll pixels it owns; the 0..1 bounds are derived, and
// JOURNEY_PX is the single source `--journey-length` (index.html +
// styles.css) must match — segments.test.ts pins that. Adding TEASPANKS (a
// new chapter between THE BAND and THE WEIRD ONES) lengthened the journey
// 15,000 → 17,200px (the street settle also gained 200px for its two closing lines) while every pre-existing scene kept its exact pixel
// budget, so nothing got faster or slower. Journey-ABSOLUTE surfaces
// (src/film/voice.ts windows, neighborhoodRig's beat constants, the qa +
// record scripts' stops) are expressed as segment start + pixel offset via
// px() below, never as bare fractions — retune them WITH these weights.
//
// Every scene rig animates in segment-LOCAL progress, so the boundary poses
// (each scene composes from its predecessor's exported END constant) are
// preserved by construction.

/** [start, end] on the 0..1 journey timeline. */
export type Segment = readonly [start: number, end: number];

/** Scroll pixels each scene owns, in film order. */
export const SEGMENT_PX = {
  /** THE DRUMMER — Texas-flag drum portrait; ZAK LYONS set huge behind him. */
  drummer: 1500,
  /** THE BUILDER — Kaelbot + MilieuOS: shipped, real work. */
  builder: 1500,
  /** THE DAD — sparkler at blue hour → rope-swing cowboy. */
  dad: 1650,
  /** THE NEIGHBORHOOD (the jewel) — playhouse → backyard photo → THE
   *  CROSSING into live Royal Tara Cove → street → the LYONS mailbox. */
  neighborhood: 5300,
  /** THE BAND — barn-gig night; the real Lost in Austin record. */
  band: 1650,
  /** TEASPANKS — the music video he made from Luke's drive-through song. */
  teaspanks: 2000,
  /** THE WEIRD ONES — MF-1 PCB macro, CenTex banner, the EAS broadcast TV. */
  weird: 1650,
  /** THE KEEPER — TEXAS sign at dusk; the plaque for Luke; day one → now. */
  keeper: 1950,
} as const;

export type SegmentName = keyof typeof SEGMENT_PX;

/** The film's total length in scroll pixels — must equal `--journey-length`. */
export const JOURNEY_PX: number = Object.values(SEGMENT_PX).reduce(
  (a, b) => a + b,
  0,
);

/** A pixel count as a journey-t width. */
export function px(n: number): number {
  return n / JOURNEY_PX;
}

function deriveSegments(): Record<SegmentName, Segment> {
  const out = {} as Record<SegmentName, Segment>;
  let acc = 0;
  for (const name of Object.keys(SEGMENT_PX) as SegmentName[]) {
    const start = acc / JOURNEY_PX;
    acc += SEGMENT_PX[name];
    // The last segment ends at exactly 1 (no float residue).
    const end = acc === JOURNEY_PX ? 1 : acc / JOURNEY_PX;
    out[name] = [start, end];
  }
  return out;
}

export const SEGMENTS: Record<SegmentName, Segment> = deriveSegments();

/**
 * Local progress through a segment: 0 before it, linear 0..1 inside it,
 * 1 after it. Scenes animate exclusively from this.
 */
export function segmentProgress(t: number, seg: Segment): number {
  const [start, end] = seg;
  if (end <= start) return t >= end ? 1 : 0; // degenerate guard: never NaN
  const p = (t - start) / (end - start);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}
