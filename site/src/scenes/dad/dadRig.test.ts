// Contract tests for THE DAD's rig. Pins:
//   frames = f(scroll)            -> purity
//   exact handoff from THE BUILDER -> zero-jump camera continuity at
//                                     t = DAD_START
//   the light-driven transition   -> both photos are genuinely faint at the
//                                     transition bloom's own peak (the
//                                     choreography claim made numeric, not
//                                     just eyeballed)
//   the scene ends cleanly        -> both photos dissolved before the tail,
//                                     camera lands at a documented pose
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { cameraPose as builderCameraPose, BUILDER_END } from '../builder/builderRig';
import { REST_Z } from '../drummer/drummerRig';
import {
  DAD_END,
  SPARKLER_ASPECT,
  SWING_ASPECT,
  anyDadVisible,
  cameraPose,
  glowAnchor,
  glowState,
  sceneActive,
  sparklerLayout,
  sparklerOpacity,
  swingLayout,
  swingOpacity,
  windowPulse,
} from './dadRig';

const [START, END] = SEGMENTS.dad;

describe('handoff from THE BUILDER', () => {
  it('cameraPose(DAD_START) is byte-identical to BUILDER_END', () => {
    expect(cameraPose(START)).toEqual(BUILDER_END);
  });

  it('cameraPose(DAD_START) is byte-identical to builderRig.cameraPose(DAD_START)', () => {
    expect(cameraPose(START)).toEqual(builderCameraPose(START, false));
  });

  it('stays within float noise just inside the segment (p~0 collapses every delta to ~zero)', () => {
    const got = cameraPose(START + 1e-9);
    expect(got.x).toBeCloseTo(BUILDER_END.x, 9);
    expect(got.y).toBeCloseTo(BUILDER_END.y, 9);
    expect(got.z).toBeCloseTo(BUILDER_END.z, 9);
  });

  it('reduced motion pins the camera at the site-wide rest pose, matching every other scene', () => {
    expect(cameraPose(START, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose((START + END) / 2, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose(END, true)).toEqual({ x: 0, y: 0, z: REST_Z });
  });
});

describe('camera purity + range', () => {
  it('is a pure function of t', () => {
    const a = cameraPose(0.3);
    const b = cameraPose(0.3);
    expect(a).toEqual(b);
  });

  it('never crosses the photo plane (camera.z always > 0, the mesh z)', () => {
    for (let t = START; t <= END + 0.02; t += 0.005) {
      expect(cameraPose(t).z).toBeGreaterThan(0);
    }
  });

  it('DAD_END is documented and finite, ready for Scene 4 to compose from', () => {
    expect(Number.isFinite(DAD_END.x)).toBe(true);
    expect(Number.isFinite(DAD_END.y)).toBe(true);
    expect(Number.isFinite(DAD_END.z)).toBe(true);
    expect(DAD_END.z).toBeGreaterThan(0);
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
    expect(windowPulse(0.05, 0.1, 0.3)).toBe(0);
    expect(windowPulse(0.35, 0.1, 0.3)).toBe(0);
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

function t(p: number): number {
  return START + p * (END - START);
}

describe('sparklerOpacity / swingOpacity', () => {
  it('are both 0 well outside the segment', () => {
    expect(sparklerOpacity(0)).toBe(0);
    expect(sparklerOpacity(1)).toBe(0);
    expect(swingOpacity(0)).toBe(0);
    expect(swingOpacity(1)).toBe(0);
  });

  it('sparkler rises to fully opaque, holds, then yields — never negative or >1', () => {
    let sawFull = false;
    for (let p = 0; p <= 1; p += 0.002) {
      const o = sparklerOpacity(t(p));
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      if (o >= 0.999) sawFull = true;
    }
    expect(sawFull).toBe(true);
  });

  it('swing rises to fully opaque, holds, then dissolves — never negative or >1', () => {
    let sawFull = false;
    for (let p = 0; p <= 1; p += 0.002) {
      const o = swingOpacity(t(p));
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      if (o >= 0.999) sawFull = true;
    }
    expect(sawFull).toBe(true);
  });

  it('sparkler is fully opaque well before swing ever appears (no premature overlap)', () => {
    expect(sparklerOpacity(t(0.2))).toBeCloseTo(1, 6);
    expect(swingOpacity(t(0.2))).toBe(0);
  });

  it('swing is fully opaque well after sparkler is fully gone (no lingering overlap)', () => {
    expect(swingOpacity(t(0.75))).toBeCloseTo(1, 6);
    expect(sparklerOpacity(t(0.75))).toBe(0);
  });

  it('the light-driven transition: both photos are genuinely faint at the bloom peak (p=0.48)', () => {
    // The choreography claim (docs/v2-direction.md + the scene brief): the
    // transition is light-led, not a crossfade with extra steps — at the
    // glow's own peak neither photo should read as "the picture," only the
    // bloom. 0.15 is a generous ceiling (both measure well under it).
    expect(sparklerOpacity(t(0.48))).toBeLessThan(0.15);
    expect(swingOpacity(t(0.48))).toBeLessThan(0.15);
  });
});

describe('glowState', () => {
  it('is 0 outside both blooms', () => {
    expect(glowState(t(0.25)).opacity).toBe(0); // between the two blooms
    expect(glowState(t(0.7)).opacity).toBe(0); // well after the transition bloom
  });

  it('peaks at the arrival bloom (p=0.08) and the transition bloom (p=0.48)', () => {
    expect(glowState(t(0.08)).opacity).toBeCloseTo(1, 6);
    expect(glowState(t(0.48)).opacity).toBeCloseTo(1, 6);
  });

  it('the arrival bloom leads the sparkler photo (nonzero glow while the photo is still fully transparent)', () => {
    // At p=0.01 the glow is already rising (ARRIVAL_GLOW starts at p=0) but
    // sparklerOpacity's own fade-in hasn't started yet (SPARKLER_FADE_IN
    // starts at p=0.02) — "the light literally leads the image in."
    expect(glowState(t(0.01)).opacity).toBeGreaterThan(0);
    expect(sparklerOpacity(t(0.01))).toBe(0);
  });

  it('the transition bloom is scaled larger than the arrival bloom (the signature moment reads bigger)', () => {
    expect(glowState(t(0.08)).scale).toBeLessThan(glowState(t(0.48)).scale);
  });

  it('never negative or above 1 across a dense sweep', () => {
    for (let p = 0; p <= 1; p += 0.002) {
      const g = glowState(t(p));
      expect(g.opacity).toBeGreaterThanOrEqual(0);
      expect(g.opacity).toBeLessThanOrEqual(1);
    }
  });
});

describe('anyDadVisible', () => {
  it('matches whichever of {sparkler, swing, glow} is visible', () => {
    expect(anyDadVisible(0)).toBe(false);
    expect(anyDadVisible(t(0.2))).toBe(true);
    expect(anyDadVisible(t(0.48))).toBe(true); // the glow alone, if the photos have dipped
    expect(anyDadVisible(1)).toBe(false);
  });
});

describe('layouts', () => {
  const DESKTOP = { w: 1600, h: 1000 };
  const PORTRAIT = { w: 390, h: 844 };

  it('are pure functions of viewport, independent of t', () => {
    const a = sparklerLayout(DESKTOP.w, DESKTOP.h);
    const b = sparklerLayout(DESKTOP.w, DESKTOP.h);
    expect(a).toEqual(b);
  });

  it('match their own declared aspect ratio', () => {
    const s = sparklerLayout(DESKTOP.w, DESKTOP.h);
    expect(s.rect.width / s.rect.height).toBeCloseTo(SPARKLER_ASPECT, 6);
    const w = swingLayout(DESKTOP.w, DESKTOP.h);
    expect(w.rect.width / w.rect.height).toBeCloseTo(SWING_ASPECT, 6);
  });

  it('switch to the portrait composition below the landscape threshold', () => {
    expect(sparklerLayout(DESKTOP.w, DESKTOP.h).portrait).toBe(false);
    expect(sparklerLayout(PORTRAIT.w, PORTRAIT.h).portrait).toBe(true);
  });

  it('both photos stay reasonably framed (positive width/height at every sampled viewport)', () => {
    const viewports = [DESKTOP, PORTRAIT, { w: 2200, h: 1238 }, { w: 428, h: 926 }];
    for (const { w, h } of viewports) {
      expect(sparklerLayout(w, h).rect.width).toBeGreaterThan(0);
      expect(sparklerLayout(w, h).rect.height).toBeGreaterThan(0);
      expect(swingLayout(w, h).rect.width).toBeGreaterThan(0);
      expect(swingLayout(w, h).rect.height).toBeGreaterThan(0);
    }
  });
});

describe('glowAnchor', () => {
  it('is a pure function of viewport', () => {
    expect(glowAnchor(1600, 1000)).toEqual(glowAnchor(1600, 1000));
  });

  it('sits inside the sparkler photo\'s own world footprint', () => {
    const lay = sparklerLayout(1600, 1000);
    const anchor = glowAnchor(1600, 1000);
    const worldWidth = lay.meshScale;
    const worldHeight = lay.meshScale / SPARKLER_ASPECT;
    expect(Math.abs(anchor.x - lay.meshX)).toBeLessThan(worldWidth);
    expect(Math.abs(anchor.y - lay.meshY)).toBeLessThan(worldHeight);
  });
});
