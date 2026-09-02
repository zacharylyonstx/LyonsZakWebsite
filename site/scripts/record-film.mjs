#!/usr/bin/env node
// The film recording — the archive's record-slice method (g11) carried to
// the v2 seven-scene film: deterministic seek-stepped frames captured
// against the dev-served site. Every frame is a real render of the real
// build at an exact scroll position along an AUTHORED cadence (below),
// assembled with ffmpeg. Not a realtime screen recording — but nothing in
// any frame is synthetic, and every settled frame is a pure function of its
// scroll position (the same law site/DETERMINISM.md pins).
//
// Method notes:
// - Drives the dev server with `?damping=90` (App.tsx's dev-only capture
//   instrument): a stiffer follower reaches exact settle fast; settled
//   frames are a pure function of position, so the damping value changes
//   nothing about what any frame looks like.
// - No dev UI anywhere: plain dev URL (no ?debug). The dev build still
//   registers the crossingDebug hooks this script reads.
// - The film's THREE ambient loops (DETERMINISM.md §1: the TEASPANKS frame,
//   the EAS TV, the keeper plaque flame) are pinned (crossingDebug.videosPinned) and each
//   one's currentTime is stepped per output frame against the recording
//   clock from the moment its scene window opens — in the assembled video
//   both loops play at true speed exactly where a visitor sees them.
// - CSS animations (the pocket glints' pulse — DETERMINISM.md §2) are
//   stepped deterministically per frame through the Web Animations API.
//
// Usage:
//   node scripts/record-film.mjs <workdir> [--fps 30] [--dpr 2] [--portrait]
//   Frames land in <workdir>/frames; the mp4 lands in site/recordings/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workdir = process.argv[2];
if (!workdir) {
  console.error('usage: node scripts/record-film.mjs <workdir> [--fps 30] [--dpr 2] [--portrait]');
  process.exit(1);
}
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const fps = parseInt(arg('fps', '30'), 10);
const dpr = parseFloat(arg('dpr', '2'));
const portrait = process.argv.includes('--portrait');
const W = portrait ? 390 : 1600;
const H = portrait ? 844 : 1000;
// Portrait delivers at 2x (the file is small); desktop at 1x from the 2x
// supersampled captures (the g11 precedent — visually lossless at crf 17).
const OUT_W = portrait ? W * 2 : W;
const OUT_H = portrait ? H * 2 : H;
const framesDir = path.join(workdir, 'frames');
mkdirSync(framesDir, { recursive: true });
const recordingsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'recordings');
mkdirSync(recordingsDir, { recursive: true });

