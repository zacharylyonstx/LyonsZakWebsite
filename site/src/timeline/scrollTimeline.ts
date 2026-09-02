// The Scroll=Travel core — grammar rule #1 of the whole site.
//
// Native page scroll is the single source of truth for where the visitor is
// on the journey. This module reads it (never writes it), normalizes it to a
// target in [0, 1], and follows that target with a critically damped spring
// so scenes receive motion that is smooth in both directions, frame-rate
// independent, and incapable of overshooting or ringing. The scrollbar stays
// honest; backward is the exact same law as forward.
//
// Design rules (binding for every consumer):
// - NEVER writes scrollY. There is deliberately no write path in ScrollSource.
// - Never hijacks scroll: no preventDefault, no wheel/touch listeners at all —
//   the browser owns scrolling; we only sample its result once per frame.
// - Test seam: a ScrollSource can be injected and frames stepped manually
//   (setTargetForTest / stepForTest), so the math is testable without a
//   browser. In a real browser the timeline drives itself from rAF.
// - hold()/release() (Task 5, the pocket system — grammar rule #2, stop +
//   interact): while held, step() is a no-op — `value` (what every scene
//   renders from) freezes exactly where it was, and no onFrame subscriber
//   fires, so a scene reading value() every frame simply keeps rendering
//   the same frame. This does NOT touch scroll in any way — no listener is
//   added or removed, no preventDefault, `window.scrollY` keeps changing
//   freely the whole time (see hold()'s own doc comment) — so it's a strict
//   extension of "never hijacks scroll", not an exception to it. release()
//   un-freezes: the very next step() re-samples the (possibly-moved) target
//   and the damped follower resumes from the held value, arriving at
//   wherever the visitor actually scrolled to — never a teleport.

/** Read-only view of native scroll. Deliberately has no write path. */
export interface ScrollSource {
  /** Current scroll position in px (window.scrollY). */
  scrollY(): number;
  /** Total scrollable px: scrollHeight − innerHeight. */
  maxScroll(): number;
}

export type FrameCallback = (value: number, target: number) => void;

export interface ScrollTimeline {
  /** Damped journey position, 0..1. What scenes render from. */
  value(): number;
  /** Raw scroll-derived position, 0..1. Where the scrollbar actually is. */
  target(): number;
  /** Subscribe to per-frame updates. Returns an unsubscribe function. */
  onFrame(cb: FrameCallback): () => void;
  /** Stop the rAF loop and drop all subscribers. Idempotent. */
  dispose(): void;
  /**
   * Test seam: set the target directly. Only meaningful when no ScrollSource
   * is attached (a source re-derives the target every step).
   */
  setTargetForTest(target: number): void;
  /** Test seam: advance one frame of dtMs milliseconds without rAF. */
  stepForTest(dtMs: number): void;
  /**
   * Freeze `value()` at whatever it currently is — every subsequent step()
   * is a no-op (no integration, no onFrame notification) until release().
   * Does NOT touch real scroll: no listener changes, no preventDefault; the
   * scrollbar keeps working exactly as before (see file header). This is
   * the primitive the pocket system's "stop + interact" grammar is built
   * on — opening a pocket holds the journey exactly where the visitor
   * stopped, without pausing or disabling the page's own scrolling.
   * Idempotent: calling hold() while already held is a no-op.
   */
  hold(): void;
  /**
   * Un-freeze: the next step() resumes normal damped integration from the
   * held value toward the current target (which may have moved while held,
   * since real scroll was never blocked) — travel continues smoothly from
   * the same spot, never a teleport. Idempotent: calling release() while
   * not held (including before any hold() at all) is a harmless no-op.
   */
  release(): void;
}

export interface ScrollTimelineOptions {
  /**
   * Stiffness of the critically damped follower, per second. Higher tracks
   * the scrollbar tighter; lower glides more. Default 5 ≈ settled within
   * roughly a second of the visitor stopping.
   */
  damping?: number;
  /**
   * Scroll input. Defaults to the window/document in a browser and to null
   * (pure manual stepping, for tests) elsewhere. Pass null explicitly to
   * force manual mode in a browser.
   */
  scrollSource?: ScrollSource | null;
  /**
   * Drive itself from requestAnimationFrame. Defaults to true in a browser
   * when a scroll source exists; always false otherwise.
   */
  autoStart?: boolean;
}

const DEFAULT_DAMPING = 5;
/** Cap a single integration step so a background-tab pause can't teleport. */
const MAX_STEP_MS = 100;
/** Close enough to snap to rest — kills asymptotic tail chatter. */
const REST_EPSILON = 1e-4;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

function windowScrollSource(): ScrollSource {
  return {
    scrollY: () => window.scrollY,
    maxScroll: () =>
      document.documentElement.scrollHeight - window.innerHeight,
  };
}

function readTarget(source: ScrollSource): number {
  const max = source.maxScroll();
  if (max <= 0) return 0;
  return clamp01(source.scrollY() / max);
}

