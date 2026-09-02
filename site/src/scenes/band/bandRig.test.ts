// Contract tests for THE BAND's rig. Pins:
//   frames = f(scroll)              -> purity
//   exact handoff from THE NEIGHBORHOOD -> zero-jump camera continuity at
//                                          t = BAND_START
//   the three-beat sequencing        -> each visual reaches full opacity in
//                                        its own beat and nowhere else,
//                                        adjacent beats overlap (cross-
//                                        dissolve, never a hard cut)
//   the scene ends cleanly           -> the practice photo dissolves before
//                                        the tail, camera lands at a
//                                        documented pose (BAND_END)
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { NEIGHBORHOOD_END } from '../neighborhood/neighborhoodRig';
import { REST_Z } from '../drummer/drummerRig';
import {
  BAND_END,
  GIG_ASPECT,
  GIG_END,
  PRACTICE_ASPECT,
  RECORD_ASPECT,
  RECORD_END,
  anyBandVisible,
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
  windowPulse,
} from './bandRig';

const [START, END] = SEGMENTS.band;

describe('handoff from THE NEIGHBORHOOD', () => {
  it('cameraPose(BAND_START) is byte-identical to NEIGHBORHOOD_END', () => {
    expect(cameraPose(START)).toEqual(NEIGHBORHOOD_END);
  });

  it('stays within float noise just inside the segment (b~0 collapses every delta to ~zero)', () => {
    const got = cameraPose(START + 1e-9);
    expect(got.x).toBeCloseTo(NEIGHBORHOOD_END.x, 9);
    expect(got.y).toBeCloseTo(NEIGHBORHOOD_END.y, 9);
    expect(got.z).toBeCloseTo(NEIGHBORHOOD_END.z, 9);
  });

  it('reduced motion pins the camera at the site-wide rest pose, matching every other scene', () => {
    expect(cameraPose(START, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose((START + END) / 2, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose(END, true)).toEqual({ x: 0, y: 0, z: REST_Z });
  });
});

describe('camera purity + range', () => {
  it('is a pure function of t', () => {
    const a = cameraPose(0.68);
    const b = cameraPose(0.68);
    expect(a).toEqual(b);
  });

  it('never crosses either photo plane (camera.z always > 0, the mesh z)', () => {
    for (let t = START; t <= END + 0.02; t += 0.005) {
      expect(cameraPose(t).z).toBeGreaterThan(0);
    }
  });

  it('BAND_END is documented and finite, ready for THE WEIRD ONES to compose from', () => {
    expect(Number.isFinite(BAND_END.x)).toBe(true);
    expect(Number.isFinite(BAND_END.y)).toBe(true);
    expect(Number.isFinite(BAND_END.z)).toBe(true);
    expect(BAND_END.z).toBeGreaterThan(0);
  });
});

describe('sceneActive', () => {
  it('is false before the segment and true at its exact start', () => {
    expect(sceneActive(START - 0.001)).toBe(false);
    expect(sceneActive(START)).toBe(true);
  });

  it('stays true through a short tail past the segment end, then false', () => {
    expect(sceneActive(END)).toBe(true);
    expect(sceneActive(END + 0.019)).toBe(true);
    expect(sceneActive(END + 0.05)).toBe(false);
  });
});

describe('windowPulse', () => {
  it('is exactly 0 at and outside both edges, exactly 1 at the midpoint', () => {
    expect(windowPulse(0.1, 0.1, 0.3)).toBe(0);
    expect(windowPulse(0.3, 0.1, 0.3)).toBe(0);
    expect(windowPulse(0.2, 0.1, 0.3)).toBeCloseTo(1, 9);
  });

  it('never goes negative or above 1 across a dense sweep', () => {
    for (let p = -0.2; p <= 1.2; p += 0.01) {
      const v = windowPulse(p, 0.1, 0.6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

/** journey t from segment-local progress b. */
function t(b: number): number {
  return START + b * (END - START);
}

describe('beat boundaries', () => {
  it('GIG_END and RECORD_END are ordered and strictly inside (0, 1)', () => {
    expect(GIG_END).toBeGreaterThan(0);
    expect(GIG_END).toBeLessThan(RECORD_END);
    expect(RECORD_END).toBeLessThan(1);
  });
});

describe('gigOpacity / recordOpacity / practiceOpacity', () => {
  it('all three are 0 well outside the segment', () => {
    expect(gigOpacity(0)).toBe(0);
    expect(gigOpacity(1)).toBe(0);
    expect(recordOpacity(0)).toBe(0);
    expect(recordOpacity(1)).toBe(0);
    expect(practiceOpacity(0)).toBe(0);
    expect(practiceOpacity(1)).toBe(0);
  });

  it('each rises to fully opaque, holds, then yields — never negative or >1', () => {
    for (const fn of [gigOpacity, recordOpacity, practiceOpacity]) {
      let sawFull = false;
      for (let b = 0; b <= 1; b += 0.002) {
        const o = fn(t(b));
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThanOrEqual(1);
        if (o >= 0.999) sawFull = true;
      }
      expect(sawFull).toBe(true);
    }
  });

  it('the gig is fully opaque inside beat 1, and the record has not yet arrived', () => {
    expect(gigOpacity(t(0.2))).toBeCloseTo(1, 6);
    expect(recordOpacity(t(0.2))).toBe(0);
    expect(practiceOpacity(t(0.2))).toBe(0);
  });

  it('the record is fully opaque inside beat 2, well clear of the gig and the practice photo', () => {
    expect(recordOpacity(t(0.58))).toBeCloseTo(1, 6);
    expect(gigOpacity(t(0.58))).toBe(0);
    expect(practiceOpacity(t(0.58))).toBe(0);
  });

  it('the practice photo is fully opaque inside beat 3, well after the record is gone', () => {
    expect(practiceOpacity(t(0.9))).toBeCloseTo(1, 6);
    expect(recordOpacity(t(0.9))).toBe(0);
  });

  it('practice dissolves fully by the segment end (no hard stop at the boundary)', () => {
    expect(practiceOpacity(END)).toBe(0);
  });

  it('adjacent beats cross-dissolve (a real overlap window), never share a hard cut', () => {
    // gig fade-out [0.33, 0.40] overlaps record fade-in [0.36, 0.47].
    expect(gigOpacity(t(0.37))).toBeGreaterThan(0);
    expect(recordOpacity(t(0.37))).toBeGreaterThan(0);
    // record fade-out [0.70, 0.78] overlaps practice fade-in [0.72, 0.82].
    expect(recordOpacity(t(0.75))).toBeGreaterThan(0);
    expect(practiceOpacity(t(0.75))).toBeGreaterThan(0);
  });
});

describe('anyBandVisible', () => {
  it('matches whichever of {gig, record, practice} is visible', () => {
    expect(anyBandVisible(0)).toBe(false);
    expect(anyBandVisible(t(0.2))).toBe(true);
    expect(anyBandVisible(t(0.58))).toBe(true);
    expect(anyBandVisible(t(0.9))).toBe(true);
    expect(anyBandVisible(1)).toBe(false);
  });
});

describe('layouts', () => {
  const DESKTOP = { w: 1600, h: 1000 };
  const PORTRAIT = { w: 390, h: 844 };

  it('are pure functions of viewport, independent of t', () => {
    expect(gigLayout(DESKTOP.w, DESKTOP.h)).toEqual(gigLayout(DESKTOP.w, DESKTOP.h));
    expect(recordLayout(DESKTOP.w, DESKTOP.h)).toEqual(recordLayout(DESKTOP.w, DESKTOP.h));
    expect(practiceLayout(DESKTOP.w, DESKTOP.h)).toEqual(practiceLayout(DESKTOP.w, DESKTOP.h));
  });

  it('match their own declared aspect ratio', () => {
    const g = gigLayout(DESKTOP.w, DESKTOP.h);
    expect(g.rect.width / g.rect.height).toBeCloseTo(GIG_ASPECT, 6);
    const r = recordLayout(DESKTOP.w, DESKTOP.h);
    expect(r.width / r.height).toBeCloseTo(RECORD_ASPECT, 6);
    const p = practiceLayout(DESKTOP.w, DESKTOP.h);
    expect(p.rect.width / p.rect.height).toBeCloseTo(PRACTICE_ASPECT, 6);
  });

  it('switch to the portrait composition below the landscape threshold', () => {
    expect(gigLayout(DESKTOP.w, DESKTOP.h).portrait).toBe(false);
    expect(gigLayout(PORTRAIT.w, PORTRAIT.h).portrait).toBe(true);
    expect(recordLayout(DESKTOP.w, DESKTOP.h).portrait).toBe(false);
    expect(recordLayout(PORTRAIT.w, PORTRAIT.h).portrait).toBe(true);
  });

  it('all three stay reasonably framed (positive width/height) at every sampled viewport', () => {
    const viewports = [DESKTOP, PORTRAIT, { w: 2200, h: 1238 }, { w: 428, h: 926 }];
    for (const { w, h } of viewports) {
      expect(gigLayout(w, h).rect.width).toBeGreaterThan(0);
      expect(gigLayout(w, h).rect.height).toBeGreaterThan(0);
      expect(recordLayout(w, h).width).toBeGreaterThan(0);
      expect(recordLayout(w, h).height).toBeGreaterThan(0);
      expect(practiceLayout(w, h).rect.width).toBeGreaterThan(0);
      expect(practiceLayout(w, h).rect.height).toBeGreaterThan(0);
    }
  });

  it('the record sits nearer the camera than the flat photo planes (z=0)', () => {
    expect(recordLayout(DESKTOP.w, DESKTOP.h).z).toBeGreaterThan(0);
  });
});

describe('projectPoint + recordAffordanceAnchor', () => {
  const cam = { x: 0, y: 0, z: 5 };

  it('projects the world origin to the viewport center', () => {
    const p = projectPoint({ x: 0, y: 0, z: 0 }, cam, 1600, 1000);
    expect(p.x).toBeCloseTo(800, 6);
    expect(p.y).toBeCloseTo(500, 6);
    expect(p.depth).toBeCloseTo(5, 6);
  });

  it('recordAffordanceAnchor is a pure function of viewport and projects to finite screen coordinates', () => {
    const a1 = recordAffordanceAnchor(1600, 1000);
    const a2 = recordAffordanceAnchor(1600, 1000);
    expect(a1).toEqual(a2);
    const screen = projectPoint(a1, cameraPose(t(0.58)), 1600, 1000);
    expect(Number.isFinite(screen.x)).toBe(true);
    expect(Number.isFinite(screen.y)).toBe(true);
    expect(screen.depth).toBeGreaterThan(0);
  });

  it('the anchor sits below the record panel\'s own vertical center', () => {
    const lay = recordLayout(1600, 1000);
    const anchor = recordAffordanceAnchor(1600, 1000);
    expect(anchor.y).toBeLessThan(lay.y);
  });
});
