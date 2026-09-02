// The ship-pass sound layer's ambient bed (item 1) — a deliberately minimal,
// SYNTHESIZED Texas-night bed (Web Audio), quiet enough to sit under the
// film without competing with it.
//
// Two real sources were checked FIRST, per the brief, and both failed
// verification (full accounting in .recon/reports/ship-pass.md):
//   - the One Song Town master (.recon/final/band-music/
//     one-song-town-1080p-master.mp4): ebur128 momentary loudness sampled
//     every ~5s across its full 5:12 runtime never drops below about
//     -14 LUFS outside its own first ~1s of literal digital silence — it's
//     mixed hot start to finish. There is no quiet outdoor moment to loop.
//   - the EAS kit's own "quiet" stretches (fam-alien-eas-broadcast.mp4):
//     silencedetect at thresholds from -40dB to -3dB all resolved to either
//     broadcast content still in progress or literal digital silence at the
//     clip's tail (a spectrogram confirmed: one low-frequency burst, then
//     nothing) — no real room tone underneath it.
// So: synthesis, tuned deliberately spare to stay clear of the "cartoon
// crickets" kitsch risk the brief itself names — a filtered-noise "night
// air" bed plus sparse, IRREGULARLY-timed, multi-pulse chirps (never an
// even chirp-chirp-chirp loop, which is what reads as kitsch). Never
// autoplays: only ever started from a real user gesture (SoundToggle's
// click, or the persisted-on resume path in AmbientBedController, gated on
// the toggle already being on). Ties into nothing that could feed a
// visualization — this module exports no AnalyserNode and no per-frame
// audio value, so it can't touch rendering even by accident (the site's own
// audio-never-affects-determinism law).

// ---------------------------------------------------------------------------
// Pure pieces — deterministic given their inputs, unit-tested directly. The
// AudioContext wiring below calls these with real Math.random() samples,
// mirroring recordPlayer.ts's own split (fadeValue is pure/tested; the
// actual <audio> element wiring in BandScene.tsx isn't).
// ---------------------------------------------------------------------------

/** Fade duration for start/stop/duck — quiet enough not to click, quick
 *  enough not to feel laggy on a tab-blur duck. */
export const BED_FADE_SECONDS = 1.1;
/** The bed's peak linear gain — "-30 LUFS-ish quiet" per the brief, tuned by
 *  ear against the film's own ambience rather than derived from a formula
 *  (a true LUFS target needs a loudness meter this module doesn't carry). */
export const BED_PEAK_GAIN = 0.05;
export const CHIRP_PEAK_GAIN = 0.035;
export const CHIRP_MIN_DELAY_S = 2.4;
export const CHIRP_MAX_DELAY_S = 6.6;
export const NOISE_BUFFER_SECONDS = 6;
export const NOISE_LOWPASS_HZ = 700;

/** Next chirp's delay given a [0,1) random sample — the irregular timing IS
 *  the anti-kitsch device, so it's isolated here rather than left as an
 *  inline `Math.random()` call with no seam to test the shape of. */
export function chirpDelaySeconds(random01: number): number {
  return CHIRP_MIN_DELAY_S + random01 * (CHIRP_MAX_DELAY_S - CHIRP_MIN_DELAY_S);
}

/** How many quick pulses make up one chirp — 2 or 3, "an insect giving a
 *  few quick pulses," never a single held tone (which reads as a synth
 *  pad, not a cricket). */
export function chirpPulseCount(random01: number): 2 | 3 {
  return random01 < 0.5 ? 2 : 3;
}

/** One chirp's carrier frequency, Hz — a distant cricket's register. */
export function chirpFrequencyHz(random01: number): number {
  return 3600 + random01 * 1400;
}

/** One step of leaky-integrated ("brown-ish") noise: softer and more like
 *  night air than hissy white noise, without needing a filter node graph to
 *  hear the shape. Exported + pure (previous/white in, next out) so the
 *  ENVELOPE math is testable independent of Math.random()'s own output. */
export function brownNoiseStep(previous: number, white: number, leak = 0.02): number {
  return (previous + leak * white) / (1 + leak);
}

// ---------------------------------------------------------------------------
// The real Web Audio wiring — browser-only, not unit-tested (no
// AudioContext under vitest's node environment; see vitest.config.ts).
// ---------------------------------------------------------------------------

export interface AmbientBed {
  /** Idempotent: starting an already-running bed does nothing. Must be
   *  called from inside a real user gesture the first time (browsers
   *  otherwise create the AudioContext already suspended). */
  start(): void;
  /** Idempotent: stopping an already-stopped bed does nothing. Fades out,
   *  then actually tears down the graph. */
  stop(): void;
  /** Duck to silent (tab hidden) or restore — both ramp, never a hard cut.
   *  A no-op while the bed isn't running. */
  setDucked(ducked: boolean): void;
  /** Stop (if running) and release the AudioContext entirely. */
  dispose(): void;
}

