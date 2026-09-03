import { describe, it, expect } from 'vitest';
import {
  dampingFor,
  dprMaxFor,
  DAMPING_POINTER_COARSE,
  DAMPING_POINTER_FINE,
  DPR_MAX_POINTER_COARSE,
  DPR_MAX_POINTER_FINE,
  filmHeight,
  filmWidth,
  isCoarsePointer,
} from './filmViewport';

describe('filmViewport — touch tuning', () => {
  it('keeps the wheel’s cinematic damping and tightens for a finger', () => {
    expect(dampingFor(false)).toBe(DAMPING_POINTER_FINE);
    expect(dampingFor(true)).toBe(DAMPING_POINTER_COARSE);
    // Tighter, but still a damped glide — never a hard 1:1 lock, which
    // would hand every dropped frame straight to the picture.
    expect(DAMPING_POINTER_COARSE).toBeGreaterThan(DAMPING_POINTER_FINE);
    expect(DAMPING_POINTER_COARSE).toBeLessThan(20);
  });

  it('caps the renderer pixel ratio lower on coarse pointers', () => {
    expect(dprMaxFor(false)).toBe(DPR_MAX_POINTER_FINE);
    expect(dprMaxFor(true)).toBe(DPR_MAX_POINTER_COARSE);
    expect(DPR_MAX_POINTER_COARSE).toBeLessThan(DPR_MAX_POINTER_FINE);
    expect(DPR_MAX_POINTER_COARSE).toBeGreaterThanOrEqual(1);
  });

  it('is safe without a window (SSR / node tests)', () => {
    expect(isCoarsePointer()).toBe(false);
    expect(filmHeight()).toBe(0);
    expect(filmWidth()).toBe(0);
  });
});
