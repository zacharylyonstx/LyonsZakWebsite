// Contract tests for THE KEEPER's rig. Pins:
//   frames = f(scroll)               -> purity
//   exact handoff from THE WEIRD ONES -> zero-jump camera continuity at
//                                        t = KEEPER_START
//   the four-beat sequencing         -> each visual reaches full opacity in
//                                        its own beat; every beat boundary
//                                        is a real cross-dissolve
//   the film ends composed           -> the end card is FULLY in at t=1 and
//                                        never leaves; sceneActive holds
//                                        through the journey's end (there
//                                        is no next scene)
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { VOICE_LINES } from '../../film/voice';
import { WEIRD_END } from '../weird/weirdRig';
import { REST_Z } from '../drummer/drummerRig';
import {
  CARRY_ASPECT,
  KEEPER_END,
  KEEP_END,
  PENNY_ASPECT,
  PLAQUE_ASPECT,
  SIGN_ASPECT,
  SIGN_END,
  THEN_END,
  anyKeeperVisible,
  cameraPose,
  carryMix,
  carryMix2,
  endCardOpacity,
  isPortrait,
  keeperPanelLayout,
  keeperPanelOpacity,
  sceneActive,
  signLayout,
  signOpacity,
} from './keeperRig';

const [START, END] = SEGMENTS.keeper;

/** journey t from segment-local progress b. */
function t(b: number): number {
  return START + b * (END - START);
}

