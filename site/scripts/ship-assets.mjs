// Ship-pass metadata assets: favicon PNG fallbacks (rasterized from
// public/favicon.svg, the amber-rule-on-dusk mark) + the OG/Twitter share
// image (a text-free 1200x630 crop of Scene 1's opening frame — the graded
// drummer portrait already staged for the film, public/assets/drummer/
// portrait.jpg — no re-grading, this IS the frame the visitor lands on).
// Run once (`node scripts/ship-assets.mjs`); outputs are committed, not
// generated at build time — same discipline as scripts/prepare-assets.mjs.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');

async function favicons() {
  const svgPath = path.join(PUBLIC, 'favicon.svg');
  const sizes = [
    { file: 'favicon-16.png', size: 16 },
    { file: 'favicon-32.png', size: 32 },
    { file: 'favicon-48.png', size: 48 },
    { file: 'apple-touch-icon.png', size: 180 },
  ];
  for (const { file, size } of sizes) {
    await sharp(svgPath, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(path.join(PUBLIC, file));
    console.log(`wrote ${file} (${size}x${size})`);
  }
}

async function ogImage() {
  const src = path.join(PUBLIC, 'assets', 'drummer', 'portrait.jpg');
  const out = path.join(PUBLIC, 'og-image.jpg');
  // 1484x1024 (1.449:1) -> 1200x630 (1.905:1): crop to the wider aspect
  // first (centered — keeps his grin near the top third and the kit's
  // upper edge, loses only a thin strip top+bottom), then resize down.
  // No text, no overlay — the frame itself carries the card (ship-pass
  // brief: "text-free or minimal").
  const meta = await sharp(src).metadata();
  const targetAspect = 1200 / 630;
  const cropHeight = Math.round(meta.width / targetAspect);
  const top = Math.round((meta.height - cropHeight) / 2);
  await sharp(src)
    .extract({ left: 0, top: Math.max(top, 0), width: meta.width, height: Math.min(cropHeight, meta.height) })
    .resize(1200, 630)
    .jpeg({ quality: 86 })
    .toFile(out);
  console.log(`wrote og-image.jpg (1200x630, from ${meta.width}x${meta.height}, crop top=${top})`);
}

await favicons();
await ogImage();
