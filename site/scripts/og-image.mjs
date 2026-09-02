#!/usr/bin/env node
// The share image (Open Graph / Twitter card): the site's own opening frame,
// built the way the site builds it — ZAK LYONS set BEHIND Zak and the kit
// through the same depth cutout THE DRUMMER uses (drummerRig's FG_LO/FG_HI
// on the staged depth map), over the dusk-graded Texas-flag portrait, with
// the identity line and the site's amber rule. Rendered by headless Chromium
// from an inline HTML composition (the real self-hosted fonts), captured at
// 2x, downsampled to 1200x630. Run once (`node scripts/og-image.mjs`); the
// output is committed (the ship-assets.mjs discipline).
import sharp from 'sharp';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const FG_LO = 0.4; // drummerRig.ts — keep in step
const FG_HI = 0.47;

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

async function foregroundCutout(tmp) {
  const photo = sharp(path.join(PUBLIC, 'assets/drummer/portrait.jpg'));
  const { width, height } = await photo.metadata();
  const depth = await sharp(path.join(PUBLIC, 'assets/drummer/depth.png'))
    .resize(width, height)
    .greyscale()
    .raw()
    .toBuffer();
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = Math.round(255 * smooth((depth[i] / 255 - FG_LO) / (FG_HI - FG_LO)));
  }
  const rgb = await photo.clone().removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < alpha.length; i++, j += 3) {
    rgba[i * 4] = rgb[j];
    rgba[i * 4 + 1] = rgb[j + 1];
    rgba[i * 4 + 2] = rgb[j + 2];
    rgba[i * 4 + 3] = alpha[i];
  }
  const out = path.join(tmp, 'fg.png');
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(out);
  return out;
}

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;

function html({ portrait, fg, grain, fonts }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Bricolage Grotesque';src:url(${fonts.display}) format('woff2');font-weight:200 800;font-stretch:75% 100%;}
@font-face{font-family:'Newsreader';font-style:italic;src:url(${fonts.voiceItalic}) format('woff2');font-weight:200 800;}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#171e2e;}
.card{position:relative;width:1200px;height:630px;overflow:hidden;
  background:linear-gradient(180deg,#1b2338 0%,#171e2e 55%,#12172a 100%);}
/* the photograph: cover by height, anchored right, its left edge melting
   into the dusk (THE DRUMMER's own feather) */
.photo,.fg{position:absolute;top:0;right:-10px;height:630px;width:840px;}
.photo{background:url(${portrait}) center/cover no-repeat;
  -webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 14%,#000 34%,#000 100%);
  mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 14%,#000 34%,#000 100%);}
.fg{background:url(${fg}) center/cover no-repeat;
  -webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 14%,#000 34%,#000 100%);
  mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 14%,#000 34%,#000 100%);}
/* dusk falls over the flag's top and the far left so type always reads */
.veil{position:absolute;inset:0;background:
  linear-gradient(90deg,rgba(23,30,46,.95) 0%,rgba(23,30,46,.7) 26%,rgba(23,30,46,0) 50%),
  linear-gradient(180deg,rgba(23,30,46,.35) 0%,rgba(23,30,46,0) 30%,rgba(23,30,46,0) 70%,rgba(23,30,46,.55) 100%);}
.name{position:absolute;left:58px;top:78px;margin:0;font-family:'Bricolage Grotesque';font-weight:748;font-stretch:80%;
  font-variation-settings:'opsz' 96;font-size:212px;line-height:.86;letter-spacing:-.008em;text-transform:uppercase;color:#f0e9dc;}
.name span{display:block}.name .l2{margin-left:1.5em}
.tag{position:absolute;left:64px;top:452px;}
.rule{width:150px;height:2px;border-radius:2px;background:linear-gradient(90deg,#f5a45c,rgba(245,164,92,0));box-shadow:0 0 18px rgba(245,164,92,.55);}
.voice{margin:16px 0 0;font-family:'Newsreader';font-style:italic;font-weight:420;font-size:31px;letter-spacing:.005em;color:#f0e9dc;text-shadow:0 2px 18px rgba(23,30,46,.9);}
.eyebrow{position:absolute;left:66px;bottom:36px;text-shadow:0 1px 10px rgba(23,30,46,.95);font:500 13px/1 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#97a0b5;}
.eyebrow b{color:#f5a45c;font-weight:500}
.grain{position:absolute;inset:0;background:url(${grain}) repeat;opacity:.16;mix-blend-mode:overlay;}
</style></head><body><div class="card">
<div class="photo"></div>
<div class="veil"></div>
<h1 class="name"><span>Zak</span><span class="l2">Lyons</span></h1>
<div class="fg"></div>
<div class="tag"><div class="rule"></div><p class="voice">Senior software engineer. Texas.</p></div>
<p class="eyebrow"><b>lyonszak.com</b> &nbsp;·&nbsp; an interactive self-portrait</p>
<div class="grain"></div>
</div></body></html>`;
}

const tmp = path.join(os.tmpdir(), 'lyonszak-og'); mkdirSync(tmp, { recursive: true });
const fg = await foregroundCutout(tmp);
const page_html = html({
  portrait: b64(path.join(PUBLIC, 'assets/drummer/portrait.jpg'), 'image/jpeg'),
  fg: b64(fg, 'image/png'),
  grain: b64(path.join(ROOT, 'src/assets/grain.png'), 'image/png'),
  fonts: {
    display: b64(path.join(PUBLIC, 'fonts/bricolage-grotesque-latin-wdth-var.woff2'), 'font/woff2'),
    voiceItalic: b64(path.join(PUBLIC, 'fonts/newsreader-italic-latin-var.woff2'), 'font/woff2'),
  },
});
const htmlPath = path.join(tmp, 'og.html'); writeFileSync(htmlPath, page_html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto('file://' + htmlPath);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const png = await page.screenshot({ type: 'png' });
await browser.close();
await sharp(png).resize(1200, 630, { kernel: 'lanczos3' }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(PUBLIC, 'og-image.jpg'));
console.log('wrote public/og-image.jpg (1200x630)');
