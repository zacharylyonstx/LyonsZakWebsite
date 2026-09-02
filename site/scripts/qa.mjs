#!/usr/bin/env node
// QA driver for the crossing IN THE INTEGRATED JOURNEY (the real page on
// port 5180) — Task 7 adaptation of the Task 2 driver (which drove the
// ?scene=crossing harness, where journey t == crossing p). The real page
// maps journey t -> crossing p through heroChoreography.ts
// (handoff + hold + the tuned hero segment); this script NEVER duplicates
// that math — it reads the live mapping from the dev-only
// window.crossingDebug.heroMap hook HeroScene publishes, so the
// byte-invariant checkpoints stay exactly the crossing's own p values no
// matter how the segments are tuned.
//
// The site timeline NEVER writes or snaps scroll. Seeking here is the real
// law: scroll the page like a visitor, then wait for the damped timeline to
// settle EXACTLY on target (it snaps to rest below a 1e-4 epsilon, so exact
// settle is reachable and every capture is a pure function of p).
//
// Usage:
//   node scripts/qa.mjs shot 0.28 out.png [--w 1600 --h 1000 --dpr 1 --pure --masksoff]
//       # p is CROSSING progress (mapped to journey t in-page); pass --t to
//       # treat the value as raw journey t instead (for arrival captures).
//   node scripts/qa.mjs sweep outdir [--w --h --dpr]  # fwd stills + back-scrub reversibility byte-diff
//       # reversal scrubs to JOURNEY END (t=1.0, through the whole arrival)
//       # and back — stronger than the harness version, which could only
//       # reach crossing p=1.
//   node scripts/qa.mjs swap outdir                   # masks-on/off identity at the matched pose (p=0.20)
//   node scripts/qa.mjs perf [--checkpoints 0.75,0.85 --seconds 6 --dpr 2 --amp 0.016 --opt kill,...]
//       # HEADED chromium (real GPU), native DPR, scrub-fps via the in-page
//       # probe (dev-only crossingDebug.perfStart) + renderer.info counters.
//       # amp default 0.016 JOURNEY units ≈ Task 2's 0.028 in crossing-p
//       # units (journey->p slope inside the crossing is 1/(0.625*0.91)).
//   node scripts/qa.mjs coldfling [--w --h --dpr]
//       # the inherited REQUIRED TEST: cold load -> immediately fling-scroll
//       # to the street reveal; records every rAF delta for 14s with phase
//       # marks (scene mount, assets ready) and reports the first-scrub
//       # frame times.
//   node scripts/qa.mjs desksweep outdir [--w --h --dpr]
//       # Task 9 (carry-forward (b)): DESK-range reversibility byte-diff
//       # after DeskRig's fov exact-compare fix. Journey-t stops inside the
//       # desk segment; the monitor video is pinned to a fixed frame and
//       # the ZakCursor DOM overlay excluded (see the command's comment).
//
// Task 9 flags (all commands):
//   --tier full|balanced|essential   loads the page with ?tier= (the probe
//       override); essential runs wait on crossingDebug.essentialReady
//       instead of the crossing's refresh hook.
//   perf --tj   treats --checkpoints as JOURNEY-t values (span all
//       segments) instead of crossing-p — the 6-checkpoint tier matrix.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BASE_URL = 'http://localhost:5180/?debug=1';

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

/** Compose the page URL from the base + optional &opt= / &tier= params. */
function pageUrl({ opt, tier }) {
  let url = BASE_URL;
  if (opt != null) url += `&opt=${opt}`;
  if (tier != null) url += `&tier=${tier}`;
  return url;
}

async function openPage(browser, { w, h, dpr, opt, tier }) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: dpr,
  });
  await page.goto(pageUrl({ opt, tier }));
  if (String(tier).toUpperCase() === 'ESSENTIAL') {
    // The essential tier mounts no live crossing: readiness is its own
    // flag + HeroScene's heroMap (published regardless of tier).
    await page.waitForFunction(
      () =>
        window.crossingDebug &&
        window.crossingDebug.essentialReady &&
        window.crossingDebug.heroMap,
      null,
      { timeout: 60000 },
    );
    await page.waitForTimeout(500);
    return page;
  }
  // crossingDebug.refresh appears once assets are loaded and the crossing's
  // Canvas mounted (early mount: this happens during the name segment);
  // heroMap is HeroScene's journey<->p mapping.
  await page.waitForFunction(
    () =>
      window.crossingDebug &&
      window.crossingDebug.refresh &&
      window.crossingDebug.heroMap,
    null,
    { timeout: 60000 },
  );
  // let GLBs land, then force a fresh material patch + projector depth prepass
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.crossingDebug.refresh());
  await page.waitForTimeout(300);
  return page;
}