// ---------------------------------------------------------------------------
// The authored cadence: recording seconds -> journey t, designed against the
// continuity re-cut segment map (segments.ts, journey 17,200px — t = px/17200 below) and the voice
// windows (film/voice.ts). The rules it was tuned by: rest where the film
// rests (every voice line gets its hold; the diptych gets its silence),
// breathe at the crossing (the jewel takes ~19s — the film's center), and
// land the ending (the end card resolves slowly and holds).
// ---------------------------------------------------------------------------
const CADENCE = [
  [0.0, 0.0], // the opening frame — ZAK LYONS over the flag kit
  [2.2, 0.0],
  [4.0, 0.0116], // travel begins; "Hi. I'm Zak…"
  [7.0, 0.0349],
  [9.0, 0.0523], // "That's me behind the kit. We'll get to the band."
  [11.5, 0.0727],
  [13.0, 0.0872], // the drummer's exit dusk breath
  [15.5, 0.1017], // Kaelbot + MilieuOS, line 1
  [19.5, 0.1424], // line 2
  [22.0, 0.1715], // dusk
  [23.5, 0.1773],
  [26.0, 0.1948], // the sparkler, "These two are Penny and Luke…"
  [28.0, 0.2151], // the transition bloom
  [31.0, 0.2413], // the rope swing, "Most of what I build…"
  [33.5, 0.2645], // dusk falls toward the playhouse night
  [37.0, 0.3052], // the build frame, "One winter I built them a playhouse…"
  [39.5, 0.3256], // the work light blooms — night becomes day
  [41.0, 0.3401], // the backyard photograph resolves
  [44.0, 0.3459], // STILLNESS — "This was our street — Royal Tara Cove…"
  [46.5, 0.3576],
  [50.0, 0.3814], // the photograph breathes (crossing p 0→0.13)
  [53.0, 0.393], // the invisible swap (p=0.2) and the peel begins
  [55.5, 0.4215], // the peel completes — the world is real
  [63.0, 0.5], // the departure flight over Royal Tara Cove
  [65.5, 0.5233], // resolving to street level
  [67.5, 0.5378], // the settle; "So I rebuilt it as a video game…"
  [71.0, 0.561], // the LYONS mailbox; the PLAY pill; the invitation glints
  [74.0, 0.5756], // "It's real, it's online…"
  [76.0, 0.5843], // dusk falls over the street; the band arrives
  [79.5, 0.5959], // the barn gig, "Law By The Gun…"
  [83.0, 0.6279], // the record — both pills on screen; "We made a record…"
  [86.5, 0.6483],
  [89.0, 0.6628], // band practice with the kids
  [91.0, 0.6733],
  [93.5, 0.6919], // TEASPANKS — the frame plays; "One day Luke made up a song…"
  [97.5, 0.7297], // "So I produced it…"
  [101.0, 0.7616], // the WATCH pill holds
  [103.0, 0.782], // dissolve toward the weird ones
  [105.5, 0.7994], // the MF-1 board, "…ghost-hunting hardware."
  [108.0, 0.8198], // beat cross-dissolve
  [111.0, 0.8401], // the TV hold — the broadcast plays; the line lands
  [114.0, 0.8663],
  [116.0, 0.8826], // the seam — TV ghost under the arriving sign
  [118.5, 0.8965], // the TEXAS sign, "I build things you can hold, too."
  [122.0, 0.9273], // the plaque + the box — the flame flickers
  [125.0, 0.9535], // day one arrives; "That was day one."
  [127.5, 0.9663], // now resolves; "This is now. Still the whole point."
  [129.5, 0.9767],
  [132.0, 0.9884], // the dusk breath; the signature resolves
  [134.0, 1.0],
  [138.0, 1.0], // held end state
];

// Monotone cubic (Fritsch–Carlson) through the keypoints: C1-smooth, no
// overshoot — the cadence never scrubs backward on its own.
function monotoneCubic(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const n = xs.length;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const m = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  m.push(slope[n - 2]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / dx[i];
    const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
    const h10 = t * (1 - t) * (1 - t);
    const h01 = t * t * (3 - 2 * t);
    const h11 = t * t * (t - 1);
    return h00 * ys[i] + h10 * dx[i] * m[i] + h01 * ys[i + 1] + h11 * dx[i] * m[i + 1];
  };
}
const cadence = monotoneCubic(CADENCE);
const DURATION = CADENCE[CADENCE.length - 1][0];
const TOTAL = Math.round(DURATION * fps) + 1;

// The two ambient loops' recording clocks: each starts playing (in the
// assembled video) the moment its scene window opens in the cadence above,
// and loops at true speed. Identified by delivered filename.
const VIDEO_CLOCKS = [
  { match: 'teaspanks', startRec: 92.0, duration: 5.9667 }, // the TEASPANKS frame's loop (fade-in ≈ t 0.674)
  { match: 'eas-broadcast', startRec: 109.0, duration: 63.0 }, // TV fade-in ≈ t 0.825
  { match: 'plaque-loop', startRec: 120.5, duration: 8.0 }, //   plaque fade-in ≈ t 0.916
];

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: dpr,
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[page]', msg.text());
});
await page.goto('http://localhost:5180/?damping=90');
await page.waitForFunction(
  () => window.crossingDebug && window.crossingDebug.refresh && window.crossingDebug.heroMap,
  null,
  { timeout: 60000 },
);
await page.waitForTimeout(6500); // GLBs + the last refresh timer
await page.evaluate(() => window.crossingDebug.refresh());
await page.waitForTimeout(400);

