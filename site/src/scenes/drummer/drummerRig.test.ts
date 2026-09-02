// Contract tests for THE DRUMMER's rig — the scene draws every number from
// these pure functions, so the site's laws are pinned here:
//   frames = f(scroll)      -> purity / determinism
//   identity at rest        -> t=0 is the flat photo (camera at the
//                              displacement origin), the byte-sweep anchor
//   the scene ends cleanly  -> fully dissolved before the segment hands
//                              off to THE BUILDER's dusk breath
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { subtitleStateAt } from '../../film/Subtitle';
import { VOICE_LINES } from '../../film/voice';
import {
  cameraPose,
  cueOpacity,
  drummerProgress,
  layout,
  nameState,
  nameTagDip,
  photoOpacity,
  sceneActive,
  FG_HI,
  FG_LO,
  PHOTO_ASPECT,
  REST_Z,
} from './drummerRig';

const END = SEGMENTS.drummer[1];
const [VOICE_START, VOICE_END] = VOICE_LINES[0].window;

describe('identity at rest (t = 0)', () => {
  it('camera sits exactly at the displacement origin', () => {
    expect(cameraPose(0)).toEqual({ x: 0, y: 0, z: REST_Z });
  });

  it('portrait fully present, name unmoved and opaque', () => {
    expect(photoOpacity(0)).toBe(1);
    expect(nameState(0)).toEqual({ x: 0, y: 0, opacity: 1 });
    expect(cueOpacity(0)).toBe(1);
  });
});

describe('purity / determinism', () => {
  it('same t -> byte-same outputs', () => {
    for (const t of [0, 0.031, 0.077, 0.11, 0.5]) {
      expect(cameraPose(t)).toEqual(cameraPose(t));
      expect(nameState(t)).toEqual(nameState(t));
      expect(photoOpacity(t)).toBe(photoOpacity(t));
    }
  });

  it('layout is pure and keeps the photo aspect', () => {
    for (const [w, h] of [
      [1600, 1000],
      [1280, 800],
      [390, 844],
      [768, 1024],
    ]) {
      const a = layout(w, h);
      expect(a).toEqual(layout(w, h));
      expect(a.rect.width / a.rect.height).toBeCloseTo(PHOTO_ASPECT, 6);
      expect(a.meshScale).toBeGreaterThan(0);
      expect(a.depthScale).toBeGreaterThan(0);
    }
  });

  it('portrait viewports take the stacked branch', () => {
    expect(layout(390, 844).portrait).toBe(true);
    expect(layout(768, 1024).portrait).toBe(true);
    expect(layout(1600, 1000).portrait).toBe(false);
  });
});

describe('the exit is complete before the handoff', () => {
  it('photo and name fully dissolved by segment p=0.92', () => {
    const t92 = END * 0.92;
    expect(photoOpacity(t92)).toBeLessThan(0.001);
    expect(nameState(t92).opacity).toBeLessThan(0.05);
    expect(nameState(END).opacity).toBe(0);
    expect(photoOpacity(END)).toBe(0);
  });

  it('sceneActive gates all work outside the segment', () => {
    expect(sceneActive(0)).toBe(true);
    expect(sceneActive(END * 0.5)).toBe(true);
    expect(sceneActive(END + 0.01)).toBe(false);
    expect(sceneActive(0.5)).toBe(false);
  });

  it('fades are monotonic (no flicker on scrub)', () => {
    let prevPhoto = 2;
    let prevName = 2;
    for (let t = 0; t <= END + 0.001; t += 0.0005) {
      const p = photoOpacity(t);
      const n = nameState(t).opacity;
      expect(p).toBeLessThanOrEqual(prevPhoto + 1e-9);
      expect(n).toBeLessThanOrEqual(prevName + 1e-9);
      prevPhoto = p;
      prevName = n;
    }
  });
});

describe('choreography shape', () => {
  it('the camera pushes IN and PAST (z decreases, never past the photo plane)', () => {
    let prevZ = REST_Z + 1e-9;
    for (let t = 0; t <= END; t += 0.001) {
      const z = cameraPose(t).z;
      expect(z).toBeLessThanOrEqual(prevZ + 1e-9);
      expect(z).toBeGreaterThan(1);
      prevZ = z;
    }
  });

  it('reduced motion pins the camera and the name to rest — dissolve only', () => {
    for (const t of [0, 0.03, 0.07, 0.1]) {
      expect(cameraPose(t, true)).toEqual({ x: 0, y: 0, z: REST_Z });
      const ns = nameState(t, true);
      expect(ns.x).toBe(0);
      expect(ns.y).toBe(0);
      expect(ns.opacity).toBe(nameState(t, false).opacity);
    }
  });

  it('segment progress spans the drummer window', () => {
    expect(drummerProgress(0)).toBe(0);
    expect(drummerProgress(END)).toBe(1);
    expect(drummerProgress(END / 2)).toBeCloseTo(0.5, 9);
  });

  it('the occlusion band sits inside the depth histogram gap', () => {
    // flag mass < ~0.3, person/kit > ~0.5 (see drummerRig doc comment) —
    // the smoothstep band must live between them.
    expect(FG_LO).toBeGreaterThan(0.32);
    expect(FG_HI).toBeLessThan(0.5);
    expect(FG_HI).toBeGreaterThan(FG_LO);
  });
});

describe('nameTagDip (FINDING 1: the identity plate yields to the voice line)', () => {
  it('is fully visible at t=0 — matches the static index.html first paint', () => {
    expect(nameTagDip(0)).toBe(1);
  });

  it('is fully visible well outside the voice window', () => {
    expect(nameTagDip(0)).toBe(1);
    expect(nameTagDip(END)).toBe(1);
    expect(nameTagDip(1)).toBe(1);
  });

  it('is fully yielded (0) throughout the ENTIRE voice window, endpoints included', () => {
    for (let t = VOICE_START; t <= VOICE_END; t += 0.002) {
      expect(nameTagDip(t)).toBe(0);
    }
    expect(nameTagDip(VOICE_START)).toBe(0);
    expect(nameTagDip(VOICE_END)).toBe(0);
  });

  it('never has simultaneous nonzero opacity with the drummer voice line', () => {
    // The construction guarantee (see the function's doc comment): sample
    // densely across the whole segment and confirm the two envelopes are
    // never both > 0 at once, for the ACTUAL rendered subtitle envelope
    // (not just the window bounds).
    for (let t = 0; t <= END; t += 0.0005) {
      const dip = nameTagDip(t);
      const { index, opacity: voiceOpacity } = subtitleStateAt(t);
      if (index === 0 && voiceOpacity > 0) {
        expect(dip).toBe(0);
      }
    }
  });

  it('fades out monotonically approaching the window, flat 0 inside it', () => {
    let prev = 2;
    for (let t = 0; t <= VOICE_START; t += 0.0005) {
      const d = nameTagDip(t);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(nameTagDip(VOICE_START)).toBe(0);
  });

  it('fades back in monotonically leaving the window, flat 1 after', () => {
    let prev = -1;
    for (let t = VOICE_END; t <= END; t += 0.0005) {
      const d = nameTagDip(t);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = d;
    }
    expect(prev).toBe(1);
  });

  it('runs identically under reduced motion (no reducedMotion param — a scroll-position crossfade)', () => {
    // nameTagDip takes no reducedMotion flag by design (see doc comment) —
    // pin that it truly has none, so a future edit can't silently add an
    // early-return that would restore the collision for exactly the
    // visitors least equipped to be confused by it.
    expect(nameTagDip.length).toBe(1);
  });
});