function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < length; i++) {
    previous = brownNoiseStep(previous, Math.random() * 2 - 1);
    data[i] = previous * 3.2; // compensate the integrator's own gain loss
  }
  return buffer;
}

/** `createContext` is an injectable seam (tests never exercise this path —
 *  there is no AudioContext under vitest's node environment — but it keeps
 *  the constructor honest about its one real side effect). */
export function createAmbientBed(
  createContext: () => AudioContext = () => new AudioContext(),
): AmbientBed {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseSource: AudioBufferSourceNode | null = null;
  let chirpTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let ducked = false;

  function clearChirpTimer(): void {
    if (chirpTimer !== null) {
      clearTimeout(chirpTimer);
      chirpTimer = null;
    }
  }

  function scheduleChirp(): void {
    if (!ctx || !master) return;
    const delay = chirpDelaySeconds(Math.random());
    chirpTimer = setTimeout(() => {
      if (!ctx || !master || !running) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(chirpFrequencyHz(Math.random()), now);
      const chirpGain = ctx.createGain();
      chirpGain.gain.setValueAtTime(0, now);
      const pulses = chirpPulseCount(Math.random());
      const pulseSpacing = 0.09;
      for (let p = 0; p < pulses; p++) {
        const t0 = now + p * pulseSpacing;
        chirpGain.gain.linearRampToValueAtTime(CHIRP_PEAK_GAIN, t0 + 0.01);
        chirpGain.gain.linearRampToValueAtTime(0, t0 + 0.05);
      }
      osc.connect(chirpGain).connect(master);
      osc.start(now);
      const stopAt = now + pulses * pulseSpacing + 0.1;
      osc.stop(stopAt);
      osc.addEventListener('ended', () => {
        osc.disconnect();
        chirpGain.disconnect();
      });
      scheduleChirp();
    }, delay * 1000);
  }

  return {
    start() {
      if (running) return;
      running = true;
      if (!ctx) ctx = createContext();
      const activeCtx = ctx;
      if (activeCtx.state === 'suspended') {
        void activeCtx.resume();
        // Autoplay policy in most browsers suspends a freshly-created
        // AudioContext until an actual user gesture on THIS page load — the
        // toggle click that got us here counts, but if it doesn't land in
        // time (or this is the "resume a persisted-on preference" path,
        // which is a real gesture from a PRIOR visit, not this one), catch
        // the next one. One-shot, removes itself either way.
        const resumeOnGesture = () => {
          void activeCtx.resume();
        };
        window.addEventListener('pointerdown', resumeOnGesture, { once: true });
        window.addEventListener('keydown', resumeOnGesture, { once: true });
      }

      master = activeCtx.createGain();
      master.gain.setValueAtTime(0, activeCtx.currentTime);
      master.gain.linearRampToValueAtTime(
        ducked ? 0 : BED_PEAK_GAIN,
        activeCtx.currentTime + BED_FADE_SECONDS,
      );
      master.connect(activeCtx.destination);

      const filter = activeCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = NOISE_LOWPASS_HZ;

      noiseSource = activeCtx.createBufferSource();
      noiseSource.buffer = makeNoiseBuffer(activeCtx, NOISE_BUFFER_SECONDS);
      noiseSource.loop = true;
      noiseSource.connect(filter).connect(master);
      noiseSource.start();

      scheduleChirp();
    },
    stop() {
      if (!running) return;
      running = false;
      clearChirpTimer();
      const activeCtx = ctx;
      const activeMaster = master;
      const activeSource = noiseSource;
      noiseSource = null;
      master = null;
      if (!activeCtx || !activeMaster) return;
      const now = activeCtx.currentTime;
      activeMaster.gain.cancelScheduledValues(now);
      activeMaster.gain.setValueAtTime(activeMaster.gain.value, now);
      activeMaster.gain.linearRampToValueAtTime(0, now + BED_FADE_SECONDS);
      setTimeout(
        () => {
          activeSource?.stop();
          activeSource?.disconnect();
          activeMaster.disconnect();
        },
        BED_FADE_SECONDS * 1000 + 50,
      );
    },
    setDucked(next) {
      ducked = next;
      if (!ctx || !master || !running) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(ducked ? 0 : BED_PEAK_GAIN, now + BED_FADE_SECONDS);
    },
    dispose() {
      this.stop();
      if (ctx) {
        const activeCtx = ctx;
        ctx = null;
        setTimeout(() => void activeCtx.close().catch(() => {}), BED_FADE_SECONDS * 1000 + 100);
      }
    },
  };
}
