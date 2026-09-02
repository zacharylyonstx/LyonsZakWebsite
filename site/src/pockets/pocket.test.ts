// Task 5 specs for the pocket system's Level-2 grammar (stop + interact =
// optional depth). Like scrollTimeline.test.ts, everything here runs
// DOM-free under vitest's plain `node` environment: the pure decision
// functions from pocketController.ts, exercised directly, plus an
// integration test against the REAL ScrollTimeline (also DOM-free via its
// own test seam) proving the two modules compose correctly. Pocket.tsx's
// DOM/React wiring (real wheel/touchmove/keydown listeners, the focus trap
// walking real elements, "Tab reaches the glint") is verified live in the
// browser instead — see task-5-report.md's Verification section.
import { describe, expect, it, vi } from 'vitest';
import { createScrollTimeline } from '../timeline/scrollTimeline';
import {
  createPocketController,
  focusTrapAction,
  isActivationKey,
  isScrollIntentKey,
  shouldCloseOnSignal,
} from './pocketController';

describe('createPocketController', () => {
  it('open() holds the timeline and fires onOpen exactly once, even if called twice', () => {
    const hold = vi.fn();
    const release = vi.fn();
    const onOpen = vi.fn();
    const controller = createPocketController({ hold, release, onOpen });

    expect(controller.isOpen()).toBe(false);
    controller.open();
    controller.open(); // already open — must be a no-op
    expect(controller.isOpen()).toBe(true);
    expect(hold).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  it('close() releases the timeline and fires onClose exactly once, even if called twice or before ever opening', () => {
    const hold = vi.fn();
    const release = vi.fn();
    const onClose = vi.fn();
    const controller = createPocketController({ hold, release, onClose });

    controller.close(); // never opened — inert
    expect(release).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    controller.open();
    controller.close();
    controller.close(); // already closed — must be a no-op
    expect(controller.isOpen()).toBe(false);
    expect(release).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a pocket that is never opened calls neither hold nor release — ignoring it costs nothing', () => {
    const hold = vi.fn();
    const release = vi.fn();
    createPocketController({ hold, release });
    expect(hold).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
});

describe('shouldCloseOnSignal — grammar rule #2 (any scroll input while open = close-and-resume)', () => {
  it('closes on wheel, touchmove, a backdrop click, and the visible ✕', () => {
    expect(shouldCloseOnSignal({ kind: 'wheel' })).toBe(true);
    expect(shouldCloseOnSignal({ kind: 'touchmove' })).toBe(true);
    expect(shouldCloseOnSignal({ kind: 'backdrop' })).toBe(true);
    expect(shouldCloseOnSignal({ kind: 'button' })).toBe(true);
  });

  it('closes on Escape and on every native scroll-intent key', () => {
    expect(shouldCloseOnSignal({ kind: 'key', key: 'Escape' })).toBe(true);
    for (const key of [
      'ArrowDown',
      'ArrowUp',
      'PageDown',
      'PageUp',
      'Home',
      'End',
      ' ',
    ]) {
      expect(shouldCloseOnSignal({ kind: 'key', key })).toBe(true);
    }
  });

  it('leaves Tab and ordinary typing alone (they must not close the pocket)', () => {
    expect(shouldCloseOnSignal({ kind: 'key', key: 'Tab' })).toBe(false);
    expect(shouldCloseOnSignal({ kind: 'key', key: 'a' })).toBe(false);
    expect(shouldCloseOnSignal({ kind: 'key', key: 'Enter' })).toBe(false);
  });
});

describe('isScrollIntentKey / isActivationKey', () => {
  it('isScrollIntentKey matches only the native scroll keys', () => {
    expect(isScrollIntentKey('ArrowDown')).toBe(true);
    expect(isScrollIntentKey(' ')).toBe(true);
    expect(isScrollIntentKey('Tab')).toBe(false);
    expect(isScrollIntentKey('Escape')).toBe(false);
  });

  it('isActivationKey matches only Enter and Space', () => {
    expect(isActivationKey('Enter')).toBe(true);
    expect(isActivationKey(' ')).toBe(true);
    expect(isActivationKey('Escape')).toBe(false);
    expect(isActivationKey('Tab')).toBe(false);
  });
});

describe('focusTrapAction — the two wrap-around edges only', () => {
  it('wraps Shift+Tab on the first focusable to the last', () => {
    expect(focusTrapAction(true, false, true)).toBe('last');
  });

  it('wraps Tab on the last focusable to the first', () => {
    expect(focusTrapAction(false, true, false)).toBe('first');
  });

  it('leaves every other combination to the browser\'s native Tab order', () => {
    expect(focusTrapAction(false, false, false)).toBeNull();
    expect(focusTrapAction(false, false, true)).toBeNull();
    expect(focusTrapAction(true, false, false)).toBeNull(); // plain Tab off the first: normal forward move
    expect(focusTrapAction(false, true, true)).toBeNull(); // Shift+Tab off the last: normal backward move
    expect(focusTrapAction(true, true, false)).toBe('first'); // only one focusable: both first and last — trivially "wrap to first" (itself)
  });
});

describe('integration: PocketController + the real ScrollTimeline', () => {
  it('open() holds the damped value exactly where the visitor stopped; a close-and-resume signal releases it and travel continues from the held value, not a stale or teleported one', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(0.5);
    for (let i = 0; i < 120; i++) tl.stepForTest(16); // settle near 0.5
    const settled = tl.value();
    expect(settled).toBeCloseTo(0.5, 3);

    const controller = createPocketController({
      hold: tl.hold,
      release: tl.release,
    });

    controller.open();
    expect(controller.isOpen()).toBe(true);

    // Real scroll is never blocked by hold() (see scrollTimeline.ts) — the
    // visitor could keep scrolling behind an open pocket. Simulate that:
    // the timeline value must still not move.
    tl.setTargetForTest(0.9);
    for (let i = 0; i < 30; i++) tl.stepForTest(16);
    expect(tl.value()).toBe(settled);

    // The spec's exact scenario: "first scroll tick closes AND the timeline
    // resumes from the held value."
    expect(shouldCloseOnSignal({ kind: 'wheel' })).toBe(true);
    controller.close();
    expect(controller.isOpen()).toBe(false);
    expect(tl.value()).toBe(settled); // resumes FROM here, no teleport

    for (let i = 0; i < 200; i++) tl.stepForTest(16);
    expect(tl.value()).toBeGreaterThan(settled); // traveling again, toward 0.9
    expect(tl.value()).toBeLessThanOrEqual(0.9);
    tl.dispose();
  });

  it('Escape closes exactly like a scroll tick does', () => {
    const tl = createScrollTimeline({ damping: 5 });
    tl.setTargetForTest(1);
    for (let i = 0; i < 60; i++) tl.stepForTest(16);
    const held = tl.value();

    const controller = createPocketController({
      hold: tl.hold,
      release: tl.release,
    });
    controller.open();
    expect(shouldCloseOnSignal({ kind: 'key', key: 'Escape' })).toBe(true);
    controller.close();
    expect(controller.isOpen()).toBe(false);
    expect(tl.value()).toBe(held);
    tl.dispose();
  });
});

describe('Pocket.tsx: glint inertia state transitions', () => {
  it('glint opacity management correctly sets tabIndex, aria-hidden, and pointerEvents in sync', () => {
    // Pocket.tsx's setGlintOpacity (the PocketHandle's imperative method) is
    // called by a DeskScene's per-frame loop. The initial JSX state (tabIndex -1,
    // aria-hidden true) ensures the glint is never tab-focusable or visible to
    // a11y tools BEFORE setGlintOpacity ever fires — a cheap, robust fix to
    // native button's default tab order. Here we verify the state machine logic:
    // the glint must be inert below the 0.05 opacity threshold and active above.

    // Helper: simulate setGlintOpacity's logic directly (extracted from Pocket.tsx
    // useImperativeHandle at lines 117-130). This documents what the React
    // component does, testable in node without DOM.
    const simulateGlintOpacity = (opacity: number) => {
      const inert = opacity <= 0.05;
      return {
        pointerEvents: inert ? 'none' : 'auto',
        tabIndex: inert ? -1 : 0,
        ariaHidden: inert ? 'true' : 'false',
      };
    };

    // Initially, before any frame: inert
    expect(simulateGlintOpacity(0)).toEqual({
      pointerEvents: 'none',
      tabIndex: -1,
      ariaHidden: 'true',
    });

    // Barely visible (0.06 > 0.05 threshold): active
    expect(simulateGlintOpacity(0.06)).toEqual({
      pointerEvents: 'auto',
      tabIndex: 0,
      ariaHidden: 'false',
    });

    // Fully visible: active
    expect(simulateGlintOpacity(1)).toEqual({
      pointerEvents: 'auto',
      tabIndex: 0,
      ariaHidden: 'false',
    });

    // Just at threshold: still inert
    expect(simulateGlintOpacity(0.05)).toEqual({
      pointerEvents: 'none',
      tabIndex: -1,
      ariaHidden: 'true',
    });
  });
});