describe('handoff from THE WEIRD ONES', () => {
  it('cameraPose(KEEPER_START) is byte-identical to WEIRD_END', () => {
    expect(cameraPose(START)).toEqual(WEIRD_END);
  });

  it('stays within float noise just inside the segment', () => {
    const got = cameraPose(START + 1e-9);
    expect(got.x).toBeCloseTo(WEIRD_END.x, 9);
    expect(got.y).toBeCloseTo(WEIRD_END.y, 9);
    expect(got.z).toBeCloseTo(WEIRD_END.z, 9);
  });

  it('reduced motion pins the camera at the site-wide rest pose', () => {
    expect(cameraPose(START, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose((START + END) / 2, true)).toEqual({ x: 0, y: 0, z: REST_Z });
    expect(cameraPose(END, true)).toEqual({ x: 0, y: 0, z: REST_Z });
  });
});

describe('camera purity + range', () => {
  it('is a pure function of t', () => {
    expect(cameraPose(0.93)).toEqual(cameraPose(0.93));
  });

  it('camera.z always stays positive across the whole segment', () => {
    for (let tt = START; tt <= END; tt += 0.002) {
      expect(cameraPose(tt).z).toBeGreaterThan(0);
    }
  });

  it('KEEPER_END is the documented, finite terminal pose (t=1 is the page state)', () => {
    expect(Number.isFinite(KEEPER_END.x)).toBe(true);
    expect(Number.isFinite(KEEPER_END.y)).toBe(true);
    expect(Number.isFinite(KEEPER_END.z)).toBe(true);
    expect(KEEPER_END.z).toBeGreaterThan(0);
    expect(cameraPose(1)).toEqual(KEEPER_END);
  });
});

describe('sceneActive', () => {
  it('is false before the segment and true at its exact start', () => {
    expect(sceneActive(START - 0.001)).toBe(false);
    expect(sceneActive(START)).toBe(true);
  });

  it('stays true through t=1 — the film has no next scene to yield to', () => {
    expect(sceneActive(0.99)).toBe(true);
    expect(sceneActive(1)).toBe(true);
  });
});

describe('beat boundaries', () => {
  it('land on the brief\'s own local splits (2/7, 4/7, 11/14 of the segment)', () => {
    // The brief's t=0.90/0.94/0.97 were these fractions of the original
    // [0.86, 1] segment; the integration-pass retune (segments.ts,
    // 2026-08-30) moved the start to 0.87, so the pin follows the LOCAL
    // fractions the scene was composed at. New absolute equivalents:
    // 0.9071 / 0.9443 / 0.9721.
    expect(SIGN_END).toBeCloseTo(2 / 7, 12);
    expect(KEEP_END).toBeCloseTo(4 / 7, 12);
    expect(THEN_END).toBeCloseTo(11 / 14, 12);
    expect(t(SIGN_END)).toBeCloseTo(START + (2 / 7) * (END - START), 9);
    expect(t(KEEP_END)).toBeCloseTo(START + (4 / 7) * (END - START), 9);
    expect(t(THEN_END)).toBeCloseTo(START + (11 / 14) * (END - START), 9);
  });
});

describe('opacity envelopes', () => {
  const all = (tt: number) => ({
    sign: signOpacity(tt),
    plaque: keeperPanelOpacity('plaque', tt),
    penny: keeperPanelOpacity('penny', tt),
    finale: keeperPanelOpacity('carry', tt),
    card: endCardOpacity(tt),
  });

  it('everything is 0 well outside the segment', () => {
    for (const v of Object.values(all(0.5))) expect(v).toBe(0);
  });

  it('each visual reaches full opacity inside its own beat, all stay in [0,1]', () => {
    const sawFull = { sign: false, plaque: false, penny: false, finale: false, card: false };
    for (let b = 0; b <= 1; b += 0.002) {
      const o = all(t(b));
      for (const [k, v] of Object.entries(o)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        if (v >= 0.999) sawFull[k as keyof typeof sawFull] = true;
      }
    }
    expect(sawFull).toEqual({ sign: true, plaque: true, penny: true, finale: true, card: true });
  });

  it('the plaque and the Penny box are visible TOGETHER mid-beat-2 (a dual composition)', () => {
    const mid = t((SIGN_END + KEEP_END) / 2);
    expect(keeperPanelOpacity('plaque', mid)).toBeGreaterThan(0.9);
    expect(keeperPanelOpacity('penny', mid)).toBeGreaterThan(0.9);
  });

  it('every beat boundary is a real cross-dissolve — something is always visible from the sign\'s arrival to t=1', () => {
    // Boundary 1: sign out overlaps plaque in.
    expect(signOpacity(t(SIGN_END))).toBeGreaterThan(0.1);
    expect(keeperPanelOpacity('plaque', t(SIGN_END))).toBeGreaterThan(0.1);
    // Dense sweep: after the sign's own fade-in completes (the segment
    // BOUNDARY instant itself is the standing scene-handoff convention —
    // each scene fades in from its own b=0, the GIG_FADE_IN precedent),
    // SOMETHING has visible pixels all the way to the journey's end
    // (the end card counts: it IS beat 4's content).
    for (let b = 0.055; b <= 1; b += 0.002) {
      const o = all(t(b));
      const anyVisible =
        o.sign > 0.0005 || o.plaque > 0.0005 || o.penny > 0.0005 || o.finale > 0.0005 || o.card > 0.0005;
      expect(anyVisible).toBe(true);
    }
  });

  it('the diptych holds alone mid-beat-3 — the keeping panels are gone', () => {
    const mid = t((KEEP_END + THEN_END) / 2);
    expect(keeperPanelOpacity('carry', mid)).toBeGreaterThan(0.9);
    expect(keeperPanelOpacity('plaque', mid)).toBe(0);
    expect(keeperPanelOpacity('penny', mid)).toBe(0);
  });
});

describe('endCardOpacity — the signature', () => {
  it('is 0 through beats 1-3', () => {
    for (let b = 0; b <= THEN_END; b += 0.01) {
      expect(endCardOpacity(t(b))).toBe(0);
    }
  });

  it('is EXACTLY 1 at t=1 and holds there for any over-scrolled t — the terminal frame at rest', () => {
    expect(endCardOpacity(1)).toBe(1);
    expect(endCardOpacity(t(0.93))).toBe(1);
    // keeperProgress saturates at 1 past the segment end, so even a
    // hypothetical t>1 (impossible from the clamped timeline, checked
    // anyway) keeps the card fully in.
    expect(endCardOpacity(1.0000001)).toBe(1);
  });

  it('never overlaps the diptych at full strength — the dusk breathes between them', () => {
    // While the diptych is still >90% in, the card has not started.
    const held = t(0.7);
    expect(keeperPanelOpacity('carry', held)).toBeGreaterThan(0.9);
    expect(endCardOpacity(held)).toBe(0);
  });
});

describe('anyKeeperVisible', () => {
  it('tracks the WebGL visuals only (the end card is DOM)', () => {
    expect(anyKeeperVisible(0.5)).toBe(false);
    expect(anyKeeperVisible(t(0.15))).toBe(true);
    expect(anyKeeperVisible(t((SIGN_END + KEEP_END) / 2))).toBe(true);
    expect(anyKeeperVisible(t(0.7))).toBe(true);
    // At the journey's end every WebGL visual has dissolved: only the end
    // card (DOM) holds the frame.
    expect(anyKeeperVisible(1)).toBe(false);
    expect(endCardOpacity(1)).toBe(1);
  });
});

describe('signLayout / keeperPanelLayout', () => {
  const DESKTOP = { w: 1600, h: 1000 };
  const PORTRAIT = { w: 390, h: 844 };

  it('are pure functions of viewport, independent of t', () => {
    expect(signLayout(DESKTOP.w, DESKTOP.h)).toEqual(signLayout(DESKTOP.w, DESKTOP.h));
    expect(keeperPanelLayout('plaque', DESKTOP.w, DESKTOP.h)).toEqual(
      keeperPanelLayout('plaque', DESKTOP.w, DESKTOP.h),
    );
  });

  it('match their own declared aspect ratios', () => {
    const sign = signLayout(DESKTOP.w, DESKTOP.h);
    expect(sign.rect.width / sign.rect.height).toBeCloseTo(SIGN_ASPECT, 6);
    for (const [id, aspect] of [
      ['plaque', PLAQUE_ASPECT],
      ['penny', PENNY_ASPECT],
      ['carry', CARRY_ASPECT],
    ] as const) {
      const lay = keeperPanelLayout(id, DESKTOP.w, DESKTOP.h);
      expect(lay.width / lay.height).toBeCloseTo(aspect, 6);
    }
  });

  it('switch to the portrait composition below the landscape threshold', () => {
    expect(isPortrait(DESKTOP.w, DESKTOP.h)).toBe(false);
    expect(isPortrait(PORTRAIT.w, PORTRAIT.h)).toBe(true);
  });

  it('everything stays positively sized at every sampled viewport', () => {
    const viewports = [DESKTOP, PORTRAIT, { w: 2200, h: 1238 }, { w: 428, h: 926 }];
    for (const { w, h } of viewports) {
      expect(signLayout(w, h).rect.width).toBeGreaterThan(0);
      expect(signLayout(w, h).meshScale).toBeGreaterThan(0);
      for (const id of ['plaque', 'penny', 'carry'] as const) {
        expect(keeperPanelLayout(id, w, h).width).toBeGreaterThan(0);
        expect(keeperPanelLayout(id, w, h).height).toBeGreaterThan(0);
      }
    }
  });

  it('the plaque sits nearer the camera than the Penny box (primary/near vs secondary/far)', () => {
    expect(keeperPanelLayout('plaque', DESKTOP.w, DESKTOP.h).z).toBeGreaterThan(
      keeperPanelLayout('penny', DESKTOP.w, DESKTOP.h).z,
    );
  });
});

describe('carry crossfade (delight item 3)', () => {
  it('is pure: same t, same mix', () => {
    expect(carryMix(t(0.7))).toBe(carryMix(t(0.7)));
  });

  it('holds the childhood frame through the panel fade-in and early hold', () => {
    // Panel fade-in completes at b=0.63 (FINALE_FADE); the first mix must still
    // be exactly 0 there — the visitor SEES the kids before time moves.
    for (const b of [0, 0.56, 0.6, 0.63, 0.65]) {
      expect(carryMix(t(b))).toBe(0);
    }
  });

  it('fully resolves to the present before the panel starts fading out', () => {
    expect(carryMix(t(0.715))).toBe(1);
    expect(carryMix(t(0.81))).toBe(1); // fadeOutStart
    expect(carryMix(t(1))).toBe(1);
  });

  it('is monotonic — scrubbing back rewinds time', () => {
    let prev = -1;
    for (let b = 0.5; b <= 0.8; b += 0.002) {
      const m = carryMix(t(b));
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it('the three closing lines land on day one, on Penny, and on Luke — in that order', () => {
    // voice.ts: "That was day one." sits entirely on the held day-one
    // frame; "This is now." lands as Penny resolves (carryMix); "Still the
    // whole point." lands as Luke resolves (carryMix2) and holds into the
    // end card.
    const n = VOICE_LINES.length;
    const [dayOne, now, still] = [VOICE_LINES[n - 3], VOICE_LINES[n - 2], VOICE_LINES[n - 1]];
    expect(dayOne.window[0]).toBeGreaterThan(SEGMENTS.keeper[0]);
    expect(carryMix(dayOne.window[1])).toBe(0);
    expect(carryMix(now.window[0])).toBeGreaterThan(0);
    expect(carryMix(now.window[1])).toBe(1);
    expect(carryMix2(now.window[1])).toBe(0);
    expect(carryMix2(still.window[0])).toBeGreaterThan(0);
    expect(carryMix2(still.window[1])).toBe(1);
  });

  it('the second dissolve starts only after the first has fully resolved', () => {
    for (let b = 0; b <= 1.0001; b += 0.005) {
      if (carryMix2(t(b)) > 0) expect(carryMix(t(b))).toBe(1);
    }
    expect(carryMix2(t(1))).toBe(1);
  });

  it('portrait carry frame clears a 390px viewport with margin', () => {
    const lay = keeperPanelLayout('carry', 390, 844);
    // The panel's on-screen width (heightFrac * viewportH * aspect) fits
    // inside 390 with margin, and the layout preserves the carry aspect.
    expect(0.36 * 844 * CARRY_ASPECT).toBeLessThan(390 * 0.95);
    expect(lay.width / lay.height).toBeCloseTo(CARRY_ASPECT, 6);
  });
});
