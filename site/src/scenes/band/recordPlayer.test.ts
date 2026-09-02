// Contract tests for THE RECORD's audio-discovery state machine. Pins:
//   idempotency        -> play()/stop() called twice in a row never
//                          double-fires startAudio/stopAudio
//   never autoplay      -> the controller starts idle and calls neither dep
//                          until play() is explicitly invoked
//   scroll-away stops it -> onPotentialStopSignal recognizes exactly the
//                          same signal set the pocket grammar does
//   the fade curve       -> fadeValue is a pure, clamped interpolation
import { describe, expect, it, vi } from 'vitest';
import {
  createRecordPlayerController,
  fadeValue,
  onPotentialStopSignal,
} from './recordPlayer';

describe('createRecordPlayerController', () => {
  it('starts idle and never autoplays', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    expect(controller.state()).toBe('idle');
    expect(startAudio).not.toHaveBeenCalled();
    expect(stopAudio).not.toHaveBeenCalled();
  });

  it('play() transitions to playing and calls startAudio exactly once', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    controller.play();
    expect(controller.state()).toBe('playing');
    expect(startAudio).toHaveBeenCalledTimes(1);
    expect(stopAudio).not.toHaveBeenCalled();
  });

  it('play() while already playing is idempotent (no double-start)', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    controller.play();
    controller.play();
    controller.play();
    expect(startAudio).toHaveBeenCalledTimes(1);
  });

  it('stop() transitions to idle and calls stopAudio exactly once', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    controller.play();
    controller.stop();
    expect(controller.state()).toBe('idle');
    expect(stopAudio).toHaveBeenCalledTimes(1);
  });

  it('stop() while already idle is idempotent (no-op)', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    controller.stop();
    controller.stop();
    expect(stopAudio).not.toHaveBeenCalled();
  });

  it('supports a full play -> stop -> play -> stop cycle', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    controller.play();
    controller.stop();
    controller.play();
    controller.stop();
    expect(startAudio).toHaveBeenCalledTimes(2);
    expect(stopAudio).toHaveBeenCalledTimes(2);
  });
});

describe('onPotentialStopSignal (scroll-away)', () => {
  function makeController() {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    controller.play();
    return { controller, stopAudio };
  }

  it('a wheel tick stops playback', () => {
    const { controller, stopAudio } = makeController();
    onPotentialStopSignal(controller, { kind: 'wheel' });
    expect(controller.state()).toBe('idle');
    expect(stopAudio).toHaveBeenCalledTimes(1);
  });

  it('a touchmove stops playback', () => {
    const { controller, stopAudio } = makeController();
    onPotentialStopSignal(controller, { kind: 'touchmove' });
    expect(controller.state()).toBe('idle');
    expect(stopAudio).toHaveBeenCalledTimes(1);
  });

  it('a scroll-intent key (ArrowDown) stops playback', () => {
    const { controller, stopAudio } = makeController();
    onPotentialStopSignal(controller, { kind: 'key', key: 'ArrowDown' });
    expect(controller.state()).toBe('idle');
    expect(stopAudio).toHaveBeenCalledTimes(1);
  });

  it('Escape stops playback', () => {
    const { controller, stopAudio } = makeController();
    onPotentialStopSignal(controller, { kind: 'key', key: 'Escape' });
    expect(controller.state()).toBe('idle');
    expect(stopAudio).toHaveBeenCalledTimes(1);
  });

  it('an unrelated key (e.g. Tab) does NOT stop playback', () => {
    const { controller, stopAudio } = makeController();
    onPotentialStopSignal(controller, { kind: 'key', key: 'Tab' });
    expect(controller.state()).toBe('playing');
    expect(stopAudio).not.toHaveBeenCalled();
  });

  it('is a no-op when already idle', () => {
    const startAudio = vi.fn();
    const stopAudio = vi.fn();
    const controller = createRecordPlayerController({ startAudio, stopAudio });
    onPotentialStopSignal(controller, { kind: 'wheel' });
    expect(stopAudio).not.toHaveBeenCalled();
  });
});

describe('fadeValue', () => {
  it('returns `from` at elapsed=0', () => {
    expect(fadeValue(0, 1000, 0, 1)).toBe(0);
  });

  it('returns `to` at elapsed=duration', () => {
    expect(fadeValue(1000, 1000, 0, 1)).toBe(1);
  });

  it('interpolates linearly at the midpoint', () => {
    expect(fadeValue(500, 1000, 0, 1)).toBeCloseTo(0.5, 10);
  });

  it('clamps beyond the duration to `to`', () => {
    expect(fadeValue(5000, 1000, 0, 1)).toBe(1);
  });

  it('clamps negative elapsed to `from`', () => {
    expect(fadeValue(-500, 1000, 0, 1)).toBe(0);
  });

  it('handles a fade-OUT (from > to) the same way', () => {
    expect(fadeValue(0, 1000, 1, 0)).toBe(1);
    expect(fadeValue(1000, 1000, 1, 0)).toBe(0);
    expect(fadeValue(250, 1000, 1, 0)).toBeCloseTo(0.75, 10);
  });

  it('returns `to` immediately when duration is 0', () => {
    expect(fadeValue(0, 0, 0, 1)).toBe(1);
  });

  it('is a pure function (same inputs, same output)', () => {
    expect(fadeValue(333, 1000, 0.2, 0.9)).toBe(fadeValue(333, 1000, 0.2, 0.9));
  });
});
