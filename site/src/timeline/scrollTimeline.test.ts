// Task 1 specs for the Scroll=Travel core (the grammar every scene consumes).
// All tests drive the timeline through its test seam (injectable scroll source
// + manual stepping) — no browser, no rAF, no DOM.
import { describe, expect, it } from 'vitest';
import { createScrollTimeline, type ScrollSource } from './scrollTimeline';
import { SEGMENTS, segmentProgress, JOURNEY_PX, SEGMENT_PX, px } from './segments';
import { readFileSync } from 'node:fs';

/** Step the timeline n times at a fixed frame interval, tracking extremes. */
function run(
  tl: ReturnType<typeof createScrollTimeline>,
  steps: number,
  dtMs = 16,
): { min: number; max: number } {
  let min = tl.value();
  let max = tl.value();
  for (let i = 0; i < steps; i++) {
    tl.stepForTest(dtMs);
    const v = tl.value();
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

describe('createScrollTimeline', () => {
  it('converges to the target without overshoot', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    const { max } = run(tl, 300); // 300 × 16ms ≈ 4.8s
    expect(tl.value()).toBeGreaterThan(0.999);
    expect(max).toBeLessThanOrEqual(1);
    tl.dispose();
  });

  it('reverses symmetrically: 0 → 1 → 0 returns home with no oscillation past bounds', () => {
    const EPSILON = 1e-3;
    const tl = createScrollTimeline({ damping: 5 });

    // Out: converge essentially fully.
    tl.setTargetForTest(1);
    const out = run(tl, 300);
    expect(tl.value()).toBeGreaterThan(0.999);

    // Back: same damping, same law, opposite direction.
    tl.setTargetForTest(0);
    const back = run(tl, 300);
    expect(tl.value()).toBeLessThan(EPSILON);

    // At no point did the journey leave [0, 1] (no over/undershoot, no ringing).
    expect(out.min).toBeGreaterThanOrEqual(0);
    expect(out.max).toBeLessThanOrEqual(1);
    expect(back.min).toBeGreaterThanOrEqual(0);
    expect(back.max).toBeLessThanOrEqual(1);
  });

  it('stays in bounds when the target flips mid-flight (scrub reversal)', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    run(tl, 25); // mid-flight: still carrying velocity toward 1
    tl.setTargetForTest(0);
    const back = run(tl, 400);
    expect(tl.value()).toBeLessThan(1e-3);
    expect(back.min).toBeGreaterThanOrEqual(0);
    expect(back.max).toBeLessThanOrEqual(1);
    tl.dispose();
  });

  it('keeps value in [0,1] with realistic positive damping even chasing a target that retreats mid-flight', () => {
    // Review finding: `value()` was never clamped, so the "no overshoot"
    // guarantee only covered the trajectories the original specs happened
    // to exercise. Direct simulation for this fix (see the fix report: a
    // closed-form proof, a 200k-trial random fuzz, a simulated-annealing
    // adversarial search, and a 2M-step long run) shows the reviewer's own
    // literal example — chase target=1 with realistic *positive* damping,
    // then retreat the target slightly while velocity is still carried —
    // cannot actually leave [0,1] with this integrator: its exact solution
    // is a convex combination of past target values, which are always
    // clamped to [0,1] themselves, so the follower can never exceed the
    // highest (or undercut the lowest) target it has ever chased. The
    // clamp inside step() (see its comment) remains as defense-in-depth
    // regardless.
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    run(tl, 10); // carries significant velocity toward 1
    tl.setTargetForTest(0.97); // the retreat, while still carrying it
    const after = run(tl, 8);
    expect(after.max).toBeLessThanOrEqual(1);
    expect(after.min).toBeGreaterThanOrEqual(0);
    tl.dispose();
  });

  it('rejects non-positive or non-finite damping at construction, closing the root cause outright', () => {
    // What the pre-fix version of the test above actually demonstrated: with
    // no runtime validation, a non-positive `damping` turned the
    // "critically damped" spring into an unbounded internal amplifier (only
    // the output clamp contained it — see step()'s comment). Rather than
    // leaving that reachable and relying solely on the clamp, construction
    // now refuses to create a timeline with an invalid damping at all —
    // this is the same defect, closed at the source instead of papered over
    // downstream. `damping: -5` (the value the old test used to reach the
    // runaway state) now throws immediately instead of ever integrating.
    const badDampings = [0, -5, NaN, Infinity, -Infinity];
    for (const damping of badDampings) {
      expect(() => createScrollTimeline({ damping })).toThrow(/damping/i);
    }
  });

  it('derives target from an injected scroll source, clamped 0..1', () => {
    let scrollY = 0;
    const source: ScrollSource = {
      scrollY: () => scrollY,
      maxScroll: () => 8000,
    };
    const tl = createScrollTimeline({ damping: 5, scrollSource: source });

    scrollY = 2000;
    tl.stepForTest(16);
    expect(tl.target()).toBeCloseTo(0.25, 10);

    scrollY = 9999; // past the end (rubber-banding etc.) — target clamps
    tl.stepForTest(16);
    expect(tl.target()).toBe(1);

    scrollY = -50; // overscroll bounce at the top
    tl.stepForTest(16);
    expect(tl.target()).toBe(0);
    tl.dispose();
  });

  it('notifies onFrame subscribers each step and honors unsubscribe + dispose', () => {
    const tl = createScrollTimeline({ damping: 5 });
    const seen: Array<[number, number]> = [];
    const off = tl.onFrame((value, target) => seen.push([value, target]));

    tl.setTargetForTest(1);
    tl.stepForTest(16);
    expect(seen).toHaveLength(1);
    expect(seen[0][1]).toBe(1);
    expect(seen[0][0]).toBeGreaterThan(0);
    expect(seen[0][0]).toBeLessThan(1);

    off();
    tl.stepForTest(16);
    expect(seen).toHaveLength(1);

    tl.dispose();
    const before = tl.value();
    tl.stepForTest(16); // stepping a disposed timeline is inert
    expect(tl.value()).toBe(before);
  });
});

