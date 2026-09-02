// Contract tests for THE WEIRD ONES's rig. Pins:
//   frames = f(scroll)              -> purity
//   exact handoff from THE BAND     -> zero-jump camera continuity at
//                                       t = WEIRD_START
//   the two-beat sequencing         -> both beat-1 panels reach full
//                                       opacity in their own beat and
//                                       nowhere else; the TV owns beat 2
//   the scene ends cleanly          -> the TV dissolves toward the tail,
//                                       camera lands at a documented pose
//                                       (WEIRD_END)
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { TEASPANKS_END } from '../teaspanks/teaspanksRig';
import { REST_Z } from '../drummer/drummerRig';
import {
  BANNER_ASPECT,
  CENTEX_END,
  MF1_ASPECT,
  SCREEN_MARGIN,
  TV_OUTER_ASPECT,
  WEIRD_END,
  anyWeirdVisible,
  cameraPose,
  isPortrait,
  mf1CaptionAnchor,
  projectPoint,
  sceneActive,
  tvGlintAnchor,
  tvGlintOpacity,
  tvLayout,
  tvOpacity,
  weirdGlintAt,
  weirdPanelLayout,
  weirdPanelOpacity,
} from './weirdRig';

const [START, END] = SEGMENTS.weird;

/** journey t from segment-local progress b. */
function t(b: number): number {
  return START + b * (END - START);
}