// Pin both ambient videos: this script owns their currentTime from here on.
await page.evaluate(() => {
  window.crossingDebug = Object.assign(window.crossingDebug ?? {}, {
    videosPinned: true,
  });
  for (const v of document.querySelectorAll('video')) v.pause();
});

const t0 = Date.now();
for (let i = 0; i < TOTAL; i++) {
  const recT = i / fps;
  const t = cadence(recT);
  // 1. seek + exact settle (the damped value snaps onto the target at rest).
  const seekOnce = () =>
    page.evaluate(
      (tt) =>
        new Promise((resolve, reject) => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, tt * max);
          const deadline = performance.now() + 20000;
          const tick = () => {
            const expectedT = Math.min(1, Math.max(0, window.scrollY / max));
            const journeyT = window.crossingDebug.journeyT();
            if (Math.abs(journeyT - expectedT) < 1e-9) {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
              return;
            }
            if (performance.now() > deadline) reject(new Error(`no settle at ${tt}`));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      t,
    );
  try {
    await seekOnce();
  } catch (err) {
    console.warn(`frame ${i} seek retrying: ${err.message ?? err}`);
    await seekOnce();
  }
  // 2. deterministic media + CSS-animation clocks for this frame
  await page.evaluate(
    ({ recT, clocks }) =>
      new Promise((resolve) => {
        for (const a of document.getAnimations({ subtree: true })) {
          try {
            if (a instanceof CSSAnimation) {
              a.pause();
              a.currentTime = recT * 1000;
            }
          } catch {
            /* transitions etc. — leave alone */
          }
        }
        const waits = [];
        for (const v of document.querySelectorAll('video')) {
          if (v.readyState < 1) continue;
          const clock = clocks.find((c) => (v.currentSrc || v.src).includes(c.match));
          if (!clock) continue;
          const want =
            recT <= clock.startRec
              ? 0
              : (recT - clock.startRec) % clock.duration;
          const clamped = Math.min(want, clock.duration - 0.05);
          if (Math.abs(v.currentTime - clamped) < 1 / 60) continue;
          waits.push(
            new Promise((done) => {
              v.addEventListener('seeked', done, { once: true });
              v.currentTime = clamped;
              setTimeout(done, 400);
            }),
          );
        }
        Promise.all(waits).then(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
        );
      }),
    { recT, clocks: VIDEO_CLOCKS },
  );
  // 3. capture — JPEG q95 (2x supersampled + the crf-17 encode is visually
  // lossless, half the disk of PNG, much faster at DPR 2), retried so one
  // slow compositor frame under load can't kill a one-session take (the
  // world's procedural textures differ per page load, so a take can never
  // be resumed across sessions).
  const framePath = path.join(framesDir, `frame-${String(i).padStart(5, '0')}.jpg`);
  let captured = false;
  for (let attempt = 0; attempt < 3 && !captured; attempt++) {
    try {
      await page.screenshot({ path: framePath, type: 'jpeg', quality: 95, timeout: 90000 });
      captured = true;
    } catch (err) {
      console.warn(`frame ${i} screenshot attempt ${attempt + 1} failed: ${err.message ?? err}`);
      if (attempt === 2) throw err;
      await page.waitForTimeout(1500);
    }
  }
  if (i % 150 === 0) {
    const el = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`frame ${i}/${TOTAL} (rec ${recT.toFixed(1)}s, t=${t.toFixed(4)}) [${el}s elapsed]`);
  }
}
await browser.close();

// 4. assemble
const out = path.join(
  recordingsDir,
  portrait
    ? `film-portrait-emulation-${W}x${H}-${fps}fps.mp4`
    : `film-desktop-${W}x${H}-${fps}fps.mp4`,
);
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame-%05d.jpg'),
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos`,
    '-c:v', 'libx264',
    '-crf', '17',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
console.log(`\nwrote ${out} (${DURATION}s at ${fps}fps, ${TOTAL} frames)`);
