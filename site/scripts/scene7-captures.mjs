// Scene 7 verification captures qa.mjs can't take:
//   --rm       reduced-motion beats (emulateMedia) desktop + portrait
//   --nowebgl  no-WebGL beats (getContext stubbed) desktop
//   --rest     CLEAN end-state rest frames (no ?debug=1) both orientations,
//              plus the fling-to-bottom + over-scroll composure test
// Under reduced motion / no WebGL the crossing never mounts, so
// crossingDebug.refresh never appears — settle on journeyT alone (App
// publishes it in dev regardless of edition).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const MODE = process.argv[3] ?? '--rm';

const BEATS = [
  ['sign', 0.878],
  ['keeping', 0.9225],
  ['thennow', 0.9566],
  ['endcard', 1.0],
];

async function waitReady(page) {
  await page.waitForFunction(() => window.crossingDebug && window.crossingDebug.journeyT, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(4000); // let textures/fonts land
}

async function seekT(page, t) {
  await page.evaluate(
    (tt) =>
      new Promise((resolve, reject) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, tt * max);
        const deadline = performance.now() + 60000;
        const tick = () => {
          const expected = Math.min(1, Math.max(0, window.scrollY / max));
          if (Math.abs(window.crossingDebug.journeyT() - expected) < 1e-9) {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
            return;
          }
          if (performance.now() > deadline) return reject(new Error('no settle'));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    t,
  );
  await page.waitForTimeout(150);
}

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});

try {
  if (MODE === '--rm') {
    for (const [label, vp] of [
      ['desktop', { width: 1600, height: 1000 }],
      ['portrait', { width: 390, height: 844 }],
    ]) {
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: label === 'portrait' ? 2 : 1 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('http://localhost:5180/?debug=1');
      await waitReady(page);
      for (const [name, t] of BEATS) {
        await seekT(page, t);
        await page.screenshot({ path: path.join(OUT, `rm-${label}-${name}.png`) });
        console.log(`rm-${label}-${name}`);
      }
      // The plaque must be a STILL under reduced motion — no playing video.
      const videoState = await page.evaluate(() =>
        Array.from(document.querySelectorAll('video')).map((v) => ({
          src: v.currentSrc.split('/').pop(),
          paused: v.paused,
        })),
      );
      console.log(`rm-${label} video elements:`, JSON.stringify(videoState));
      await page.close();
    }
  } else if (MODE === '--nowebgl') {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return orig.call(this, type, ...rest);
      };
    });
    await page.goto('http://localhost:5180/?debug=1');
    await waitReady(page);
    for (const [name, t] of BEATS) {
      await seekT(page, t);
      await page.screenshot({ path: path.join(OUT, `nowebgl-${name}.png`) });
      console.log(`nowebgl-${name}`);
    }
    // Alt-text audit: the four keeper fallback images must carry real alt.
    const alts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.keeper-fallback img')).map((i) => i.alt.slice(0, 40)),
    );
    console.log('keeper-fallback alts:', JSON.stringify(alts));
    await page.close();
  } else if (MODE === '--rest') {
    for (const [label, vp, dpr] of [
      ['desktop', { width: 1600, height: 1000 }, 1],
      ['portrait', { width: 390, height: 844 }, 2],
    ]) {
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: dpr });
      await page.goto('http://localhost:5180/'); // CLEAN — no debug readout
      await page.waitForTimeout(6000);
      // The fling: from the top, straight to the bottom in one gesture.
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      await page.waitForTimeout(4000); // damped transit + settle
      const atEnd = await page.evaluate(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        return { scrollY: window.scrollY, max, atBottom: Math.abs(window.scrollY - max) < 2 };
      });
      console.log(`${label} fling:`, JSON.stringify(atEnd));
      await page.screenshot({ path: path.join(OUT, `rest-${label}.png`) });
      // Over-scroll at t=1: extra wheel-down must leave the frame composed.
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `rest-${label}-overscroll.png`) });
      console.log(`rest-${label} written`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
