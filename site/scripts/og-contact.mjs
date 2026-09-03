#!/usr/bin/env node
// The contact page's share image (Open Graph / Twitter card): the contact
// card as a card — the professional headshot full-bleed on the left, the
// name in the film's display face, the role, and the two ways to reach
// Zak, on the site's dusk. Sent as a text or dropped in a recruiter's
// inbox, the link previews as exactly what /contact is. Rendered by
// headless Chromium from an inline composition (real self-hosted fonts),
// captured at 2x, downsampled to 1200x630. Output is committed
// (public/og-contact.jpg) — run once: `node scripts/og-contact.mjs`.
import sharp from 'sharp';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const b64 = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;

const html = ({ photo, grain, fonts }) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Bricolage Grotesque';src:url(${fonts.display}) format('woff2');font-weight:200 800;font-stretch:75% 100%;}
@font-face{font-family:'Newsreader';font-style:italic;src:url(${fonts.voiceItalic}) format('woff2');font-weight:200 800;}
@font-face{font-family:'Newsreader';font-style:normal;src:url(${fonts.voice}) format('woff2');font-weight:200 800;}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#171e2e;}
.card{position:relative;width:1200px;height:630px;overflow:hidden;
  background:linear-gradient(180deg,#1b2338 0%,#171e2e 55%,#12172a 100%);}
.photo{position:absolute;top:0;left:0;width:472px;height:630px;
  background:url(${photo}) 50% 28%/cover no-repeat;
  -webkit-mask-image:linear-gradient(90deg,#000 0%,#000 84%,rgba(0,0,0,0) 100%);
  mask-image:linear-gradient(90deg,#000 0%,#000 84%,rgba(0,0,0,0) 100%);}
.body{position:absolute;left:520px;top:0;right:0;height:630px;}
.eyebrow{position:absolute;left:0;top:86px;margin:0;font:500 15px/1 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.24em;text-transform:uppercase;color:#97a0b5;}
.name{position:absolute;left:-4px;top:122px;margin:0;font-family:'Bricolage Grotesque';font-weight:748;font-stretch:80%;
  font-variation-settings:'opsz' 96;font-size:150px;line-height:.86;letter-spacing:-.008em;text-transform:uppercase;color:#f0e9dc;}
.name span{display:block}
.role{position:absolute;left:0;top:396px;margin:0;font-family:'Newsreader';font-style:italic;font-weight:420;font-size:31px;color:#f0e9dc;}
.rule{position:absolute;left:0;top:452px;width:150px;height:2px;border-radius:2px;background:linear-gradient(90deg,#f5a45c,rgba(245,164,92,0));box-shadow:0 0 18px rgba(245,164,92,.55);}
.facts{position:absolute;left:0;top:480px;margin:0;padding:0;list-style:none;font:500 22px/1.7 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.06em;color:#f0e9dc;}
.facts b{font-weight:500;color:#f5a45c}
.site{position:absolute;right:56px;bottom:36px;font:500 13px/1 ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#97a0b5;}
.site b{color:#f5a45c;font-weight:500}
.grain{position:absolute;inset:0;background:url(${grain}) repeat;opacity:.16;mix-blend-mode:overlay;}
</style></head><body><div class="card">
<div class="photo"></div>
<div class="body">
<p class="eyebrow">Contact card</p>
<h1 class="name"><span>Zak</span><span>Lyons</span></h1>
<p class="role">Senior software engineer. Georgetown, Texas.</p>
<div class="rule"></div>
<ul class="facts"><li>(512) 497-2838</li><li>zacharylyonstx@gmail.com</li></ul>
</div>
<p class="site"><b>lyonszak.com</b>/contact</p>
<div class="grain"></div>
</div></body></html>`;

const tmp = path.join(os.tmpdir(), 'lyonszak-og-contact');
mkdirSync(tmp, { recursive: true });
const page_html = html({
  photo: b64(path.join(PUBLIC, 'zak-headshot.jpg'), 'image/jpeg'),
  grain: b64(path.join(ROOT, 'src/assets/grain.png'), 'image/png'),
  fonts: {
    display: b64(path.join(PUBLIC, 'fonts/bricolage-grotesque-latin-wdth-var.woff2'), 'font/woff2'),
    voiceItalic: b64(path.join(PUBLIC, 'fonts/newsreader-italic-latin-var.woff2'), 'font/woff2'),
    voice: b64(path.join(PUBLIC, 'fonts/newsreader-latin-var.woff2'), 'font/woff2'),
  },
});
const htmlPath = path.join(tmp, 'og-contact.html');
writeFileSync(htmlPath, page_html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto('file://' + htmlPath);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const png = await page.screenshot({ type: 'png' });
await browser.close();
await sharp(png)
  .resize(1200, 630, { kernel: 'lanczos3' })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(PUBLIC, 'og-contact.jpg'));
console.log('wrote public/og-contact.jpg (1200x630)');