/** Scroll to JOURNEY position t and wait for the damped timeline to settle
 *  exactly (value snaps onto target at rest — deterministic captures). The
 *  settle check uses the page's own mapping (crossingDebug.heroMap) so the
 *  awaited crossing-p is exactly what the scene itself computes. */
async function seekJourney(page, t) {
  await page.evaluate(
    (tt) =>
      new Promise((resolve, reject) => {
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, tt * max);
        const deadline = performance.now() + 60000;
        const tick = () => {
          const expectedT = Math.min(1, Math.max(0, window.scrollY / max));
          const expectedP = window.crossingDebug.heroMap.pForT(expectedT);
          const s = window.crossingDebug.getState();
          const journeyT = window.crossingDebug.journeyT();
          if (
            Math.abs(s.p - expectedP) < 1e-9 &&
            Math.abs(journeyT - expectedT) < 1e-9
          ) {
            // two more frames so uniform writes + renders are flushed
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(s)));
            return;
          }
          if (performance.now() > deadline) {
            reject(
              new Error(
                `seekJourney(${tt}) did not settle: p=${s.p} expectedP=${expectedP} t=${journeyT} expectedT=${expectedT}`,
              ),
            );
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    t,
  );
  await page.waitForTimeout(120);
}

/** Scroll so the CROSSING shows exactly progress p (journey t via heroMap). */
async function seek(page, p) {
  const t = await page.evaluate(
    (pp) => window.crossingDebug.heroMap.tForP(pp),
    p,
  );
  await seekJourney(page, t);
}

async function diffPng(fileA, fileB) {
  const a = await sharp(fileA).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(fileB).raw().toBuffer({ resolveWithObject: true });
  if (a.data.length !== b.data.length) return { error: 'size mismatch' };
  let max = 0;
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < a.data.length; i++) {
    const d = Math.abs(a.data[i] - b.data[i]);
    if (d > max) max = d;
    sum += d;
    if (d > 2) changed++;
  }
  return { maxDiff: max, meanDiff: sum / a.data.length, changedPct: (100 * changed) / a.data.length };
}

const pad = (p) => String(Math.round(p * 100)).padStart(3, '0');

