// Contract tests for THE NEIGHBORHOOD's rig — the same families every prior
// rig pins: handoff continuity (zero-jump by construction), camera purity,
// the beat envelopes' ordering/containment, and — new for this scene — the
// journey<->crossing mapping the byte-sweep harness reads through
// crossingDebug.heroMap, plus the arrival settle's own continuity contract.
import { describe, expect, it } from 'vitest';
import { SEGMENTS, px } from '../../timeline/segments';
import { DAD_END } from '../dad/dadRig';
import {
  ARRIVAL_SETTLE_AT,
  BLOOM_WINDOW,
  CROSS_P_END_T,
  CROSS_P_START_T,
  CROSSING_ACTIVE_RANGE,
  HERO_CLEAR_T,
  HERO_FADE,
  NEIGHBORHOOD_END,
  STILL_CROSS_FADE,
  STREET,
  bloomOpacity,
  buildLayout,
  buildOpacity,
  cameraPose,
  crossingActive,
  crossingPToJourneyT,
  duskVeilOpacity,
  heroLayerOpacity,
  journeyToCrossingP,
  sceneActive,
  stillWorldOpacity,
  streetProgress,
  windowPulse,
} from './neighborhoodRig';
import { computeArrivalCamera } from './arrival';
import { CINE_PLACEHOLDER_PATH } from '../../world-rtc/game/cine/cameraRig';
import { VOICE_LINES } from '../../film/voice';

const NBHD = SEGMENTS.neighborhood;

describe('handoff continuity', () => {
  it('cameraPose at the segment start equals DAD_END exactly', () => {
    const pose = cameraPose(NBHD[0], false);
    expect(pose.x).toBe(DAD_END.x);
    expect(pose.y).toBe(DAD_END.y);
    expect(pose.z).toBe(DAD_END.z);
  });

  it('NEIGHBORHOOD_END is the converged pose at the segment end', () => {
    const pose = cameraPose(NBHD[1], false);
    expect(pose).toEqual(NEIGHBORHOOD_END);
    // ...and the tail keeps writing exactly it (no drift past the end).
    expect(cameraPose(NBHD[1] + 0.01, false)).toEqual(NEIGHBORHOOD_END);
  });

  it('reduced motion pins the shared rest pose everywhere', () => {
    for (const t of [NBHD[0], 0.45, 0.6, NBHD[1]]) {
      expect(cameraPose(t, true)).toEqual({ x: 0, y: 0, z: 5 });
    }
  });

  it('sceneActive covers the segment plus the band tail', () => {
    expect(sceneActive(NBHD[0] - 1e-6)).toBe(false);
    expect(sceneActive(NBHD[0])).toBe(true);
    expect(sceneActive(NBHD[1] + 0.019)).toBe(true);
    expect(sceneActive(NBHD[1] + 0.021)).toBe(false);
  });
});

describe('windowPulse', () => {
  it('is exactly 0 at and outside both edges, 1 at the midpoint', () => {
    expect(windowPulse(0.1, 0.1, 0.3)).toBe(0);
    expect(windowPulse(0.3, 0.1, 0.3)).toBe(0);
    expect(windowPulse(0.05, 0.1, 0.3)).toBe(0);
    expect(windowPulse(0.2, 0.1, 0.3)).toBe(1);
  });
});

describe('the beat map (ordering + containment)', () => {
  it('every journey-absolute constant sits inside the segment, in order', () => {
    const seq = [
      NBHD[0],
      BLOOM_WINDOW[0],
      HERO_FADE[0],
      HERO_FADE[1],
      BLOOM_WINDOW[1],
      CROSS_P_START_T,
      STILL_CROSS_FADE[0],
      STILL_CROSS_FADE[1],
      CROSS_P_END_T,
      NBHD[1],
    ];
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    }
    expect(STREET[0]).toBe(CROSS_P_END_T);
    expect(STREET[1]).toBe(NBHD[1]);
    expect(HERO_CLEAR_T).toBeGreaterThan(NBHD[1]);
  });

  it('the build frame is gone before the hero layer is fully in', () => {
    expect(buildOpacity(HERO_FADE[1])).toBe(0);
    // and fully dark at the segment boundary in BOTH directions
    expect(buildOpacity(NBHD[0])).toBe(0);
  });

  it('the bloom peaks between the build fade-out and the held photo', () => {
    const mid = (BLOOM_WINDOW[0] + BLOOM_WINDOW[1]) / 2;
    expect(bloomOpacity(mid)).toBe(1);
    expect(bloomOpacity(BLOOM_WINDOW[0])).toBe(0);
    expect(bloomOpacity(BLOOM_WINDOW[1])).toBe(0);
    expect(bloomOpacity(CROSS_P_START_T)).toBe(0); // never over the crossing
  });

  it('hero layer: 0 before the fade, 1 through the crossing and street, gone at HERO_CLEAR_T', () => {
    expect(heroLayerOpacity(HERO_FADE[0])).toBe(0);
    expect(heroLayerOpacity(HERO_FADE[1])).toBe(1);
    expect(heroLayerOpacity(CROSS_P_START_T)).toBe(1);
    expect(heroLayerOpacity(CROSS_P_END_T)).toBe(1);
    expect(heroLayerOpacity(CROSS_P_END_T + px(75))).toBe(1);
    expect(heroLayerOpacity(HERO_CLEAR_T)).toBe(0);
  });
});

