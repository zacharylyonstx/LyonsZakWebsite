#!/usr/bin/env node
// The HOUSE GRADE — one consistent filmic treatment for every photographic
// frame in the film (docs/v2-direction.md: "lifted blacks toward dusk-blue,
// warm highlights, gentle grain" — grain lives in CSS, the rest lives here).
//
// Established on Scene 1's Texas-flag drum portrait (2026-08-29), tuned by
// screenshotting the graded frame IN-SCENE against the shell's dusk gradient
// until the photo's own stage light felt continuous with the horizon bloom.
// Reuse this script verbatim for every scene's frames so phone candids and
// pro shots sit in one world; only revisit the numbers if a frame genuinely
// breaks (and then re-verify Scene 1 still sits).
//
// THE RECIPE (stage order is real — sharp fuses chained ops, so each stage
// is its own pass):
//   1. EXIF-rotate, saturation shape (whole-frame sat pulled slightly, so
//      stage-magenta / flash-red candids stop shouting).
//   2. Lifted blacks toward dusk-blue: SCREEN-blend a deep dusk indigo.
//      screen(src, c*a) = src + a*c*(1-src) — pure shadow lift that decays
//      to nothing in highlights; blacks land near the site's --dusk-deep
//      instead of #000, with the lift reading blue, not gray.
//   3. Warmed highlights: SOFT-LIGHT a low-alpha amber — warms mids/highs
//      toward the sparkler/candle accent, nudges blue down where it lands.
//   4. Contrast re-anchor: tiny linear stretch so the lift doesn't read
//      as haze; keeps the photo confident.
//
// Usage:
//   node scripts/grade.mjs <input.jpg> [more inputs...] [--suffix -graded]
// Output lands ALONGSIDE each input: 01-foo.jpg -> 01-foo-graded.jpg
// (q95 — prepare-assets re-encodes to the delivery q90, never double-lossy
// below that).
import sharp from 'sharp';
import path from 'node:path';

// ---- The house recipe (tuned on 01-texasflag-drums.jpg, 2026-08-29) -------
export const RECIPE = {
  /** Whole-frame saturation shape (1 = untouched). */
  saturation: 0.9,
  /** Shadow lift color — a deep dusk indigo, bluer than --dusk so the lift
   *  reads as blue hour, not gray fog. */
  liftColor: { r: 0x1e, g: 0x2a, b: 0x49 },
  /** Shadow lift strength (screen-blend alpha). 0.42 puts pure black at
   *  ≈ #0d1220 — right on the site's --dusk-deep. */
  liftAlpha: 0.42,
  /** Highlight warmth color — the --amber accent. */
  warmColor: { r: 0xf5, g: 0xa4, b: 0x5c },
  /** Highlight warmth strength (soft-light alpha). */
  warmAlpha: 0.16,
  /** Contrast re-anchor: out = in * slope + offset (8-bit space). */
  contrastSlope: 1.035,
  contrastOffset: -5,
};

function solid(width, height, { r, g, b }, alpha) {
  return {
    create: {
      width,
      height,
      channels: 4,
      background: { r, g, b, alpha },
    },
  };
}

export async function gradeBuffer(input, recipe = RECIPE) {
  // Stage 1 — orientation + saturation shape.
  const base = sharp(input).rotate().modulate({ saturation: recipe.saturation });
  const { data: s1, info } = await base
    .jpeg({ quality: 100 })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Stage 2 — lifted blacks toward dusk-blue (screen).
  const s2 = await sharp(s1)
    .composite([
      { input: solid(width, height, recipe.liftColor, recipe.liftAlpha), blend: 'screen' },
    ])
    .jpeg({ quality: 100 })
    .toBuffer();

  // Stage 3 — warmed highlights (soft-light amber).
  const s3 = await sharp(s2)
    .composite([
      { input: solid(width, height, recipe.warmColor, recipe.warmAlpha), blend: 'soft-light' },
    ])
    .jpeg({ quality: 100 })
    .toBuffer();

  // Stage 4 — contrast re-anchor.
  return sharp(s3).linear(recipe.contrastSlope, recipe.contrastOffset);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const si = process.argv.indexOf('--suffix');
  const suffix = si >= 0 ? process.argv[si + 1] : '-graded';
  if (args.length === 0) {
    console.error('usage: node scripts/grade.mjs <input.jpg> [...] [--suffix -graded]');
    process.exit(1);
  }
  for (const input of args) {
    const ext = path.extname(input);
    const out = path.join(
      path.dirname(input),
      `${path.basename(input, ext)}${suffix}${ext}`,
    );
    const graded = await gradeBuffer(input);
    await graded.jpeg({ quality: 95, mozjpeg: true }).toFile(out);
    console.log(`graded ${input} -> ${out}`);
  }
}

// Run as a CLI only; importable (gradeBuffer/RECIPE) for A/B tooling.
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
