// Chat-reveal envelopes (delight pass, item 1) — the laws that make the
// feature safe: pure, ordered, complete before the panel's late hold, and
// byte-invisible once done.
import { describe, expect, it } from 'vitest';
import { SEGMENTS } from '../../timeline/segments';
import { PANEL_SPECS } from './builderRig';
import { VOICE_LINES } from '../../film/voice';
import {
  CHAT_IMAGE,
  CHAT_MESSAGES,
  CHAT_MSG_STARTS,
  CHAT_REVEAL_DONE_P,
  CHAT_REVEAL_DONE_T,
  anyChatPatchVisible,
  messageReveal,
  messageUvRect,
  patchOpacity,
} from './chatReveal';

const BUILDER = SEGMENTS.builder;
const tFor = (p: number) => BUILDER[0] + p * (BUILDER[1] - BUILDER[0]);

describe('chat message rects', () => {
  it('one start per message', () => {
    expect(CHAT_MSG_STARTS.length).toBe(CHAT_MESSAGES.length);
  });

  it('every rect sits inside the screenshot', () => {
    for (const m of CHAT_MESSAGES) {
      expect(m.left).toBeGreaterThanOrEqual(0);
      expect(m.top).toBeGreaterThanOrEqual(0);
      expect(m.left + m.width).toBeLessThanOrEqual(CHAT_IMAGE.width);
      expect(m.top + m.height).toBeLessThanOrEqual(CHAT_IMAGE.height);
    }
  });

  it('messages are ordered top-to-bottom and never overlap vertically', () => {
    for (let i = 1; i < CHAT_MESSAGES.length; i++) {
      const prev = CHAT_MESSAGES[i - 1];
      expect(CHAT_MESSAGES[i].top).toBeGreaterThanOrEqual(prev.top + prev.height);
    }
  });

  it('uv rects are inside [0,1] and mirror the pixel rects', () => {
    CHAT_MESSAGES.forEach((m, i) => {
      const uv = messageUvRect(i);
      expect(uv.centerU - uv.sizeU / 2).toBeGreaterThanOrEqual(0);
      expect(uv.centerU + uv.sizeU / 2).toBeLessThanOrEqual(1);
      expect(uv.centerV - uv.sizeV / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(uv.centerV + uv.sizeV / 2).toBeLessThanOrEqual(1);
      expect(uv.sizeU).toBeCloseTo(m.width / CHAT_IMAGE.width, 10);
      expect(uv.sizeV).toBeCloseTo(m.height / CHAT_IMAGE.height, 10);
    });
  });
});

describe('reveal choreography', () => {
  it('messages materialize strictly one after another', () => {
    for (let i = 1; i < CHAT_MSG_STARTS.length; i++) {
      expect(CHAT_MSG_STARTS[i]).toBeGreaterThan(CHAT_MSG_STARTS[i - 1]);
    }
  });

  it('nothing is revealed before the panel has fully arrived (p=0.1)', () => {
    for (let i = 0; i < CHAT_MESSAGES.length; i++) {
      expect(messageReveal(i, 0)).toBe(0);
      expect(messageReveal(i, PANEL_SPECS.kaelbot.fadeInEnd)).toBe(0);
    }
  });

  it('every reveal is monotonic in p and saturates at 1', () => {
    for (let i = 0; i < CHAT_MESSAGES.length; i++) {
      let prev = -1;
      for (let p = 0; p <= 1.0001; p += 0.005) {
        const r = messageReveal(i, p);
        expect(r).toBeGreaterThanOrEqual(prev);
        prev = r;
      }
      expect(messageReveal(i, CHAT_REVEAL_DONE_P)).toBe(1);
    }
  });

  it('the reveal completes before the kaelbot panel starts fading out', () => {
    expect(CHAT_REVEAL_DONE_P).toBeLessThan(PANEL_SPECS.kaelbot.fadeOutStart);
  });

  it('the reveal completes before the Kaelbot voice line begins', () => {
    const kaelbotLine = VOICE_LINES.find((l) => l.text.includes('Kaelbot'));
    expect(kaelbotLine).toBeDefined();
    expect(CHAT_REVEAL_DONE_T).toBeLessThan(kaelbotLine!.window[0]);
  });
});

describe('byte-identity guarantees', () => {
  it('every patch is gone at and past CHAT_REVEAL_DONE_P', () => {
    for (const p of [CHAT_REVEAL_DONE_P, 0.6, 0.75, 1]) {
      const t = tFor(p);
      expect(anyChatPatchVisible(t)).toBe(false);
      for (let i = 0; i < CHAT_MESSAGES.length; i++) {
        expect(patchOpacity(i, t)).toBe(0);
      }
    }
  });

  it('patches are inert outside the builder segment', () => {
    expect(anyChatPatchVisible(0)).toBe(false);
    expect(anyChatPatchVisible(0.05)).toBe(false);
    expect(anyChatPatchVisible(0.3)).toBe(false);
    expect(anyChatPatchVisible(0.9)).toBe(false);
  });

  it('patches ride the panel opacity exactly while their message is hidden', () => {
    const t = tFor(0.12); // panel fully in, first message barely started
    for (let i = 2; i < CHAT_MESSAGES.length; i++) {
      expect(patchOpacity(i, t)).toBe(1);
    }
  });

  it('patchOpacity is a pure function of t (same input, same output)', () => {
    const t = tFor(0.3);
    expect(patchOpacity(3, t)).toBe(patchOpacity(3, t));
  });
});
