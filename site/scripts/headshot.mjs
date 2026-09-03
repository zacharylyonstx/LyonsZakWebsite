#!/usr/bin/env node
// The professional headshot — the one Zak uses everywhere a suit is expected
// (gray suit, plum tie, glass atrium; the big smile). Source of truth is the
// private staging copy .recon/final/zak-headshot-suit.jpg (byte-identical to
// the original he keeps; never edited in place). This script cuts every
// derivative the site consumes and writes the vCard that carries it:
//
//   public/zak-headshot.jpg / .webp   3:4 portrait, 900x1200 — the contact
//                                     card (film overlay + /contact page)
//   public/zak-headshot-sq.jpg        1:1, 640 — Person schema image, the
//                                     medallion, the share card
//   public/zak-headshot-avatar.webp   1:1, 160 — the fast-lane avatar
//   public/downloads/zak-lyons.vcf    vCard 3.0 with the photo embedded, so
//                                     "Save contact" lands his face in a
//                                     phone's address book in one tap
//
// Idempotent; run `node scripts/headshot.mjs`. Outputs are committed (the
// ship-assets.mjs discipline) — public/ is the deployable, .recon/ is not.
import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(ROOT);
const SRC = path.join(REPO, '.recon/final/zak-headshot-suit.jpg');
const PUBLIC = path.join(ROOT, 'public');
const DOWNLOADS = path.join(PUBLIC, 'downloads');

if (!existsSync(SRC)) {
  console.error(`missing source: ${SRC}`);
  process.exit(1);
}
mkdirSync(DOWNLOADS, { recursive: true });

const meta = await sharp(SRC).rotate().metadata();
const W = meta.width; // 1335
const H = meta.height; // 2000
if (W !== 1335 || H !== 2000) {
  console.warn(`unexpected source size ${W}x${H} — crops below assume 1335x2000`);
}

// Crops measured on the 1335x2000 frame: hairline ~y370, eyes ~y720, chin
// ~y1000, face centre ~(640, 800). The atrium's bright glass fills the top
// third, so every cut drops headroom rather than the tie.
const PORTRAIT = { left: 0, top: 130, width: 1335, height: 1780 }; // 3:4
const SQUARE = { left: 90, top: 250, width: 1100, height: 1100 }; // 1:1

const base = () => sharp(SRC).rotate();

await base()
  .extract(PORTRAIT)
  .resize(900, 1200, { kernel: 'lanczos3' })
  .jpeg({ quality: 84, mozjpeg: true, progressive: true })
  .toFile(path.join(PUBLIC, 'zak-headshot.jpg'));

await base()
  .extract(PORTRAIT)
  .resize(900, 1200, { kernel: 'lanczos3' })
  .webp({ quality: 82 })
  .toFile(path.join(PUBLIC, 'zak-headshot.webp'));

await base()
  .extract(SQUARE)
  .resize(640, 640, { kernel: 'lanczos3' })
  .jpeg({ quality: 84, mozjpeg: true, progressive: true })
  .toFile(path.join(PUBLIC, 'zak-headshot-sq.jpg'));

await base()
  .extract(SQUARE)
  .resize(160, 160, { kernel: 'lanczos3' })
  .webp({ quality: 84 })
  .toFile(path.join(PUBLIC, 'zak-headshot-avatar.webp'));

// ---- The vCard ------------------------------------------------------------
// vCard 3.0 (the dialect every phone imports without fuss). The photo is a
// 300px square JPEG inlined base64 — big enough for a contact thumbnail,
// small enough (~20KB) that the .vcf stays a light tap on cellular. Lines
// are folded at 75 octets per RFC 2426 §2.6; CRLF line ends throughout.
const photo = await base()
  .extract(SQUARE)
  .resize(300, 300, { kernel: 'lanczos3' })
  .jpeg({ quality: 78, mozjpeg: true })
  .toBuffer();

function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  out.push(rest);
  return out.join('\r\n');
}

const rev = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const lines = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:Lyons;Zachary;Alan;;',
  'FN:Zak Lyons',
  'NICKNAME:Zak',
  'TITLE:Senior Software Engineer',
  'TEL;TYPE=CELL,VOICE,PREF:+15124972838',
  'EMAIL;TYPE=INTERNET,PREF:zacharylyonstx@gmail.com',
  'ADR;TYPE=HOME:;;;Georgetown;TX;;United States',
  'URL:https://lyonszak.com/',
  'item1.URL:https://github.com/zacharylyonstx',
  'item1.X-ABLabel:GitHub',
  'item2.URL:https://www.linkedin.com/in/zacharylyonstx',
  'item2.X-ABLabel:LinkedIn',
  'X-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/zacharylyonstx',
  'X-SOCIALPROFILE;TYPE=github:https://github.com/zacharylyonstx',
  'NOTE:Senior full-stack software engineer (Django/Python\\, React/TypeScript)\\, Georgetown\\, Texas. lyonszak.com',
  `PHOTO;ENCODING=b;TYPE=JPEG:${photo.toString('base64')}`,
  `REV:${rev}`,
  'END:VCARD',
];
const vcf = lines.map(fold).join('\r\n') + '\r\n';
writeFileSync(path.join(DOWNLOADS, 'zak-lyons.vcf'), vcf, 'utf8');

for (const f of [
  'zak-headshot.jpg',
  'zak-headshot.webp',
  'zak-headshot-sq.jpg',
  'zak-headshot-avatar.webp',
  'downloads/zak-lyons.vcf',
]) {
  const p = path.join(PUBLIC, f);
  const m = f.endsWith('.vcf') ? null : await sharp(p).metadata();
  const kb = (await import('node:fs')).statSync(p).size / 1024;
  console.log(`${f.padEnd(28)} ${m ? `${m.width}x${m.height}` : 'vcard'}  ${kb.toFixed(0)}KB`);
}