describe('journey<->crossing mapping (the qa.mjs contract)', () => {
  it('p is 0 through the handoff+hold and 1 from the street on', () => {
    expect(journeyToCrossingP(0)).toBe(0);
    expect(journeyToCrossingP(HERO_FADE[1])).toBe(0);
    expect(journeyToCrossingP(CROSS_P_START_T)).toBe(0);
    expect(journeyToCrossingP(CROSS_P_END_T)).toBe(1);
    expect(journeyToCrossingP(1)).toBe(1);
  });

  it('is monotonic and inverts exactly on [0,1]', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const t = crossingPToJourneyT(p);
      expect(journeyToCrossingP(t)).toBeCloseTo(Math.min(1, p), 12);
    }
    // the harness checkpoints in particular
    for (const p of [0.14, 0.2, 0.26, 0.31, 0.85]) {
      expect(journeyToCrossingP(crossingPToJourneyT(p))).toBeCloseTo(p, 12);
    }
  });

  it('the swap (p=0.2) lands inside beat 3, clear of every caption', () => {
    const swapT = crossingPToJourneyT(0.2);
    expect(swapT).toBeGreaterThan(CROSS_P_START_T);
    expect(swapT).toBeLessThan(CROSS_P_END_T);
    for (const { window: [s, e] } of VOICE_LINES) {
      // the LAW: no captions anywhere in the crossing's own range
      const overlaps = s < CROSS_P_END_T && e > CROSS_P_START_T;
      expect(overlaps).toBe(false);
    }
  });

  it('crossingActive arms before the segment and disarms after the layer clears', () => {
    expect(crossingActive(0.1, 0.1)).toBe(false);
    expect(crossingActive(CROSSING_ACTIVE_RANGE[0], CROSSING_ACTIVE_RANGE[0])).toBe(true);
    // a cold fling: value still at 0, target already deep in the film
    expect(crossingActive(0, 0.8)).toBe(true);
    expect(crossingActive(0.9, 0.9)).toBe(false);
    expect(CROSSING_ACTIVE_RANGE[1]).toBeGreaterThan(HERO_CLEAR_T);
  });
});

describe('beat 4 (street, veil, static edition)', () => {
  it('the arrival camera at q=0 is EXACTLY the departure path end pose', () => {
    const end = CINE_PLACEHOLDER_PATH[CINE_PLACEHOLDER_PATH.length - 1];
    for (const portrait of [false, true]) {
      const cam = computeArrivalCamera(0, portrait);
      expect([cam.pos.x, cam.pos.y, cam.pos.z]).toEqual(end.pos);
      expect([cam.look.x, cam.look.y, cam.look.z]).toEqual(end.look);
      expect(cam.fovDeg).toBe(end.fov);
    }
  });

  it('the camera is exactly still from ARRIVAL_SETTLE_AT on', () => {
    for (const portrait of [false, true]) {
      const rest = computeArrivalCamera(1, portrait);
      const settled = computeArrivalCamera(ARRIVAL_SETTLE_AT, portrait);
      expect(settled.pos.equals(rest.pos)).toBe(true);
      expect(settled.look.equals(rest.look)).toBe(true);
      expect(settled.fovDeg).toBe(rest.fovDeg);
    }
  });

  it('the dusk veil only rises after the camera has settled', () => {
    expect(duskVeilOpacity(crossingPToJourneyT(1))).toBe(0);
    const settleT = STREET[0] + ARRIVAL_SETTLE_AT * (STREET[1] - STREET[0]);
    // exactly at the settle point (modulo float rounding of the t above)
    expect(duskVeilOpacity(settleT)).toBeLessThan(1e-6);
    expect(duskVeilOpacity(NBHD[1])).toBeCloseTo(0.82, 6);
  });

  it('streetProgress is 0 through the whole crossing', () => {
    expect(streetProgress(CROSS_P_START_T)).toBe(0);
    expect(streetProgress(CROSS_P_END_T)).toBe(0);
    expect(streetProgress(NBHD[1])).toBe(1);
  });

  it('the static edition dissolves inside the live peel window', () => {
    expect(stillWorldOpacity(CROSS_P_START_T)).toBe(0);
    expect(stillWorldOpacity(STILL_CROSS_FADE[1])).toBe(1);
    // both editions transform inside the same beat
    expect(STILL_CROSS_FADE[0]).toBeGreaterThan(crossingPToJourneyT(0.2));
    expect(STILL_CROSS_FADE[1]).toBeLessThan(crossingPToJourneyT(0.6));
  });
});

describe('layout purity', () => {
  it('buildLayout is pure and aspect-true in both orientations', () => {
    const a = buildLayout(1600, 1000);
    const b = buildLayout(1600, 1000);
    expect(a).toEqual(b);
    expect(a.portrait).toBe(false);
    expect(a.rect.width / a.rect.height).toBeCloseTo(2048 / 1536, 6);
    const p = buildLayout(390, 844);
    expect(p.portrait).toBe(true);
    expect(p.rect.width / p.rect.height).toBeCloseTo(2048 / 1536, 6);
  });
});