describe('handoff from THE BAND', () => {
  it('cameraPose(WEIRD_START) is byte-identical to TEASPANKS_END', () => {
    expect(cameraPose(START)).toEqual(TEASPANKS_END);
  });

  it('stays within float noise just inside the segment', () => {
    const got = cameraPose(START + 1e-9);
    expect(got.x).toBeCloseTo(TEASPANKS_END.x, 9);
    expect(got.y).toBeCloseTo(TEASPANKS_END.y, 9);
    expect(got.z).toBeCloseTo(TEASPANKS_END.z, 9);
  });

  it('reduced motion pins the camera at the site-wide rest pose', () => {
    expect(cameraPose(START, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose((START + END) / 2, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose(END, true)).toEqual({ x: 0, y: 0, z: REST_Z });
  });
});

describe('camera purity + range', () => {
  it('is a pure function of t', () => {
    const a = cameraPose(0.8);
    const b = cameraPose(0.8);
    expect(a).toEqual(b);
  });

  it('camera.z always stays positive across the whole segment + tail', () => {
    for (let tt = START; tt <= END + 0.02; tt += 0.005) {
      expect(cameraPose(tt).z).toBeGreaterThan(0);
    }
  });

  it('WEIRD_END is documented and finite, ready for THE KEEPER to compose from', () => {
    expect(Number.isFinite(WEIRD_END.x)).toBe(true);
    expect(Number.isFinite(WEIRD_END.y)).toBe(true);
    expect(Number.isFinite(WEIRD_END.z)).toBe(true);
    expect(WEIRD_END.z).toBeGreaterThan(0);
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

describe('CENTEX_END', () => {
  it('is strictly inside (0, 1) at the same 5/12 local split the brief tuned', () => {
    // The brief's own t=0.79 was 5/12 of the original [0.74, 0.86] segment;
    // the integration-pass retune (segments.ts, 2026-08-30) moved the
    // bounds, so the pin follows the LOCAL fraction — the beat split the
    // scene was actually composed at — not the stale absolute t.
    expect(CENTEX_END).toBeGreaterThan(0);
    expect(CENTEX_END).toBeLessThan(1);
    expect(CENTEX_END).toBeCloseTo(5 / 12, 12);
    expect(t(CENTEX_END)).toBeCloseTo(START + (5 / 12) * (END - START), 9);
  });
});

describe('weirdPanelOpacity (mf1 / banner)', () => {
  it('both are 0 well outside the segment', () => {
    expect(weirdPanelOpacity('mf1', 0)).toBe(0);
    expect(weirdPanelOpacity('mf1', 1)).toBe(0);
    expect(weirdPanelOpacity('banner', 0)).toBe(0);
    expect(weirdPanelOpacity('banner', 1)).toBe(0);
  });

  it('both rise to fully opaque, hold, then yield — never negative or >1', () => {
    for (const id of ['mf1', 'banner'] as const) {
      let sawFull = false;
      for (let b = 0; b <= 1; b += 0.002) {
        const o = weirdPanelOpacity(id, t(b));
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThanOrEqual(1);
        if (o >= 0.999) sawFull = true;
      }
      expect(sawFull).toBe(true);
    }
  });

  it('both panels are visible together mid-beat-1 (not sequential, a dual composition)', () => {
    const mid = t(CENTEX_END * 0.5);
    expect(weirdPanelOpacity('mf1', mid)).toBeGreaterThan(0.9);
    expect(weirdPanelOpacity('banner', mid)).toBeGreaterThan(0.9);
  });

  it('both panels are fully gone by the time beat 2 (the TV) is fully in', () => {
    const lateB2 = t(CENTEX_END + (1 - CENTEX_END) * 0.5);
    expect(weirdPanelOpacity('mf1', lateB2)).toBe(0);
    expect(weirdPanelOpacity('banner', lateB2)).toBe(0);
    expect(tvOpacity(lateB2)).toBeCloseTo(1, 6);
  });
});

describe('tvOpacity', () => {
  it('is exactly 0 through the early part of beat 1, well before the cross-dissolve', () => {
    for (let b = 0; b <= 0.3; b += 0.02) {
      expect(tvOpacity(t(b))).toBe(0);
    }
  });

  it('cross-dissolves with the beat-1 panels AROUND CENTEX_END — both partially visible, never a blank frame', () => {
    // The whole point of the fade-window overlap: at the exact beat
    // boundary, mf1 is still fading out and the TV is already fading in.
    const boundaryOpacityMf1 = weirdPanelOpacity('mf1', t(CENTEX_END));
    const boundaryOpacityTv = tvOpacity(t(CENTEX_END));
    expect(boundaryOpacityMf1).toBeGreaterThan(0.1);
    expect(boundaryOpacityTv).toBeGreaterThan(0.1);
    // And across a dense sweep spanning the boundary, SOMETHING is always
    // visible — the scene never goes fully blank mid-transition.
    for (let b = 0.2; b <= 0.6; b += 0.005) {
      const anyVisible =
        weirdPanelOpacity('mf1', t(b)) > 0.0005 ||
        weirdPanelOpacity('banner', t(b)) > 0.0005 ||
        tvOpacity(t(b)) > 0.0005;
      expect(anyVisible).toBe(true);
    }
  });

  it('rises to fully opaque inside beat 2, then dissolves across the 6→7 seam', () => {
    let sawFull = false;
    for (let b = CENTEX_END; b <= 1; b += 0.002) {
      const o = tvOpacity(t(b));
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      if (o >= 0.999) sawFull = true;
    }
    expect(sawFull).toBe(true);
    // Integration pass 2026-08-30: the fade-out now extends PAST the segment
    // end (unclamped local progress — TV_FADE_WINDOW's note) so the TV's
    // ghost is still dissolving as THE KEEPER's sign rises: a true
    // cross-dissolve at the seam. Still partially visible AT the boundary,
    // fully gone well inside sceneActive's own 0.02 tail.
    expect(tvOpacity(END)).toBeGreaterThan(0.1);
    expect(tvOpacity(END)).toBeLessThan(0.5);
    expect(tvOpacity(END + 0.002)).toBeGreaterThan(0); // still dissolving past the seam
    expect(tvOpacity(END + 0.005)).toBe(0); // gone by t≈0.8744…
    expect(tvOpacity(END + 0.019)).toBe(0); // …well inside sceneActive's 0.02 tail
  });
});

describe('tvGlintOpacity', () => {
  it('is 0 through beat 1 and arrives only after the TV has had a moment to settle', () => {
    for (let b = 0; b <= CENTEX_END; b += 0.02) {
      expect(tvGlintOpacity(t(b))).toBe(0);
    }
    let sawFull = false;
    for (let b = CENTEX_END; b <= 1; b += 0.002) {
      const o = tvGlintOpacity(t(b));
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      if (o >= 0.999) sawFull = true;
    }
    expect(sawFull).toBe(true);
  });

  it('fades out before the TV itself starts dissolving toward THE KEEPER', () => {
    const nearEnd = t(CENTEX_END + (1 - CENTEX_END) * 0.95);
    expect(tvGlintOpacity(nearEnd)).toBe(0);
    expect(tvOpacity(nearEnd)).toBeGreaterThan(0);
  });
});

describe('anyWeirdVisible', () => {
  it('matches whichever of {mf1, banner, tv} is visible', () => {
    expect(anyWeirdVisible(0)).toBe(false);
    expect(anyWeirdVisible(t(CENTEX_END * 0.5))).toBe(true);
    expect(anyWeirdVisible(t(CENTEX_END + (1 - CENTEX_END) * 0.5))).toBe(true);
    expect(anyWeirdVisible(1)).toBe(false);
  });
});

describe('weirdPanelLayout / tvLayout', () => {
  const DESKTOP = { w: 1600, h: 1000 };
  const PORTRAIT = { w: 390, h: 844 };

  it('are pure functions of viewport, independent of t', () => {
    expect(weirdPanelLayout('mf1', DESKTOP.w, DESKTOP.h)).toEqual(
      weirdPanelLayout('mf1', DESKTOP.w, DESKTOP.h),
    );
    expect(tvLayout(DESKTOP.w, DESKTOP.h)).toEqual(tvLayout(DESKTOP.w, DESKTOP.h));
  });

  it('match their own declared aspect ratio', () => {
    const mf1 = weirdPanelLayout('mf1', DESKTOP.w, DESKTOP.h);
    expect(mf1.width / mf1.height).toBeCloseTo(MF1_ASPECT, 6);
    const banner = weirdPanelLayout('banner', DESKTOP.w, DESKTOP.h);
    expect(banner.width / banner.height).toBeCloseTo(BANNER_ASPECT, 6);
    const tv = tvLayout(DESKTOP.w, DESKTOP.h);
    expect(tv.width / tv.height).toBeCloseTo(TV_OUTER_ASPECT, 6);
  });

  it('the TV screen region (after SCREEN_MARGIN) reproduces the real 16:9 broadcast aspect', () => {
    const screenAspect =
      (TV_OUTER_ASPECT * (1 - SCREEN_MARGIN.left - SCREEN_MARGIN.right)) /
      (1 - SCREEN_MARGIN.top - SCREEN_MARGIN.bottom);
    expect(screenAspect).toBeCloseTo(1280 / 720, 6);
  });

  it('switch to the portrait composition below the landscape threshold', () => {
    expect(isPortrait(DESKTOP.w, DESKTOP.h)).toBe(false);
    expect(isPortrait(PORTRAIT.w, PORTRAIT.h)).toBe(true);
  });

  it('all three stay reasonably framed (positive width/height) at every sampled viewport', () => {
    const viewports = [DESKTOP, PORTRAIT, { w: 2200, h: 1238 }, { w: 428, h: 926 }];
    for (const { w, h } of viewports) {
      expect(weirdPanelLayout('mf1', w, h).width).toBeGreaterThan(0);
      expect(weirdPanelLayout('mf1', w, h).height).toBeGreaterThan(0);
      expect(weirdPanelLayout('banner', w, h).width).toBeGreaterThan(0);
      expect(weirdPanelLayout('banner', w, h).height).toBeGreaterThan(0);
      expect(tvLayout(w, h).width).toBeGreaterThan(0);
      expect(tvLayout(w, h).height).toBeGreaterThan(0);
    }
  });

  it('MF-1 sits nearer the camera than the banner (primary/near vs secondary/far)', () => {
    expect(weirdPanelLayout('mf1', DESKTOP.w, DESKTOP.h).z).toBeGreaterThan(
      weirdPanelLayout('banner', DESKTOP.w, DESKTOP.h).z,
    );
  });
});

describe('projectPoint + anchors', () => {
  const cam = { x: 0, y: 0, z: 5 };

  it('projects the world origin to the viewport center', () => {
    const p = projectPoint({ x: 0, y: 0, z: 0 }, cam, 1600, 1000);
    expect(p.x).toBeCloseTo(800, 6);
    expect(p.y).toBeCloseTo(500, 6);
    expect(p.depth).toBeCloseTo(5, 6);
  });

  it('mf1CaptionAnchor is a pure function of viewport and projects to finite screen coordinates', () => {
    const a1 = mf1CaptionAnchor(1600, 1000);
    const a2 = mf1CaptionAnchor(1600, 1000);
    expect(a1).toEqual(a2);
    const screen = projectPoint(a1, cameraPose(t(CENTEX_END * 0.5)), 1600, 1000);
    expect(Number.isFinite(screen.x)).toBe(true);
    expect(Number.isFinite(screen.y)).toBe(true);
    expect(screen.depth).toBeGreaterThan(0);
  });

  it('the MF-1 caption anchor sits below the panel\'s own vertical center', () => {
    const lay = weirdPanelLayout('mf1', 1600, 1000);
    const anchor = mf1CaptionAnchor(1600, 1000);
    expect(anchor.y).toBeLessThan(lay.y);
  });

  it('tvGlintAnchor is a pure function of viewport and projects to finite screen coordinates', () => {
    const a1 = tvGlintAnchor(1600, 1000);
    const a2 = tvGlintAnchor(1600, 1000);
    expect(a1).toEqual(a2);
    const screen = projectPoint(a1, cameraPose(t(CENTEX_END + (1 - CENTEX_END) * 0.6)), 1600, 1000);
    expect(Number.isFinite(screen.x)).toBe(true);
    expect(Number.isFinite(screen.y)).toBe(true);
    expect(screen.depth).toBeGreaterThan(0);
  });

  it('weirdGlintAt returns finite viewport fractions for both the live-end and REST reference poses', () => {
    const live = weirdGlintAt(1600, 1000, WEIRD_END);
    const rest = weirdGlintAt(1600, 1000, { x: 0, y: 0, z: REST_Z });
    for (const g of [live, rest]) {
      expect(Number.isFinite(g.x)).toBe(true);
      expect(Number.isFinite(g.y)).toBe(true);
    }
  });
});
