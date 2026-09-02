// Contract tests for the voice-line inventory + the subtitle resolver.
// The inventory is data the film trusts blindly every frame — so its shape
// (sorted, non-overlapping, in-range windows) is enforced here, and the
// resolver's fade envelope is pinned as a pure, clamped function of t.
import { describe, expect, it } from 'vitest';
import { VOICE_LINES } from './voice';
import { subtitleStateAt } from './Subtitle';

describe('VOICE_LINES inventory', () => {
  it('windows are in [0,1], well-formed, sorted, and non-overlapping', () => {
    let prevEnd = -1;
    for (const { text, window: [start, end] } of VOICE_LINES) {
      expect(text.length).toBeGreaterThan(0);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(1);
      expect(end).toBeGreaterThan(start);
      expect(start).toBeGreaterThan(prevEnd); // sorted AND non-overlapping
      prevEnd = end;
    }
  });
});

describe('subtitleStateAt', () => {
  const lines = [
    { text: 'a', window: [0.2, 0.3] as const },
    { text: 'b', window: [0.5, 0.6] as const },
  ];

  it('returns no line outside every window', () => {
    expect(subtitleStateAt(0, lines)).toEqual({ index: -1, opacity: 0 });
    expect(subtitleStateAt(0.4, lines)).toEqual({ index: -1, opacity: 0 });
    expect(subtitleStateAt(1, lines)).toEqual({ index: -1, opacity: 0 });
  });

  it('is fully opaque at a window center and faded at its edges', () => {
    expect(subtitleStateAt(0.25, lines)).toEqual({ index: 0, opacity: 1 });
    expect(subtitleStateAt(0.2, lines).opacity).toBe(0);
    expect(subtitleStateAt(0.3, lines).opacity).toBe(0);
    const inFade = subtitleStateAt(0.209, lines);
    expect(inFade.index).toBe(0);
    expect(inFade.opacity).toBeGreaterThan(0);
    expect(inFade.opacity).toBeLessThan(1);
  });

  it('is a pure function of t (same input, byte-same output)', () => {
    const a = subtitleStateAt(0.555, lines);
    const b = subtitleStateAt(0.555, lines);
    expect(a).toEqual(b);
  });

  it('resolves the real inventory without throwing across the journey', () => {
    for (let t = 0; t <= 1.0001; t += 0.001) {
      const s = subtitleStateAt(t);
      expect(s.opacity).toBeGreaterThanOrEqual(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
    }
  });
});