async function main() {
  const cmd = process.argv[2];
  const w = parseInt(arg('w', '1600'), 10);
  const h = parseInt(arg('h', '1000'), 10);
  const dpr = parseFloat(arg('dpr', '1'));
  const tier = arg('tier', null); // full | balanced | essential (Task 9)
  // Real GPU even headless: software GL runs rAF at ~2-5fps here, which slows
  // the production page's REAL damped timeline (settling would take minutes).
  // Byte determinism is unaffected either way; this is about honest timing.
  const browser = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  try {
    if (cmd === 'shot') {
      const p = parseFloat(process.argv[3]);
      const out = process.argv[4];
      const page = await openPage(browser, { w, h, dpr, tier });
      if (process.argv.includes('--pure')) {
        // pure game render at the same pose: no photo, no grade, no receivers
        await page.evaluate(() =>
          window.crossingDebug.setOverride({ photoStrength: 0, gradeStrength: 0, netFade: 0, skyFade: 0 })
        );
      }
      if (process.argv.includes('--masksoff')) {
        await page.evaluate(() => { window.crossingDebug.uniforms.uMasksOn.value = 0; });
      }
      if (process.argv.includes('--t')) {
        await seekJourney(page, p); // value was journey t, not crossing p
      } else {
        await seek(page, p);
      }
      await page.screenshot({ path: out });
      console.log(`wrote ${out}`);
      // --eval "<js expression>" — print a value from the settled page (a
      // DOM probe next to the screenshot; e.g. an affordance's computed
      // style). Added 2026-09-01 for the continuity re-cut's DOM pills.
      const evalIdx = process.argv.indexOf('--eval');
      if (evalIdx > 0) {
        const expr = process.argv[evalIdx + 1];
        const result = await page.evaluate((e) => {
          try {
            return JSON.stringify(new Function(`return (${e})`)());
          } catch (err) {
            return `eval error: ${err && err.message}`;
          }
        }, expr);
        console.log(`eval: ${result}`);
      }
    } else if (cmd === 'sweep') {
      const outdir = process.argv[3];
      mkdirSync(outdir, { recursive: true });
      const page = await openPage(browser, { w, h, dpr, tier });
      // forward stills — includes the artifact-peak parity checkpoints
      // (0.20/0.22/0.30/0.34) and the reversibility stops (0.14/0.26/0.31/0.85)
      const stops = [0, 0.08, 0.14, 0.2, 0.22, 0.25, 0.26, 0.3, 0.31, 0.34, 0.55, 0.7, 0.75, 0.85, 1.0];
      for (const p of stops) {
        await seek(page, p);
        await page.screenshot({ path: path.join(outdir, `fwd-${pad(p)}.png`) });
      }
      // reversibility: scrub to JOURNEY END (t=1.0 — through the crossing's
      // end AND the whole arrival settle) then back to each required
      // checkpoint — street reveal (0.85, wall-clock-frozen prop region),
      // mid-departure (0.31, 0.26), and a phase-1 stop (0.14). Must be
      // maxDiff 0: the arrival camera override may never leak state into
      // the crossing's own p-range.
      let failed = false;
      for (const p of [0.85, 0.31, 0.26, 0.14]) {
        await seekJourney(page, 1.0);
        await seek(page, p);
        const back = path.join(outdir, `back-${pad(p)}.png`);
        await page.screenshot({ path: back });
        const fwd = path.join(outdir, `fwd-${pad(p)}.png`);
        const d = await diffPng(fwd, back);
        console.log(`reversibility p=${p}:`, d);
        if (d.maxDiff !== 0) failed = true;
      }
      console.log(failed ? 'SWEEP FAIL (maxDiff > 0 somewhere)' : 'SWEEP PASS (maxDiff 0 at all stops)');
      if (failed) process.exitCode = 1;
    } else if (cmd === 'tsweep') {
      // JOURNEY-T byte sweep for scene work (Scene 1+): forward stills at
      // the given journey positions, then reversibility — scrub to journey
      // end and back to every stop; maxDiff must be 0. Unlike 'sweep' this
      // takes RAW journey t (no heroMap indirection), so it works for any
      // segment regardless of how the crossing maps p.
      //   node scripts/qa.mjs tsweep outdir --stops 0,0.03,0.06,0.10
      //   node scripts/qa.mjs tsweep outdir --stops 0.76,0.82 --pinvideo 1.0
      //       # THE WEIRD ONES's own signed wall-clock exception (the TV's
      //       # always-playing ambient loop): pins the lone unconditionally-
      //       # mounted <video> to a fixed decoded frame before EVERY
      //       # capture (forward and back), the desksweep precedent below
      //       # applied to a WebGL video TEXTURE instead of a DOM <video>.
      //       # Every other pixel in the scene stays a pure function of t;
      //       # only this one element is excluded from the determinism law.
      const outdir = process.argv[3];
      mkdirSync(outdir, { recursive: true });
      const stops = arg('stops', '0,0.03,0.06,0.1')
        .split(',')
        .map((s) => parseFloat(s));
      const pinVideoAt = arg('pinvideo', null);
      const page = await openPage(browser, { w, h, dpr, tier });
      // Scene 7 evolution (anticipated in scene6-report.md concern #6): the
      // film now has TWO unconditionally-mounted ambient <video> loops (the
      // EAS TV + the keeper plaque), so the pin targets querySelectorAll and
      // raises crossingDebug.videosPinned — the desksweep deskVideoPinned
      // precedent, generalized — so the scenes' own per-frame play() resume
      // stands down while pinned. A double-rAF flush after the seeks lets
      // the VideoTextures re-upload the pinned frames before capture.
      const pinVideo = async () => {
        if (pinVideoAt == null) return;
        await page.evaluate(
          (ct) =>
            Promise.all(
              Array.from(document.querySelectorAll('video')).map(
                (v) =>
                  new Promise((resolve) => {
                    window.crossingDebug = Object.assign(
                      window.crossingDebug ?? {},
                      { videosPinned: true },
                    );
                    v.pause();
                    const done = () => resolve(true);
                    v.addEventListener('seeked', done, { once: true });
                    v.currentTime = ct;
                    setTimeout(done, 1500); // fallback: seeked may not fire twice
                  }),
              ),
            ).then(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            ),
          parseFloat(pinVideoAt),
        );
      };
      const padT = (t) => String(Math.round(t * 1000)).padStart(4, '0');
      for (const t of stops) {
        await seekJourney(page, t);
        await pinVideo();
        await page.screenshot({ path: path.join(outdir, `fwd-t${padT(t)}.png`) });
      }
      let failed = false;
      for (const t of stops) {
        await seekJourney(page, 1.0);
        await seekJourney(page, t);
        await pinVideo();
        const back = path.join(outdir, `back-t${padT(t)}.png`);
        await page.screenshot({ path: back });
        const d = await diffPng(path.join(outdir, `fwd-t${padT(t)}.png`), back);
        console.log(`tsweep reversibility t=${t}:`, d);
        if (d.maxDiff !== 0) failed = true;
      }
      console.log(
        failed
          ? 'TSWEEP FAIL (maxDiff > 0 somewhere)'
          : 'TSWEEP PASS (maxDiff 0 at all stops)',
      );
      if (failed) process.exitCode = 1;
    } else if (cmd === 'desksweep') {
      // Task 9 (carry-forward (b)): the DESK-range byte sweep, run after
      // DeskRig's fov exact-compare fix. Three legitimate exclusions are
      // pinned before byte-diffing:
      //   * the monitor video — paused at a fixed currentTime (the texture
      //     then re-uploads the same decoded frame every render);
      //   * the mug glint's CSS pulse — only live at desk-local p >= 0.86,
      //     so every stop below stays clear of it;
      //   * the ZakCursor overlay — hidden for the capture. Its REPLAY math
      //     is a pure function of p (unit-tested in replay.test.ts) and its
      //     DOM state was verified identical between scrub directions
      //     (style/rect/pressed all equal), but Chromium rasterizes the
      //     label's GLYPHS with history-dependent antialiasing (~83 px of
      //     ≤36/255 edge shimmer, invisible at 1:1) — a compositor
      //     text-raster artifact, not choreography state, and exactly the
      //     kind of DOM-layer noise this CANVAS-determinism sweep exists to
      //     see past. task-9-report.md carries the isolation evidence.
      // Stops are journey-t values inside the desk segment [0.06, 0.235],
      // chosen to cover all three annotation beats + the presence window.
      const outdir = process.argv[3];
      mkdirSync(outdir, { recursive: true });
      const page = await openPage(browser, { w, h, dpr, tier });
      const pinVideo = async () => {
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              // Tell DeskSceneDom's per-frame drive to stop resuming it…
              window.crossingDebug = Object.assign(window.crossingDebug ?? {}, {
                deskVideoPinned: true,
              });
              const v = document.querySelector('.desk-monitor-video');
              if (!v) return resolve(false);
              // …then pin the decoded frame itself.
              v.pause();
              const done = () => resolve(true);
              v.addEventListener('seeked', done, { once: true });
              v.currentTime = 5;
              setTimeout(done, 1500); // fallback: seeked may not fire twice
            }),
        );
      };
      const stops = [0.08, 0.12, 0.16, 0.18, 0.205];
      const SETTLE_MS = 800; // CSS transitions settle before capture
      const hideCursor = () =>
        page.evaluate(() => {
          const el = document.querySelector('.zak-cursor');
          if (el) el.style.display = 'none';
        });
      for (const t of stops) {
        await seekJourney(page, t);
        await pinVideo();
        await hideCursor();
        await page.waitForTimeout(SETTLE_MS);
        await page.screenshot({ path: path.join(outdir, `fwd-t${pad(t)}.png`) });
      }
      let failed = false;
      for (const t of stops) {
        await seekJourney(page, 1.0);
        await seekJourney(page, t);
        await pinVideo();
        await hideCursor();
        await page.waitForTimeout(SETTLE_MS);
        const back = path.join(outdir, `back-t${pad(t)}.png`);
        await page.screenshot({ path: back });
        const d = await diffPng(path.join(outdir, `fwd-t${pad(t)}.png`), back);
        console.log(`desk reversibility t=${t}:`, d);
        if (d.maxDiff !== 0) failed = true;
      }
      console.log(
        failed
          ? 'DESKSWEEP FAIL (maxDiff > 0 somewhere)'
          : 'DESKSWEEP PASS (maxDiff 0 at all stops)',
      );
      if (failed) process.exitCode = 1;
    } else if (cmd === 'swap') {
      // Masks-on/off identity at the matched pose (p = 0.20): all region
      // releases are 0 there, so the art-direction machinery must be
      // byte-invisible — uMasksOn 0 vs 1 renders identical frames.
      const outdir = process.argv[3] ?? '/tmp';
      mkdirSync(outdir, { recursive: true });
      const page = await openPage(browser, { w, h, dpr, tier });
      await seek(page, 0.2);
      const fOn = path.join(outdir, 'swap-masks-on.png');
      const fOff = path.join(outdir, 'swap-masks-off.png');
      await page.screenshot({ path: fOn });
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            window.crossingDebug.uniforms.uMasksOn.value = 0;
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }),
      );
      await page.screenshot({ path: fOff });
      await page.evaluate(() => { window.crossingDebug.uniforms.uMasksOn.value = 1; });
      const d = await diffPng(fOn, fOff);
      console.log('swap identity (masks on vs off @ p=0.20):', d);
      console.log(d.maxDiff === 0 ? 'SWAP PASS (byte-identical)' : 'SWAP FAIL');
      if (d.maxDiff !== 0) process.exitCode = 1;
    } else if (cmd === 'perf') {
      // Honest scrub-fps: HEADED browser (headless flatters/warps GPU numbers),
      // native DPR by default. The probe runs inside the page's own rAF loop
      // and scrubs in JOURNEY units; checkpoints are given in CROSSING p and
      // mapped through heroMap in-page. amp 0.016 journey ≈ Task 2's 0.028
      // commanded in crossing-p units (the journey->p slope inside the
      // crossing is 1/(heroSpan × (1−HOLD)) ≈ 1.76), which the damped
      // follower attenuates to the experiment's effective ±0.02 scrub.
      const perfDpr = parseFloat(arg('dpr', '2'));
      const seconds = parseFloat(arg('seconds', '6'));
      const amp = parseFloat(arg('amp', '0.016'));
      // --tj (Task 9): checkpoints are JOURNEY-t values (span all segments —
      // name/desk/hold/swap/street/arrival), fed to perfStart directly.
      // Default (no --tj): CROSSING-p values mapped via heroMap (Task 2/7
      // comparability).
      const asJourneyT = process.argv.includes('--tj');
      const checkpoints = arg('checkpoints', '0.75,0.85')
        .split(',')
        .map((s) => parseFloat(s));
      const opt = arg('opt', null);
      const headed = await chromium.launch({ headless: false });
      try {
        const page = await headed.newPage({
          viewport: { width: w, height: h },
          deviceScaleFactor: perfDpr,
        });
        await page.goto(pageUrl({ opt, tier }));
        const essential = String(tier).toUpperCase() === 'ESSENTIAL';
        await page.waitForFunction(
          (ess) =>
            window.crossingDebug &&
            (ess
              ? window.crossingDebug.essentialReady
              : window.crossingDebug.refresh) &&
            window.crossingDebug.perfStart &&
            window.crossingDebug.heroMap,
          essential,
          { timeout: 60000 },
        );
        await page.waitForTimeout(6500); // let GLBs land + the last refresh timer fire
        if (!essential) {
          await page.evaluate(() => window.crossingDebug.refresh());
        }
        await page.waitForTimeout(400);
        const out = [];
        for (const p of checkpoints) {
          // Warm the checkpoint (settle the damped timeline + first-draw
          // uploads) before sampling — scrub fps, not arrival hitches.
          if (asJourneyT) await seekJourney(page, p);
          else await seek(page, p);
          await page.waitForTimeout(1200);
          await page.evaluate(
            ({ p, seconds, amp, asJourneyT }) =>
              window.crossingDebug.perfStart(
                asJourneyT ? p : window.crossingDebug.heroMap.tForP(p),
                seconds,
                amp,
              ),
            { p, seconds, amp, asJourneyT },
          );
          let result = null;
          const deadline = Date.now() + (seconds + 10) * 1000;
          while (!result && Date.now() < deadline) {
            await page.waitForTimeout(500);
            result = await page.evaluate(() => window.crossingDebug.perfResult());
          }
          out.push(result ? { crossingP: p, ...result } : { p, error: 'probe timed out' });
          console.log(JSON.stringify(result));
        }
        console.log('PERF_SUMMARY ' + JSON.stringify(out));
      } finally {
        await headed.close();
      }
    } else if (cmd === 'coldfling') {
      // The inherited REQUIRED TEST (Task 2 review -> Task 7): cold load ->
      // immediately fling-scroll to the hero. The honest possible outcomes:
      // the held-photo backstop while assets stream, then the crossing; what
      // must NOT happen is a multi-hundred-ms shader-compile frame ON the
      // first scrub AFTER the load beat (the early-mount refresh() must have
      // already compiled everything). Records every rAF delta for 14s with
      // phase marks and prints the big frames with their phase context.
      const headed = await chromium.launch({ headless: false });
      try {
        const page = await headed.newPage({
          viewport: { width: w, height: h },
          deviceScaleFactor: parseFloat(arg('dpr', '2')),
        });
        // 'commit' — start measuring before the app has even mounted;
        // a visitor's finger doesn't wait for onload. With --warm, instead
        // wait out the whole load beat at t=0 first (the realistic case:
        // any visitor who actually reads the name/desk), THEN fling — this
        // is the inherited test's core assertion: no compile hitch on a
        // scrub straight to the hero once the early-mount precompile has
        // had its beat.
        const warm = process.argv.includes('--warm');
        await page.goto(BASE_URL, { waitUntil: warm ? 'load' : 'commit' });
        if (warm) {
          await page.waitForFunction(
            () => window.crossingDebug?.refresh && window.crossingDebug?.heroMap,
            null,
            { timeout: 60000 },
          );
          await page.waitForTimeout(8000); // past the last refresh timer
        }
        const report = await page.evaluate(
          ({ seconds }) =>
            new Promise((resolve) => {
              const t0 = performance.now();
              const frames = []; // {at, dur}
              const marks = {};
              let last = 0;
              let flung = false;
              const tick = (now) => {
                if (last > 0) frames.push([now - t0, now - last]);
                last = now;
                const max =
                  document.documentElement.scrollHeight - window.innerHeight;
                // Fling the instant the journey exists (scroll host mounted).
                if (!flung && max > 2000) {
                  flung = true;
                  marks.flungAtMs = now - t0;
                  // ≈ crossingPToJourneyT(0.85) — the street reveal. The
                  // mapping isn't published this early; a stale value here
                  // only shifts WHERE we land, not what we measure.
                  window.scrollTo(0, 0.576 * max);
                }
                const dbg = window.crossingDebug;
                if (marks.sceneLiveMs === undefined && dbg?.getState) {
                  marks.sceneLiveMs = now - t0; // crossing Canvas mounted
                }
                if (
                  marks.settledMs === undefined &&
                  dbg?.journeyT &&
                  dbg?.journeyTarget &&
                  flung &&
                  dbg.journeyTarget() > 0.5 && // the fling actually registered
                  Math.abs(dbg.journeyT() - dbg.journeyTarget()) < 1e-9
                ) {
                  marks.settledMs = now - t0; // damped transit complete
                }
                if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
                else resolve({ frames, marks });
              };
              requestAnimationFrame(tick);
            }),
          { seconds: 14 },
        );
        const { frames, marks } = report;
        const settled = marks.settledMs ?? 0;
        const post = frames.filter(([at]) => at > (marks.sceneLiveMs ?? 0));
        // The damped transit from the fling to rest IS the first scrub —
        // the whole crossing plays forward at speed across it.
        const transit = frames.filter(
          ([at]) => at >= (marks.flungAtMs ?? 0) && at <= settled,
        );
        const postSettle = frames.filter(([at]) => at > settled + 250);
        const big = frames.filter(([, d]) => d > 33);
        const stat = (list) => {
          const durs = list.map(([, d]) => d).sort((a, b) => a - b);
          return {
            frames: durs.length,
            p50: durs[Math.floor(durs.length * 0.5)]?.toFixed(1),
            p95: durs[Math.floor(durs.length * 0.95)]?.toFixed(1),
            worst: durs[durs.length - 1]?.toFixed(1),
          };
        };
        console.log('marks(ms):', JSON.stringify(marks));
        console.log(
          'frames >33ms (atMs, durMs):',
          JSON.stringify(big.map(([a, d]) => [Math.round(a), Math.round(d)])),
        );
        console.log('all-after-scene-live:', JSON.stringify(stat(post)));
        console.log('fling-transit (the first scrub):', JSON.stringify(stat(transit)));
        console.log('after-settle+250ms  :', JSON.stringify(stat(postSettle)));
        const worstPostSettle = Math.max(
          0,
          ...postSettle.map(([, d]) => d),
        );
        console.log(
          worstPostSettle < 50
            ? `COLDFLING PASS (worst post-settle frame ${worstPostSettle.toFixed(1)}ms)`
            : `COLDFLING ATTENTION (worst post-settle frame ${worstPostSettle.toFixed(1)}ms — inspect the phase context above)`,
        );
      } finally {
        await headed.close();
      }
    } else {
      console.error('unknown command (shot | sweep | tsweep | desksweep | swap | perf | coldfling)');
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
