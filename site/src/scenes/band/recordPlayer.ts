// THE RECORD's audio-discovery state machine — pure, DOM-free (the same
// split as pocketController.ts vs Pocket.tsx: this module is unit-testable
// under vitest's plain `node` environment; BandScene.tsx wires it to the
// real <audio> element, real DOM events, and real timers).
//
// Grammar (the scene brief): a play affordance, never autoplay, playing
// pauses ONLY on scroll-away (fade out), never hijacks scroll. This is
// deliberately NOT the full Pocket contract (Pocket.tsx holds the journey
// timeline while its dialog is open) — the record must let the visitor keep
// scrolling while the excerpt plays, so there is no timeline.hold() anywhere
// in this file. What IS reused from the pocket grammar (per the brief:
// "pocket laws apply either way") is pocketController's own
// shouldCloseOnSignal — the exact same "any scroll input closes it" rule,
// applied here to mean "any scroll input stops it".
import { shouldCloseOnSignal, type PocketCloseSignal } from '../../pockets/pocketController';

export type RecordPlaybackState = 'idle' | 'playing';

export interface RecordPlayerDeps {
  /** Begin playback (fade in from 0) — called at most once per play(). */
  startAudio: () => void;
  /** Stop playback (fade out, then pause) — called at most once per stop(). */
  stopAudio: () => void;
}

export interface RecordPlayerController {
  state(): RecordPlaybackState;
  /** Idempotent: pressing play while already playing does nothing (no
   *  double-start, no restart-from-zero mid-listen). */
  play(): void;
  /** Idempotent: stopping an already-idle player does nothing. */
  stop(): void;
}

/**
 * The open/closed-equivalent state machine for the record's audio: play()
 * starts it and fires startAudio exactly once per play, stop() ends it and
 * fires stopAudio exactly once per stop — by ANY path (the visible ▶
 * button, a scroll tick, the excerpt reaching its natural end). Idempotency
 * matters for the same reason createPocketController's does: several real
 * listeners (a wheel tick AND a keyboard scroll-intent key firing in close
 * succession, say) can plausibly call stop() for what is really one user
 * gesture.
 */
export function createRecordPlayerController(
  deps: RecordPlayerDeps,
): RecordPlayerController {
  let state: RecordPlaybackState = 'idle';
  return {
    state: () => state,
    play() {
      if (state === 'playing') return;
      state = 'playing';
      deps.startAudio();
    },
    stop() {
      if (state === 'idle') return;
      state = 'idle';
      deps.stopAudio();
    },
  };
}

/**
 * Wires one potential close signal into a controller: stops playback iff
 * the signal is one shouldCloseOnSignal recognizes (wheel, touchmove, a
 * scroll-intent key, or Escape) — the exact pocket-grammar rule the file
 * header describes, exposed as its own pure function so the "scroll-away
 * stops the record" behavior is unit-testable without mounting any DOM.
 */
export function onPotentialStopSignal(
  controller: RecordPlayerController,
  signal: PocketCloseSignal,
): void {
  if (shouldCloseOnSignal(signal)) controller.stop();
}

/**
 * Pure linear interpolation for the record's two fades (the 1s
 * fade-in/out baked into the excerpt file itself is separate — see
 * scene5-report.md — this is the JS-driven interrupt fade that runs when
 * the visitor scrolls away mid-listen, since that moment can't be baked
 * into a file ahead of time). `elapsedMs` is caller-supplied (typically
 * from a rAF timestamp delta), so this stays a pure function of its inputs
 * rather than reading a clock itself — the fade's SHAPE is deterministic
 * and testable even though its real-world timing is wall-clock (audio
 * playback state is explicitly exempted from the frame-determinism law —
 * see the scene brief's "audio state is user-initiated and does not affect
 * rendering determinism" clause).
 */
export function fadeValue(
  elapsedMs: number,
  durationMs: number,
  from: number,
  to: number,
): number {
  if (durationMs <= 0) return to;
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return from + (to - from) * t;
}

/** The interrupt fade's duration (ms) — "fade out" per the brief, matching
 *  the excerpt file's own baked 1s fades so no transition in this scene
 *  reads faster or slower than any other. */
export const STOP_FADE_MS = 1000;
