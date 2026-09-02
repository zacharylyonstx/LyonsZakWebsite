import { describe, expect, it } from 'vitest';
import { POSTSCRIPT_CLICK_THRESHOLD, shouldRevealPostscript } from './endCardEasterEgg';

describe('shouldRevealPostscript', () => {
  it('is false below the threshold', () => {
    expect(shouldRevealPostscript(0)).toBe(false);
    expect(shouldRevealPostscript(POSTSCRIPT_CLICK_THRESHOLD - 1)).toBe(false);
  });

  it('is true at and above the threshold', () => {
    expect(shouldRevealPostscript(POSTSCRIPT_CLICK_THRESHOLD)).toBe(true);
    expect(shouldRevealPostscript(POSTSCRIPT_CLICK_THRESHOLD + 10)).toBe(true);
  });

  it('is monotonic — never reveals then un-reveals as clicks only increase', () => {
    let prev = false;
    for (let clicks = 0; clicks <= 10; clicks++) {
      const revealed = shouldRevealPostscript(clicks);
      if (prev) expect(revealed).toBe(true); // once true, stays true
      prev = revealed;
    }
  });
});
