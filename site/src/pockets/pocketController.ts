// Pure, DOM-free core of the Level-2 "pocket" contract (grammar rule #2:
// stop + interact = optional depth). Pocket.tsx wires the functions below to
// real DOM events, React state, and the ScrollTimeline; this module is the
// part that's unit-testable under vitest's plain `node` environment (see
// vitest.config.ts's own rationale — no jsdom, no React render, no browser)
// — same split as scrollTimeline.ts (math/logic) vs App.tsx (wiring), or
// deskChoreography.ts (pure) vs DeskScene.tsx (React/WebGL).

/**
 * Every real input that MIGHT close an open pocket, normalized to one of
 * these before it reaches shouldCloseOnSignal — see Pocket.tsx's listeners.
 */
export type PocketCloseSignal =
  | { readonly kind: 'wheel' }
  | { readonly kind: 'touchmove' }
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'backdrop' }
  | { readonly kind: 'button' };

/**
 * Keys that represent "the visitor wants to keep traveling" — the browser's
 * own native-scroll keys. Grammar rule #2 ("any scroll input while open =
 * close-and-resume") treats these exactly like a wheel tick. Escape is its
 * own explicit close path (handled separately in shouldCloseOnSignal, not
 * folded into this set), and Tab is deliberately excluded — it drives the
 * focus trap, not a close.
 */
const SCROLL_INTENT_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
  ' ', // Space — scrolls the page when focus isn't on a control that eats it
]);

export function isScrollIntentKey(key: string): boolean {
  return SCROLL_INTENT_KEYS.has(key);
}

/**
 * Keys that activate a focused glint. A real <button> already does this for
 * free via native click-on-Enter/Space semantics, but the decision is still
 * pulled out here (rather than left implicit in a DOM handler) so it has a
 * DOM-free test — see pocket.test.ts.
 */
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/**
 * Should `signal` close an open pocket? Everything closes it except a bare
 * key press that is neither Escape nor a scroll-intent key (e.g. Tab, or a
 * letter typed into nothing) — those are left alone so the focus trap and
 * ordinary typing keep working undisturbed.
 */
export function shouldCloseOnSignal(signal: PocketCloseSignal): boolean {
  switch (signal.kind) {
    case 'wheel':
    case 'touchmove':
    case 'backdrop':
    case 'button':
      return true;
    case 'key':
      return signal.key === 'Escape' || isScrollIntentKey(signal.key);
  }
}

/**
 * Focus-trap edge behavior. The browser's own Tab order already handles
 * every transition BETWEEN two focusable elements inside the dialog — the
 * trap only needs to intervene at the two wrap-around edges. Returns which
 * end to jump focus to, or null to let Tab proceed natively (including the
 * "first focusable, plain Tab" and "last focusable, Shift+Tab" cases, which
 * are ordinary forward/backward moves, not wraps).
 */
export function focusTrapAction(
  isFirst: boolean,
  isLast: boolean,
  shiftKey: boolean,
): 'first' | 'last' | null {
  if (shiftKey && isFirst) return 'last';
  if (!shiftKey && isLast) return 'first';
  return null;
}

export interface PocketControllerDeps {
  /** Freeze the journey timeline — ScrollTimeline.hold(), or a test double. */
  hold: () => void;
  /** Un-freeze it — ScrollTimeline.release(), or a test double. */
  release: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface PocketController {
  isOpen(): boolean;
  /** Idempotent: opening an already-open pocket does nothing. */
  open(): void;
  /** Idempotent: closing an already-closed pocket does nothing. */
  close(): void;
}

/**
 * The open/closed state machine: open() holds the timeline and fires
 * onOpen exactly once per open, close() releases it and fires onClose
 * exactly once per close — by ANY path (a scroll tick, Escape, the visible
 * ✕, or a backdrop click all funnel through the same close()). Idempotency
 * matters here specifically because several of Pocket.tsx's real listeners
 * can plausibly fire close() for the same user gesture (e.g. a click that
 * is both "on the backdrop" and triggers a synthetic key event) — this
 * guarantees hold/release, and onOpen/onClose, are each still called
 * exactly once regardless of how many of those paths fire.
 */
export function createPocketController(
  deps: PocketControllerDeps,
): PocketController {
  let open = false;
  return {
    isOpen: () => open,
    open() {
      if (open) return;
      open = true;
      deps.hold();
      deps.onOpen?.();
    },
    close() {
      if (!open) return;
      open = false;
      deps.release();
      deps.onClose?.();
    },
  };
}
