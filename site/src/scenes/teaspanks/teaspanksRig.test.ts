// TEASPANKS's rig contract: the seam from THE BAND, the seam into THE WEIRD
// ONES, envelopes, layout purity — the standing per-scene test shape.
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { BAND_END } from '../band/bandRig';
import { VOICE_LINES } from '../../film/voice';
import {
  TEASPANKS_END,
  cameraPose,
  labelAnchor,
  lyricOpacity,
  lyricRisePx,
  panelLayout,
  panelOpacity,
  pillAnchor,
  pillOpacity,
  projectPoint,
  sceneActive,
  teaspanksProgress,
} from './teaspanksRig';

const [START, END] = SEGMENTS.teaspanks;
const t = (b: number) => START + b * (END - START);

describe('seams', () => {
  it('cameraPose(START) is byte-identical to BAND_END', () => {
    expect(cameraPose(START)).toEqual(BAND_END);
  });
  it('TEASPANKS_END is the converged pose at the segment end and past it', () => {
    expect(cameraPose(END)).toEqual(TEASPANKS_END);
    expect(cameraPose(END + 0.01)).toEqual(TEASPANKS_END);
  });
  it('is active from its start through a short tail, never before', () => {
    expect(sceneActive(START - 1e-6)).toBe(false);
    expect(sceneActive(START)).toBe(true);
    expect(sceneActive(END + 0.01)).toBe(true);
    expect(sceneActive(END + 0.03)).toBe(false);
  });
  it('reduced motion pins the rest pose', () => {
    expect(cameraPose(t(0.5), true)).toEqual({ x: 0, y: 0, z: cameraPose(0, true).z });
  });
});

describe('envelopes', () => {
  it('the lyric owns the dusk first; the frame arrives as it leaves, holds, and is gone before the end', () => {
    expect(lyricOpacity(START)).toBe(0);
    expect(lyricOpacity(t(0.2))).toBe(1);
    expect(lyricOpacity(t(0.3))).toBe(1);
    expect(lyricOpacity(t(0.5))).toBe(0);
    expect(panelOpacity(START)).toBe(0);
    expect(panelOpacity(t(0.2))).toBe(0);
    expect(panelOpacity(t(0.55))).toBe(1);
    expect(panelOpacity(t(0.7))).toBe(1);
    expect(panelOpacity(END)).toBe(0);
    // The lyric is never on top of a fully present frame.
    for (let b = 0; b <= 1.0001; b += 0.01) {
      if (panelOpacity(t(b)) === 1) expect(lyricOpacity(t(b))).toBe(0);
    }
    // The rise settles to 0 while the lyric holds; pure and reversible.
    expect(lyricRisePx(t(0.2))).toBe(0);
    expect(lyricRisePx(START)).toBeGreaterThan(0);
    expect(lyricRisePx(t(0.25))).toBe(lyricRisePx(t(0.25)));
  });
  it('the pill is only on inside the frame\'s full hold', () => {
    for (let b = 0; b <= 1.0001; b += 0.01) {
      if (pillOpacity(t(b)) > 0) expect(panelOpacity(t(b))).toBe(1);
    }
    expect(pillOpacity(t(0.65))).toBe(1);
  });
  it('three voice lines: the first under the lyric, the other two under the held frame', () => {
    const lines = VOICE_LINES.filter((l) => l.window[0] >= START && l.window[1] <= END);
    expect(lines.length).toBe(3);
    expect(lyricOpacity(lines[0].window[0])).toBeGreaterThan(0);
    expect(lyricOpacity(lines[0].window[1])).toBe(1);
    for (const l of lines.slice(1)) {
      expect(panelOpacity(l.window[0])).toBe(1);
      expect(panelOpacity(l.window[1])).toBe(1);
    }
  });
  it('progress is segment-local', () => {
    expect(teaspanksProgress(START)).toBe(0);
    expect(teaspanksProgress(END)).toBe(1);
  });
});

describe('layout purity', () => {
  it('panelLayout is pure and aspect-true in both orientations', () => {
    const a = panelLayout(1600, 1000);
    expect(a).toEqual(panelLayout(1600, 1000));
    expect(a.portrait).toBe(false);
    expect(a.rect.width / a.rect.height).toBeCloseTo(3840 / 2158, 6);
    const p = panelLayout(390, 844);
    expect(p.portrait).toBe(true);
    expect(p.rect.width).toBeCloseTo(0.92 * 390, 6);
  });
  it('label sits under the frame in landscape and above it in portrait; the pill is always below', () => {
    const land = panelLayout(1600, 1000);
    const worldH = land.meshScale / (3840 / 2158);
    expect(labelAnchor(1600, 1000).y).toBeLessThan(land.meshY - worldH / 2);
    const port = panelLayout(390, 844);
    const worldHp = port.meshScale / (3840 / 2158);
    expect(labelAnchor(390, 844).y).toBeGreaterThan(port.meshY + worldHp / 2);
    expect(pillAnchor(390, 844).y).toBeLessThan(port.meshY - worldHp / 2);
  });
  it('projection puts the frame center on screen at every pose', () => {
    for (const b of [0, 0.25, 0.5, 0.75, 1]) {
      const lay = panelLayout(1600, 1000);
      const s = projectPoint({ x: lay.meshX, y: lay.meshY, z: 0 }, cameraPose(t(b)), 1600, 1000);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1600);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(1000);
    }
  });
});
