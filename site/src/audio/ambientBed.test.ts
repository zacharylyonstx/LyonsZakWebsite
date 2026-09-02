// Only the pure pieces are testable under vitest's plain `node` environment
// (no AudioContext exists there) — see ambientBed.ts's own file header for
// the pure/wiring split, and vitest.config.ts's rationale for the node
// environment.
import { describe, expect, it } from 'vitest';
import {
  brownNoiseStep,
  CHIRP_MAX_DELAY_S,
  CHIRP_MIN_DELAY_S,
  chirpDelaySeconds,
  chirpFrequencyHz,
  chirpPulseCount,
} from './ambientBed';

describe('chirpDelaySeconds', () => {
  it('spans exactly [MIN, MAX] across the random domain', () => {
    expect(chirpDelaySeconds(0)).toBe(CHIRP_MIN_DELAY_S);
    expect(chirpDelaySeconds(1)).toBe(CHIRP_MAX_DELAY_S);
    expect(chirpDelaySeconds(0.5)).toBeCloseTo((CHIRP_MIN_DELAY_S + CHIRP_MAX_DELAY_S) / 2, 9);
  });

  it('is monotonic in its input — never produces two identical delays for a diverse RNG stream', () => {
    let prev = -Infinity;
    for (let r = 0; r <= 1; r += 0.05) {
      const d = chirpDelaySeconds(r);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
});

describe('chirpPulseCount', () => {
  it('is 2 below the midpoint, 3 at and above it — never a single held tone', () => {
    expect(chirpPulseCount(0)).toBe(2);
    expect(chirpPulseCount(0.49)).toBe(2);
    expect(chirpPulseCount(0.5)).toBe(3);
    expect(chirpPulseCount(0.99)).toBe(3);
  });
});

describe('chirpFrequencyHz', () => {
  it('stays inside a distant-cricket register across the whole random domain', () => {
    for (let r = 0; r <= 1; r += 0.1) {
      const hz = chirpFrequencyHz(r);
      expect(hz).toBeGreaterThanOrEqual(3600);
      expect(hz).toBeLessThanOrEqual(5000);
    }
  });
});

describe('brownNoiseStep', () => {
  it('a silent (all-zero) white sequence decays toward zero, never drifts', () => {
    let value = 1;
    let prevAbs = 1;
    for (let i = 0; i < 2000; i++) {
      value = brownNoiseStep(value, 0);
      // Strictly decaying in magnitude every single step (a geometric decay
      // toward 0, with leak=0.02 -> factor 1/1.02 per step) — never drifts
      // back up, never overshoots past 0.
      expect(Math.abs(value)).toBeLessThan(prevAbs);
      prevAbs = Math.abs(value);
    }
    expect(value).toBeCloseTo(0, 9);
  });

  it('is bounded: constant +1 white input converges to +1, never overshoots', () => {
    let value = 0;
    for (let i = 0; i < 2000; i++) {
      value = brownNoiseStep(value, 1);
      expect(value).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(value).toBeCloseTo(1, 3);
  });

  it('is a pure function of its own inputs', () => {
    expect(brownNoiseStep(0.3, 0.7)).toBe(brownNoiseStep(0.3, 0.7));
  });
});