describe('hold / release — the pocket system\'s freeze primitive (Task 5)', () => {
  it('freezes value and stops onFrame notifications while held; target may still move underneath it', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    run(tl, 60); // in flight, not yet settled
    const frozen = tl.value();
    expect(frozen).toBeGreaterThan(0);
    expect(frozen).toBeLessThan(1);

    let frameCount = 0;
    tl.onFrame(() => frameCount++);

    tl.hold();
    // The visitor could still scroll the real page while a pocket sits open
    // (hold() never blocks scroll — see its doc comment); simulate that.
    tl.setTargetForTest(0);
    const held = run(tl, 60);
    expect(tl.value()).toBe(frozen); // exactly frozen, not just "close"
    expect(held.min).toBe(frozen);
    expect(held.max).toBe(frozen);
    expect(frameCount).toBe(0); // nothing notified while held

    tl.release();
    tl.stepForTest(16);
    expect(frameCount).toBe(1);
    expect(tl.value()).not.toBe(frozen); // moving again immediately...

    // ...and, given time, toward the target (now 0) rather than staying put
    // or continuing to blow past 1 — the carried (still-positive, pre-hold)
    // velocity means the very first step or two can still drift the same
    // direction it was already going before settling into the reversal, so
    // this checks the trend over more steps rather than the very next one.
    run(tl, 300);
    expect(tl.value()).toBeLessThan(frozen);
    tl.dispose();
  });

  it('hold() and release() are each idempotent', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    tl.hold();
    tl.hold(); // no-op — still held
    const before = tl.value();
    run(tl, 30);
    expect(tl.value()).toBe(before);

    tl.release();
    tl.release(); // no-op — already released
    run(tl, 30);
    expect(tl.value()).toBeGreaterThan(before);
    tl.dispose();
  });

  it('release() before any hold() is a harmless no-op', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    tl.release();
    const { max } = run(tl, 300);
    expect(tl.value()).toBeGreaterThan(0.999);
    expect(max).toBeLessThanOrEqual(1);
    tl.dispose();
  });
});

describe('segmentProgress', () => {
  it('clamps to 0 before the segment and 1 after it', () => {
    expect(segmentProgress(0, SEGMENTS.builder)).toBe(0);
    expect(segmentProgress(SEGMENTS.builder[0] - 0.01, SEGMENTS.builder)).toBe(0);
    expect(segmentProgress(0.5, SEGMENTS.builder)).toBe(1);
    expect(segmentProgress(1, SEGMENTS.builder)).toBe(1);
    expect(segmentProgress(-3, SEGMENTS.drummer)).toBe(0);
    expect(segmentProgress(7, SEGMENTS.keeper)).toBe(1);
  });

  it('is linear inside the segment with exact endpoints', () => {
    const [ns, ne] = SEGMENTS.neighborhood;
    expect(segmentProgress(ns, SEGMENTS.neighborhood)).toBe(0);
    expect(segmentProgress((ns + ne) / 2, SEGMENTS.neighborhood)).toBeCloseTo(0.5, 10);
    expect(segmentProgress(ne, SEGMENTS.neighborhood)).toBe(1);
    const [bs, be] = SEGMENTS.builder;
    expect(segmentProgress((bs + be) / 2, SEGMENTS.builder)).toBeCloseTo(0.5, 10);
  });

  it('covers the whole journey with the v2 eight-scene pixel-weighted map (see segments.ts)', () => {
    // The continuity re-cut of 2026-09-01: weights in scroll pixels, bounds
    // derived; the jewel keeps the film's center, TEASPANKS is the new
    // chapter between THE BAND and THE WEIRD ONES. JOURNEY_PX must equal
    // --journey-length in index.html + styles.css (pinned below).
    expect(JOURNEY_PX).toBe(17200);
    expect(SEGMENT_PX).toEqual({
      drummer: 1500,
      builder: 1500,
      dad: 1650,
      neighborhood: 5300,
      band: 1650,
      teaspanks: 2000,
      weird: 1650,
      keeper: 1950,
    });
    expect(SEGMENTS.drummer).toEqual([0, 1500 / 17200]);
    expect(SEGMENTS.neighborhood[0]).toBeCloseTo(4650 / 17200, 15);
    expect(SEGMENTS.neighborhood[1]).toBeCloseTo(9950 / 17200, 15);
    expect(SEGMENTS.teaspanks[0]).toBeCloseTo(11600 / 17200, 15);
    expect(SEGMENTS.teaspanks[1]).toBeCloseTo(13600 / 17200, 15);
    expect(SEGMENTS.keeper[1]).toBe(1);
    expect(px(1720)).toBeCloseTo(0.1, 15);
    // The CSS custom property is the same number, in both copies.
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(css).toContain(`--journey-length: ${JOURNEY_PX}px;`);
    expect(html).toContain(`--journey-length: ${JOURNEY_PX}px;`);
    // Segments tile the journey exactly — no gaps, no overlaps.
    const names = Object.keys(SEGMENTS) as Array<keyof typeof SEGMENTS>;
    expect(SEGMENTS[names[0]][0]).toBe(0);
    expect(SEGMENTS[names[names.length - 1]][1]).toBe(1);
    for (let i = 1; i < names.length; i++) {
      expect(SEGMENTS[names[i - 1]][1]).toBe(SEGMENTS[names[i]][0]);
    }
  });
});