export function createScrollTimeline(
  options: ScrollTimelineOptions = {},
): ScrollTimeline {
  const damping = options.damping ?? DEFAULT_DAMPING;
  // Constructor validation, not just the output clamp below: a review found
  // that a non-positive damping doesn't just fail to converge, it turns the
  // "critically damped" follower into an unbounded INTERNAL amplifier (the
  // exact-solution coefficients below assume damping > 0; with damping <= 0
  // the `exp(-damping * dt)` term grows instead of decaying, and velocity
  // compounds every step). The clamp on `value` inside step() was already
  // enough to keep anything a caller could ever READ inside [0,1], but the
  // instability itself was still reachable through the public API. Throwing
  // here — rather than silently clamping damping to some floor — closes
  // that root cause outright: a misconfigured timeline never exists at all,
  // instead of existing in a state whose internal velocity is already
  // unbounded and only presentation-clamped. `!(damping > 0)` doubles as the
  // NaN guard for free (NaN > 0 is false) and Number.isFinite catches the
  // ±Infinity edge `> 0` alone would miss.
  if (!Number.isFinite(damping) || damping <= 0) {
    throw new Error(
      `createScrollTimeline: damping must be a positive finite number ` +
        `(per-second critically-damped spring stiffness), got ${damping}.`,
    );
  }
  const hasWindow = typeof window !== 'undefined';
  const source =
    options.scrollSource !== undefined
      ? options.scrollSource
      : hasWindow
        ? windowScrollSource()
        : null;
  const autoStart = options.autoStart ?? (hasWindow && source !== null);

  // Start settled at wherever scroll already is: a mid-page reload must not
  // replay a cinematic catch-up from zero.
  let target = source ? readTarget(source) : 0;
  let value = target;
  let velocity = 0;
  let disposed = false;
  let held = false;
  const subscribers = new Set<FrameCallback>();

  function step(dtMs: number): void {
    if (disposed) return;
    if (held) {
      // Frozen: `value`/`velocity` deliberately untouched, no subscriber
      // notified (a scene reading value() every frame just keeps rendering
      // the same frame — see hold()'s doc comment). Still track a
      // source-derived target for free, purely so release() resumes toward
      // wherever the visitor actually is rather than a stale pre-hold
      // target — real scroll was never blocked, so this can legitimately
      // have moved. setTargetForTest bypasses this entirely (it writes
      // `target` directly, independent of step()), which is exactly what
      // the pocket tests use to simulate "the visitor scrolled while a
      // pocket sat open" without a DOM.
      if (source) target = readTarget(source);
      return;
    }
    const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS) / 1000;
    if (source) target = readTarget(source);

    // Exact discrete solution of a critically damped spring (x″ = −ω²(x−T) − 2ωx′).
    // Exact (not Euler) so large or uneven dt can never destabilize it, and
    // from rest it approaches the target monotonically — no overshoot ever.
    const exp = Math.exp(-damping * dt);
    const delta = value - target;
    const temp = (velocity + damping * delta) * dt;
    velocity = (velocity - damping * temp) * exp;
    value = target + (delta + temp) * exp;

    // Clamp the integrator's own state (not just what callers read): with a
    // fixed positive damping and a target that's always in [0,1], the exact
    // solution above is provably bounded to [0,1] (it's a convex combination
    // of past target values), so this is normally a no-op. The specific
    // invariant violation this was originally added to backstop — a
    // caller-supplied non-positive `damping` — is now rejected outright at
    // construction (see above), so this can no longer actually be reached
    // through the public API; it stays as defense-in-depth against any
    // other invariant this module doesn't enforce at the type level (e.g.
    // exotic float behavior), at zero cost. Clamping the
    // real `value` — not a separate presentation-only copy — keeps next
    // step's `delta` correctly bounded too: once pinned to a boundary, a
    // clamped position paired with its carried velocity always resolves the
    // same sign as the new delta (velocity and delta both point back toward
    // the target), so this can't itself introduce a re-overshoot; leaving
    // `value` unclamped internally, by contrast, would let a runaway state
    // keep compounding every frame instead of being cut off here.
    value = clamp01(value);

    if (
      Math.abs(value - target) < REST_EPSILON &&
      Math.abs(velocity) < REST_EPSILON
    ) {
      value = target;
      velocity = 0;
    }

    for (const cb of subscribers) cb(value, target);
  }

  let rafId = 0;
  let lastNow: number | null = null;
  function frame(now: number): void {
    step(lastNow === null ? 1000 / 60 : now - lastNow);
    lastNow = now;
    rafId = requestAnimationFrame(frame);
  }
  if (autoStart) rafId = requestAnimationFrame(frame);

  return {
    value: () => value,
    target: () => target,
    onFrame(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (rafId !== 0) cancelAnimationFrame(rafId);
      subscribers.clear();
    },
    setTargetForTest(t) {
      target = clamp01(t);
    },
    stepForTest(dtMs) {
      step(dtMs);
    },
    hold() {
      held = true;
    },
    release() {
      held = false;
    },
  };
}
