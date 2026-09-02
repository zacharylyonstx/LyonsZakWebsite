// The film-critic pass's instrument: scrub the WHOLE film twice —
//   slow: settle at every 0.025 of journey t, capture a small frame
//   fast: one continuous 9s glide top to bottom, capture every ~450ms
// The frames land in the given outdir for a human(-agent) review of pacing,
// seams, and the ending against the opening. Not a byte tool — qa.mjs
// tsweep owns determinism.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.goto('http://localhost:5180/');
await page.waitForTimeout(7000);

// SLOW pass — settle at each stop.
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  await page.evaluate((tt) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, tt * max);
  }, t);
  await page.waitForTimeout(1400);
  await page.screenshot({
    path: path.join(OUT, `slow-${String(i).padStart(2, '0')}-t${Math.round(t * 1000)}.jpg`),
    quality: 70,
    type: 'jpeg',
  });
}

// FAST pass — one continuous glide, frames on the fly.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(2500);
const glideMs = 9000;
const start = Date.now();
const glide = page.evaluate(
  (ms) =>
    new Promise((resolve) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        window.scrollTo(0, p * max);
        if (p < 1) requestAnimationFrame(tick);
        else resolve(null);
      };
      requestAnimationFrame(tick);
    }),
  glideMs,
);
let n = 0;
while (Date.now() - start < glideMs + 1200) {
  await page.screenshot({
    path: path.join(OUT, `fast-${String(n).padStart(2, '0')}.jpg`),
    quality: 65,
    type: 'jpeg',
  });
  n++;
  await page.waitForTimeout(200);
}
await glide;
console.log(`filmstrip: 41 slow + ${n} fast frames -> ${OUT}`);
await browser.close();
