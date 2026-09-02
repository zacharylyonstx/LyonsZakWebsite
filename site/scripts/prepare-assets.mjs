#!/usr/bin/env node
// Stages the v2 site's local (gitignored) scene assets into site/public/.
//
// Adapted from the v1 slice's prepare step (archive/2026-08-29-slice-attempt-1
// site/scripts/prepare-assets.mjs) — same sharp/ffmpeg treatments, NEW source
// of truth: /Users/zak/LyonsZakWebsite/.recon/final/ — the finalization
// agent's graded, approved frame set for the seven scenes of
// docs/v2-direction.md. Raw picks live in .recon/picks/ and are NOT staged
// from here (no raw-ugly frames "because real" — the no-list).
//
// THE STAGING MAP below is the contract: one entry per asset the site
// consumes, keyed to its v2 scene. As the finalization agent lands files in
// .recon/final/, entries flip from TODO to staged on the next run — no code
// change needed when the expected filename matches. A finalized file with a
// DIFFERENT name shows up in the "unmapped" report; extend the map for it.
//
// LOUD-FAILURE LAW (v2 direction): a missing required asset FAILS this
// script with a full per-scene TODO report — never a silent skip. The only
// soft entries are ones explicitly marked `optional` (none yet).
//
// Idempotent: existing outputs newer than their sources are kept; pass
// --force to rebuild everything. Nothing here is ever committed except
// public/downloads/ and public/fonts/ (site/.gitignore governs).
import sharp from 'sharp';
import DRUMMER_FEATHER from '../src/scenes/drummer/feather.json' with { type: 'json' };
import DAD_FEATHER from '../src/scenes/dad/feather.json' with { type: 'json' };
import NBHD_FEATHER from '../src/scenes/neighborhood/feather.json' with { type: 'json' };
import BAND_FEATHER from '../src/scenes/band/feather.json' with { type: 'json' };
import WEIRD_FEATHER from '../src/scenes/weird/feather.json' with { type: 'json' };
import TEASPANKS_FEATHER from '../src/scenes/teaspanks/feather.json' with { type: 'json' };
import KEEPER_FEATHER from '../src/scenes/keeper/feather.json' with { type: 'json' };
import BUILDER_CHAT from '../src/scenes/builder/chat-messages.json' with { type: 'json' };
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteRoot, '..');

/** The finalization agent's output — the ONLY photographic/video source. */
const FINAL_DIR = path.join(repoRoot, '.recon/final');

const OUT_DIR = path.join(siteRoot, 'public');
const OUT_MODELS = path.join(OUT_DIR, 'assets/models');
const GAME_MODELS = path.join(os.homedir(), 'Game/public/assets/models');

const TARGET_WIDTH = 2048; // the proven working-texture grid (v1 crossing)
const FORCE = process.argv.includes('--force');
// --scene <name>: stage (and loudly require) only that scene's entries —
// the per-scene build loop's clean exit. No flag = the whole map, loud law
// intact for everything still missing.
const SCENE_ARG = (() => {
  const i = process.argv.indexOf('--scene');
  return i >= 0 ? process.argv[i + 1] : null;
})();

/**
 * The staging map — one entry per asset, keyed to docs/v2-direction.md's
 * scene names. `src` is relative to .recon/final/. Kinds:
 *   photo  sharp: EXIF-rotate, resize to 2048w, mozjpeg q90 (the one filmic
 *          working treatment — the GRADE itself lives in the finalized file)
 *   depth  sharp: resize to 2048w lanczos3, png (16-bit preserved)
 *   video  ffmpeg: strip metadata (GPS etc.), h264/aac, +faststart
 *   audio  ffmpeg: strip metadata, aac
 *   copy   byte-for-byte copy (pre-encoded/packed files)
 *
 * NOTE 2026-08-29 (scaffold): .recon/final/ is being filled by the
 * finalization agent right now — every entry below is the expected filename
 * for its scene beat, derived from the direction doc. None were present at
 * scaffold time, so all carry `todo` notes; the script fails loudly until
 * the required ones land.
 */
const STAGING_MAP = [
  // ---- 1 THE DRUMMER ------------------------------------------------------
  // Graded via `node scripts/grade.mjs ../.recon/final/01-texasflag-drums.jpg`
  // (the house recipe — see grade.mjs). Scene 1 consumes photo + depth in
  // WebGL (makeDepthMesh + depth-masked type occlusion); the feathered WebP
  // is the no-WebGL fallback composition (alpha feather baked to MATCH the
  // scene shader's uFeather — DRUMMER_FEATHER is imported directly from
  // src/scenes/drummer/feather.json, the single source both this script and
  // drummerRig.ts read, so the two can never drift apart).
  { scene: 'drummer', kind: 'photo', src: '01-texasflag-drums-graded.jpg', out: 'assets/drummer/portrait.jpg' },
  { scene: 'drummer', kind: 'depth', src: 'depth/01-texasflag-drums.depth.png', out: 'assets/drummer/depth.png' },
  { scene: 'drummer', kind: 'feathered', src: '01-texasflag-drums-graded.jpg', out: 'assets/drummer/portrait-feathered.webp',
    feather: DRUMMER_FEATHER },

  // ---- 2 THE BUILDER ------------------------------------------------------
  // Recorded product UI, not live embeds — uptime is never a portfolio
  // dependency (CLAUDE.md). No house grade applied (that recipe is tuned for
  // photographs; these are already-composed interface screenshots) — just
  // the standard resize/re-encode. The panel's own edge feather + glow are
  // rendered live (panelMaterial.ts), so the staged file is the crop as-is.
  { scene: 'builder', kind: 'photo', src: 'builder-kaelbot.jpg', out: 'assets/builder/kaelbot.jpg',
    todo: 'Kaelbot homepage hero (kaelbot-homepage-top.jpg, pricing strip trimmed off the bottom)' },
  { scene: 'builder', kind: 'photo', src: 'builder-milieuos.png', out: 'assets/builder/milieuos.jpg',
    todo: 'MilieuOS staff dashboard, cropped to header + Today + KPI tiles + open alerts (the dense-chrome crop)' },

  // CHAT REVEAL (delight pass, item 1): nine background-matched "cover
  // patch" fills, one per Kaelbot chat message (rects single-sourced from
  // src/scenes/builder/chat-messages.json — the same file the runtime
  // reveal reads). Each patch is synthesized from the screenshot itself:
  // per row, the mean of a few clean background pixels just left of the
  // message rect lerps to the mean just right of it (the panel's dusk
  // gradient is preserved; a plain strip-stretch ghosted against the
  // hero's diagonal sheen), plus a slight vertical blur so the thin sample
  // bands never read as scanlines. Downscaled to the staged panel's own
  // pixel density (TARGET_WIDTH / source width). The runtime never shows a
  // patch after its message reveals — the staged kaelbot.jpg above stays
  // the untouched source of truth.
  ...BUILDER_CHAT.messages.map((m) => ({
    scene: 'builder', kind: 'chatpatch', src: 'builder-kaelbot.jpg',
    out: `assets/builder/chat/patch-${m.id}.jpg`, rect: m,
  })),

  // ---- 3 THE DAD ----------------------------------------------------------
  // SPARKLER: graded via `node scripts/grade.mjs ../.recon/final/02-sparkler-luke.jpg`
  // with a per-frame override (warmAlpha 0.16->0.10, liftAlpha 0.42->0.34 —
  // protects the flare's own highlights from clipping; see scene3-report.md).
  // EXIF-rotate (grade.mjs stage 1) bakes the portrait orientation the depth
  // map already ships in — no separate crop needed for this frame.
  { scene: 'dad', kind: 'photo', src: '02-sparkler-luke-graded.jpg', out: 'assets/dad/sparkler.jpg' },
  { scene: 'dad', kind: 'depth', src: 'depth/02-sparkler-luke.depth.png', out: 'assets/dad/sparkler-depth.png' },
  { scene: 'dad', kind: 'feathered', src: '02-sparkler-luke-graded.jpg', out: 'assets/dad/sparkler-feathered.webp',
    feather: DAD_FEATHER },

  // SWING: the only pre-cropped photo in the film — the source burst frame
  // (03a-swing-cowboy-a.jpg) includes a fourth family member (not Zak or
  // either of his kids) at the frame's left edge; the scene brief's own
  // content ("Zak... both kids... laughing up at him") and the archive's own
  // catalog entry (zak-himself.md) both describe only the three of them, so
  // the crop (left=1300px of 4032, full height — see scene3-report.md for
  // the pixel-level verification this excludes her cleanly while keeping the
  // magnolia canopy + a lake sliver) is applied to BOTH the photo and its
  // depth map at the identical offset before either ever reaches grade.mjs
  // or this map. Graded with a per-frame override pulling hard toward golden
  // warmth (warmAlpha 0.16->0.34, liftAlpha 0.42->0.46, saturation 0.90->0.86)
  // — daylight photo, dusk-hour film.
  { scene: 'dad', kind: 'photo', src: '03a-swing-cowboy-crop-graded.jpg', out: 'assets/dad/swing.jpg' },
  { scene: 'dad', kind: 'depth', src: 'depth/03a-swing-cowboy-crop.depth.png', out: 'assets/dad/swing-depth.png' },
  { scene: 'dad', kind: 'feathered', src: '03a-swing-cowboy-crop-graded.jpg', out: 'assets/dad/swing-feathered.webp',
    feather: DAD_FEATHER },

  // ---- 4 THE NEIGHBORHOOD (the jewel) -------------------------------------
  // BUILD (beat 1): Penny in the half-built playhouse at night. Graded with
  // a per-frame override protecting the work light's own highlights (same
  // reasoning as the sparkler: warmAlpha 0.16->0.11, liftAlpha 0.42->0.34 —
  // the frame is already night; the house default over-warmed the flare off
  // the raw studs). See scene4-report.md.
  { scene: 'neighborhood', kind: 'photo', src: '04-playhouse-build-graded.jpg', out: 'assets/nbhd/build.jpg' },
  { scene: 'neighborhood', kind: 'depth', src: 'depth/04-playhouse-build.depth.png', out: 'assets/nbhd/build-depth.png' },
  { scene: 'neighborhood', kind: 'feathered', src: '04-playhouse-build-graded.jpg', out: 'assets/nbhd/build-feathered.webp',
    feather: NBHD_FEATHER },

  // THE CROSSING's source (beats 2-3): IMG_1917 graded with a per-frame
  // override that protects its overcast daylight (warmAlpha 0.16->0.24,
  // liftAlpha 0.42->0.40, saturation 0.90->0.88 — enough warmth/lift to sit
  // in the film, NOT the swing's full golden push: this frame's sky must
  // stay honest for the mask tool's sky color key AND for the world grade
  // release during the departure). THE GRADED FILE IS THE CROSSING'S
  // IDENTITY: the depth-mesh layer and the projected world both sample this
  // exact staged texture (crossing/loader.ts shares one instance), so the
  // swap stays byte-exact by construction.
  { scene: 'neighborhood', kind: 'photo', src: '05a-backyard-hero-IMG1917-graded.jpeg', out: 'photo.jpg' },
  { scene: 'neighborhood', kind: 'depth', src: 'depth/05a-backyard-hero-IMG1917.depth.png', out: 'depth.png' },
  // Packed region masks REGENERATED for the graded frame (region-geometric
  // polygons unchanged; sky color key re-verified against the graded
  // pixels) — site/tools/masks/make-masks.py, restored from the archive.
  { scene: 'neighborhood', kind: 'copy', src: 'nbhd-maskA.png', out: 'masks/maskA.png' },
  { scene: 'neighborhood', kind: 'copy', src: 'nbhd-maskB.png', out: 'masks/maskB.png' },
  // The mailbox pocket at the LYONS mailbox (beat 4): THE GAME INVITATION
  // (controller ruling, 2026-08-30 — this pocket used to carry the Luke
  // clip; that clip now lives only in Scene 6's alien-prank pocket, so it
  // never appears in two frames of the film). A clean render of the real
  // Royal Tara Cove game world (the aerial cul-de-sac turn from the
  // camera-match departure path, commit 9c05e23), the cine-mode debug HUD
  // cropped off, house-graded — see src/pockets/rtcInvite.ts for full
  // provenance.
  { scene: 'neighborhood', kind: 'photo', src: 'work-projects/rtc-game-frames/rtc-invite-graded.jpg', out: 'assets/nbhd/rtc-invite.jpg' },
  // Reduced-motion / no-WebGL static edition: real renders of the settled
  // arrival frame, captured from the live page (qa.mjs shot at street q=1,
  // landscape 4:3 + portrait 3:4 — capture aspects arrival.ts's
  // stillGlintAt math assumes). See scene4-report.md for provenance.
  { scene: 'neighborhood', kind: 'copy', src: 'nbhd-world-still.jpg', out: 'nbhd-world-still.jpg',
    todo: 'settled-arrival world render, landscape 4:3 (captured mid-build via qa.mjs)' },
  { scene: 'neighborhood', kind: 'copy', src: 'nbhd-world-still-portrait.jpg', out: 'nbhd-world-still-portrait.jpg',
    todo: 'settled-arrival world render, portrait 3:4 (captured mid-build via qa.mjs)' },

  // ---- 5 THE BAND -----------------------------------------------------------
  // GIG (beat 1): the barn-porch night gig — three bandmates under string
  // lights, an empty drum kit between them (Zak is behind the camera/the
  // kit, not in frame — see scene5-report.md). NOT the file the v1 recon
  // pass originally labeled `band-music/barn-gig-frame-250s.jpg` — that
  // frame turned out to be extracted from the WRONG source video (the
  // static-title-card lyric upload also named "One Song Town", not the
  // real filmed gig) and shows only cover art, never a person. The real
  // performance video is `~/Desktop/One Song Town (Law By The Gun) .mp4`
  // (1280x720, 5:24 — band-music.md's own citation), not the higher-res
  // `one-song-town-1080p-master.mp4` that sits in .recon/final/band-music/
  // (that "master" is itself the same lyric-video title card at every
  // timestamp checked, mislabeled by an earlier pass — see
  // scene5-report.md). This entry's source is a fresh full-quality frame
  // pulled directly from the real Desktop video at 251.3s (house-graded,
  // no per-frame override needed — the string lights don't clip).
  { scene: 'band', kind: 'photo', src: 'band-music/barn-gig-porch-251s-graded.jpg', out: 'assets/band/gig.jpg' },
  { scene: 'band', kind: 'feathered', src: 'band-music/barn-gig-porch-251s-graded.jpg', out: 'assets/band/gig-feathered.webp',
    feather: BAND_FEATHER },

  // RECORD (beat 2): the real "Lost in Austin" (2016) album art — a
  // graphic design, not a photograph, so (like THE BUILDER's screenshots)
  // it skips the house photo grade and stages as-is; the edge feather +
  // glow are rendered live (BandScene.tsx's RECORD_FEATHER).
  { scene: 'band', kind: 'photo', src: 'band-music/lost-in-austin-album-art.jpg', out: 'assets/band/album.jpg' },

  // The excerpt itself: ~30s of "One Song Town" (track 1's own quiet
  // intro building into the full band at ~15s — the "intro that builds"
  // the brief calls for; also the exact song the gig photo above is a
  // frame FROM, so the audio and the image are the same real performance/
  // recording, not an arbitrary pairing), 1s fades baked in at both ends,
  // already AAC-encoded — `copy`, not `audio`, so prepare-assets never
  // re-transcodes an already-delivered file a second lossy time (the
  // Luke-clip precedent). See scene5-report.md for the excerpt-choice
  // writeup (RMS/spectrogram analysis of all three staged tracks).
  { scene: 'band', kind: 'copy', src: 'band-lost-in-austin.m4a', out: 'assets/band/lost-in-austin-excerpt.m4a' },

  // PRACTICE (beat 3): the band-practice-with-kids photo — the crossover
  // frame. The source file ships with NO EXIF orientation tag at all (not
  // even a wrong one), so sharp's auto-`.rotate()` has nothing to correct
  // against; the fix is a 90 CW rotation baked into the staged pixels
  // BEFORE grading (the swing-crop precedent: a pre-correction documented
  // here, not left to prepare-assets to guess).
  { scene: 'band', kind: 'photo', src: '06-bandpractice-photo-rotated-graded.jpg', out: 'assets/band/practice.jpg' },
  { scene: 'band', kind: 'feathered', src: '06-bandpractice-photo-rotated-graded.jpg', out: 'assets/band/practice-feathered.webp',
    feather: BAND_FEATHER },

  // ---- 6 THE WEIRD ONES ---------------------------------------------------
  // BEAT 1 (CenTex): MF-1 PCB macro (primary) + the CenTex banner selfie
  // (secondary) — both real photos (osxphotos-verified: IMG_1056 2015-07-17,
  // IMG_1238 2015-08-12 — the museum label's "2015" is this evidence, not a
  // guess), house-graded via `node scripts/grade.mjs
  // ../.recon/final/08b-mf1-pcb.jpg ../.recon/final/08c-centex-banner-
  // selfie.jpg` (default recipe, no override needed — neither frame clips).
  // Feathered fallbacks for the no-WebGL/reducedMotion static edition
  // (WeirdScene.tsx's WeirdFallback), WEIRD_FEATHER shared with weirdRig.ts
  // via feather.json — the standing anti-drift pattern.
  // TEASPANKS (continuity re-cut, 2026-09-01): one frame of the music video
  // (t=14.0s of the 3840x2158 master; the video carries Zak's OWN grade —
  // B&W with popped orange — so it deliberately skips the house grade) and
  // a silent 5.9s loop excerpt (t=11.5s→17.4s, the kids-performing shot,
  // 1920x1080 h264, already prepared by ffmpeg — `copy`).
  { scene: 'teaspanks', kind: 'photo', src: 'teaspanks/still-14.0.jpg', out: 'assets/teaspanks/still.jpg' },
  { scene: 'teaspanks', kind: 'feathered', src: 'teaspanks/still-14.0.jpg', out: 'assets/teaspanks/still-feathered.webp',
    feather: TEASPANKS_FEATHER },
  { scene: 'teaspanks', kind: 'copy', src: 'teaspanks/teaspanks-loop-prepared.mp4', out: 'assets/teaspanks/loop.mp4' },

  { scene: 'weird', kind: 'photo', src: '08b-mf1-pcb-graded.jpg', out: 'assets/weird/mf1.jpg' },
  { scene: 'weird', kind: 'feathered', src: '08b-mf1-pcb-graded.jpg', out: 'assets/weird/mf1-feathered.webp',
    feather: WEIRD_FEATHER },
  { scene: 'weird', kind: 'photo', src: '08c-centex-banner-selfie-graded.jpg', out: 'assets/weird/banner.jpg' },
  { scene: 'weird', kind: 'feathered', src: '08c-centex-banner-selfie-graded.jpg', out: 'assets/weird/banner-feathered.webp',
    feather: WEIRD_FEATHER },

  // BEAT 2 (the broadcast): the fabricated EAS video, prepared as a small
  // MUTED ambient loop — downscaled (720x406, 30fps, crf 26) and with its
  // audio track REMOVED ENTIRELY (not just muted in the DOM — belt-and-
  // suspenders against the no-autoplay-with-sound law: there is no sound to
  // ever unmute) via a one-off ffmpeg pass documented in scene6-report.md,
  // staged here as `copy` so prepare-assets never re-transcodes it (the
  // Luke-clip/record-excerpt precedent for an already-delivered file).
  // Signed wall-clock exception: this is the one playing video texture in
  // the whole scene — see WeirdScene.tsx's header + scene6-report.md's
  // tsweep exclusion.
  //
  // INTEGRATION PASS (2026-08-30, the scene-7 critic's dead-air note): the
  // prepared loop was RE-EDITED from the 82s source down to 63s — the two
  // long all-black stretches (source seconds ~7.5–16.5 and ~75–82) and the
  // 4s black at ~54–57.5 are excised (ffmpeg trim+concat, every splice
  // inside a black region so no cut is visible; same 720x406/30fps/-an
  // recipe as the original prep). The loop now spends ~90% of its runtime
  // on the bars/alert-text content, so a slow visitor parked on the TV hold
  // is never left more than ~2s in a dead frame. The pre-edit file is kept
  // beside it as weird-eas-broadcast-prepared-original-82s.mp4.
  { scene: 'weird', kind: 'copy', src: 'alien-prank/weird-eas-broadcast-prepared.mp4', out: 'assets/weird/eas-broadcast.mp4' },
  // The broadcast's own opening frame (real SMPTE color bars under an
  // "EMERGENCY BROADCAST SYSTEM" title card) — the reducedMotion/no-WebGL
  // static texture, through the IDENTICAL tvMaterial.ts shader as the live
  // edition (texture-agnostic uMap — see tvMaterial.ts's header), so both
  // editions share pixel-identical bezel/scanline/vignette framing. Staged
  // as `photo` (a plain resize/re-encode, no house grade — this is a
  // broadcast graphic with iconic reference colors, THE BUILDER's own
  // screenshot precedent for skipping the photographic grade).
  { scene: 'weird', kind: 'photo', src: 'alien-prank/weird-eas-static.jpg', out: 'assets/weird/eas-static.jpg' },

  // THE DISCOVERY POCKET: the real payoff, hard-cut from two real clips
  // into one delivered file (see pockets/alienPrank.ts's header for the
  // exact provenance/ffmpeg command) — staged as `copy`, never re-
  // transcoded a second lossy time.
  { scene: 'weird', kind: 'copy', src: 'alien-prank/weird-tinfoil-punchline.mp4', out: 'weird-tinfoil-punchline.mp4' },
  { scene: 'weird', kind: 'copy', src: 'alien-prank/weird-tinfoil-punchline-poster.jpg', out: 'weird-tinfoil-punchline-poster.jpg' },
  { scene: 'weird', kind: 'copy', src: 'alien-prank/weird-tinfoil-punchline.vtt', out: 'weird-tinfoil-punchline.vtt' },

  // ---- 7 THE KEEPER -------------------------------------------------------
  // BEAT 1 (the sign): the hand-built TEXAS sign at dusk (08a, upright
  // 3024x4032, osxphotos-verified — finalization.md table 1), house-graded
  // via `node scripts/grade.mjs ../.recon/final/08a-texas-sign-dusk.jpg`
  // (DEFAULT recipe, checked by eye: the backlit lettering and string
  // lights hold without clipping, the sky keeps its blue hour — no
  // per-frame override needed). Depth map rated "Excellent" by
  // finalization.md (sign/longhorn/tower/tree/angel in distinct bands).
  // KEEPER_FEATHER carries TWO shapes (see feather.json): `.photo` for the
  // sign/box/diptych, `.plaque` (much wider) for the plaque video's
  // near-black surround.
  { scene: 'keeper', kind: 'photo', src: '08a-texas-sign-dusk-graded.jpg', out: 'assets/keeper/sign.jpg' },
  { scene: 'keeper', kind: 'depth', src: 'depth/08a-texas-sign-dusk.depth.png', out: 'assets/keeper/sign-depth.png' },
  { scene: 'keeper', kind: 'feathered', src: '08a-texas-sign-dusk-graded.jpg', out: 'assets/keeper/sign-feathered.webp',
    feather: KEEPER_FEATHER.photo },

  // BEAT 2 (the keeping): the candle-lit plaque for Luke — an 8s excerpt
  // (seconds 1.0-9.0, the steady framed window where the carving reads;
  // the camera starts wandering ~20s in) of 10a-luke-candle-video.mov
  // (438C9AB2, 2026-02-16 — the library's most recent maker artifact),
  // prepared as a small SILENT ambient loop: 608x1080/30fps, `-an`
  // (defensive — ffprobe shows the source .mov carries NO audio stream at
  // all), and the house grade's shadow-lift approximated in one exact
  // lutrgb pass (screen-blend against the dusk indigo: out = val*(1-k)+255k
  // per channel, k = 0.42 * liftColor/255 — grade.mjs's stage 2, closed
  // form; the warm stage is skipped, the frame is already candle-amber).
  // Staged `copy` (already-delivered file, never re-transcoded — the
  // standing precedent). SIGNED WALL-CLOCK EXCEPTION #2 of the film (the
  // EAS TV was #1): see KeeperScene.tsx's header + scene7-report.md.
  { scene: 'keeper', kind: 'copy', src: 'keeper/keeper-plaque-loop.mp4', out: 'assets/keeper/plaque-loop.mp4' },
  // The loop's own 2.5s frame — the reducedMotion/no-WebGL static edition,
  // extracted from the PREPARED (graded, downscaled) loop so both editions
  // are pixel-continuous. `photo` kind = plain resize/re-encode (no house
  // grade — the lut above already graded it once).
  { scene: 'keeper', kind: 'photo', src: 'keeper/keeper-plaque-static.jpg', out: 'assets/keeper/plaque-static.jpg' },
  { scene: 'keeper', kind: 'feathered', src: 'keeper/keeper-plaque-static.jpg', out: 'assets/keeper/plaque-feathered.webp',
    feather: KEEPER_FEATHER.plaque },
  // Penny's keepsake box (secondary/deeper — "notes to my kids," plural,
  // made visually true): a full-res frame from 10b-penny-box-video.mov
  // (3C51BA72, 2025-02-05) at 10.0s — lid held open, the wood-burned note
  // fully legible — cropped 2160x3000 (y 600-3600: trims the grey wall
  // band and desk foreground; his computer mouse deliberately stays in
  // frame — the thesis in one accident), then house-graded (default
  // recipe).
  { scene: 'keeper', kind: 'photo', src: 'keeper/keeper-pennybox-still-graded.jpg', out: 'assets/keeper/penny.jpg' },
  { scene: 'keeper', kind: 'feathered', src: 'keeper/keeper-pennybox-still-graded.jpg', out: 'assets/keeper/penny-feathered.webp',
    feather: KEEPER_FEATHER.photo },

  // BEAT 3 (then/now): Zak's OWN composed diptych (5ACFD834 — the same
  // piggyback pose with the same person, ~15 years apart; zak-himself.md).
  // Staged AS-IS, no house grade — the album-art/screenshot precedent: an
  // already-composed artifact keeps its author's own black-and-white
  // treatment; re-grading his composition would be editing his work.
  // (thennow.jpg remains the reduced-motion edition's frame and the
  // no-WebGL fallback — the delight pass's crossfade below replaces it only
  // in the live WebGL edition.)
  // THE FINALE PAIR (continuity re-cut, 2026-09-01 — Zak: the friend diptych
  // "makes no sense", the finale premieres his kids): DAY ONE is the 2017
  // delivery-room photograph (3024x4032 after EXIF rotate); NOW is two
  // frames from one January 2025 session — Penny on his shoulders (uuid
  // AD9C9E59, his own favorite) then Luke on his shoulders (644D9CE6), both
  // 3024x4032 (.recon/reports/round2-archaeology.md §2). All three are
  // house-graded upstream (grade.mjs) like every photograph in the film.
  { scene: 'keeper', kind: 'photo', src: 'keeper/dayone-graded.jpg', out: 'assets/keeper/dayone.jpg' },
  { scene: 'keeper', kind: 'feathered', src: 'keeper/dayone-graded.jpg', out: 'assets/keeper/dayone-feathered.webp',
    feather: KEEPER_FEATHER.photo },
  { scene: 'keeper', kind: 'photo', src: 'keeper/now-penny-graded.jpg', out: 'assets/keeper/now-penny.jpg' },
  { scene: 'keeper', kind: 'feathered', src: 'keeper/now-penny-graded.jpg', out: 'assets/keeper/now-penny-feathered.webp',
    feather: KEEPER_FEATHER.photo },
  { scene: 'keeper', kind: 'photo', src: 'keeper/now-luke-graded.jpg', out: 'assets/keeper/now-luke.jpg' },
  { scene: 'keeper', kind: 'feathered', src: 'keeper/now-luke-graded.jpg', out: 'assets/keeper/now-luke-feathered.webp',
    feather: KEEPER_FEATHER.photo },

];


// Every GLB the vendored world subset can reference (the proven list,
// verbatim from v1) — the neighborhood scene's live Royal Tara Cove world.
const MODEL_KEYS = [
  'oak', 'crepemyrtle', 'shrub', 'mailbox',
  'truck', 'sedan', 'bike', 'golfcart',
  'grill', 'patioset', 'trashbins',
  'sofa', 'coffeetable', 'tv', 'floorlamp', 'houseplant',
];

function fresh(out, src) {
  if (FORCE) return false;
  if (!existsSync(out)) return false;
  try {
    return statSync(out).mtimeMs >= statSync(src).mtimeMs;
  } catch {
    return false;
  }
}

async function stage(entry) {
  const src = path.join(FINAL_DIR, entry.src);
  const out = path.join(OUT_DIR, entry.out);
  mkdirSync(path.dirname(out), { recursive: true });
  if (entry.optional && !existsSync(src)) {
    console.log(`  ${entry.out.padEnd(28)} SKIPPED (optional source missing: ${entry.src})`);
    return;
  }
  if (fresh(out, src)) {
    console.log(`  ${entry.out.padEnd(28)} up to date`);
    return;
  }
  if (entry.kind === 'photo') {
    await sharp(src)
      .rotate() // bake EXIF orientation
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(out);
  } else if (entry.kind === 'feathered') {
    // Fallback composition asset: the graded photo with its edge feather
    // BAKED into an alpha channel (rect feather, per-edge widths in UV
    // fractions — mirrors the scene shader's uFeather so the no-WebGL frame
    // melts into the dusk ground the same way the live one does).
    const { data, info } = await sharp(src)
      .rotate()
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels } = info;
    const f = entry.feather;
    const sstep = (e, x) => {
      const t = Math.max(0, Math.min(1, x / e));
      return t * t * (3 - 2 * t);
    };
    const out4 = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1); // UV v (bottom = 0) to mirror the shader
      const aT = sstep(f.top, 1 - v);
      const aB = sstep(f.bottom, v);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const a = sstep(f.left, u) * sstep(f.right, 1 - u) * aT * aB;
        const si = (y * w + x) * channels;
        const di = (y * w + x) * 4;
        out4[di] = data[si];
        out4[di + 1] = data[si + 1];
        out4[di + 2] = data[si + 2];
        out4[di + 3] = Math.round(a * 255);
      }
    }
    await sharp(out4, { raw: { width: w, height: h, channels: 4 } })
      .webp({ quality: 84, alphaQuality: 90 })
      .toFile(out);
  } else if (entry.kind === 'chatpatch') {
    // Background-matched cover fill for one chat message (see the STAGING
    // MAP comment): per-row edge lerp between clean pixels flanking the
    // rect, gentle vertical blur, downscaled to the staged panel's density.
    const PAD = 4;
    const BAND = 8;
    const rect = entry.rect;
    const meta = await sharp(src).metadata();
    const sampleFor = (left) =>
      sharp(src)
        .extract({
          left: Math.max(0, Math.min(left, meta.width - BAND)),
          top: rect.top,
          width: BAND,
          height: rect.height,
        })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const [l, r] = await Promise.all([
      sampleFor(rect.left - PAD - BAND),
      sampleFor(rect.left + rect.width + PAD),
    ]);
    const w = rect.width;
    const rows = rect.height;
    const fill = Buffer.alloc(w * rows * 3);
    const rowMean = ({ data, info }, y) => {
      const acc = [0, 0, 0];
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        acc[0] += data[i];
        acc[1] += data[i + 1];
        acc[2] += data[i + 2];
      }
      return acc.map((v) => v / info.width);
    };
    for (let y = 0; y < rows; y++) {
      const ml = rowMean(l, y);
      const mr = rowMean(r, y);
      for (let x = 0; x < w; x++) {
        const t = w > 1 ? x / (w - 1) : 0;
        const di = (y * w + x) * 3;
        fill[di] = Math.round(ml[0] + (mr[0] - ml[0]) * t);
        fill[di + 1] = Math.round(ml[1] + (mr[1] - ml[1]) * t);
        fill[di + 2] = Math.round(ml[2] + (mr[2] - ml[2]) * t);
      }
    }
    const scale = TARGET_WIDTH / BUILDER_CHAT.imageWidth;
    await sharp(fill, { raw: { width: w, height: rows, channels: 3 } })
      .blur(1.2)
      .resize({ width: Math.max(1, Math.round(w * scale)) })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(out);
  } else if (entry.kind === 'depth') {
    await sharp(src, { limitInputPixels: false })
      .resize({ width: TARGET_WIDTH, kernel: 'lanczos3' })
      .png()
      .toFile(out);
  } else if (entry.kind === 'video') {
    execFileSync(
      'ffmpeg',
      [
        '-y', '-i', src,
        '-map_metadata', '-1', // strip GPS etc. before anything is public
        '-c:v', 'libx264', '-profile:v', 'high', '-crf', '21',
        '-preset', 'slow', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        out,
      ],
      { stdio: 'inherit' },
    );
  } else if (entry.kind === 'audio') {
    execFileSync(
      'ffmpeg',
      ['-y', '-i', src, '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '160k', out],
      { stdio: 'inherit' },
    );
  } else {
    copyFileSync(src, out);
  }
  console.log(`  ${entry.out.padEnd(28)} <- .recon/final/${entry.src}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const entries = SCENE_ARG
    ? STAGING_MAP.filter((e) => e.scene === SCENE_ARG)
    : STAGING_MAP;
  if (SCENE_ARG && entries.length === 0) {
    console.error(`prepare-assets: unknown scene '${SCENE_ARG}'`);
    process.exit(1);
  }

  const present = [];
  const missing = [];
  for (const entry of entries) {
    if (existsSync(path.join(FINAL_DIR, entry.src))) present.push(entry);
    else if (entry.optional) console.log(`  ${entry.out.padEnd(28)} SKIPPED (optional source not delivered yet: ${entry.src})`);
    else missing.push(entry);
  }

  for (const entry of present) {
    await stage(entry);
  }

  // Finalized files nobody mapped — surface them so a rename in
  // .recon/final/ is one map edit away, never invisible.
  if (existsSync(FINAL_DIR)) {
    const mapped = new Set(STAGING_MAP.map((e) => e.src));
    const unmapped = readdirSync(FINAL_DIR).filter(
      (f) => !f.startsWith('.') && !mapped.has(f) &&
        statSync(path.join(FINAL_DIR, f)).isFile(),
    );
    if (unmapped.length) {
      console.warn(`\n  UNMAPPED in .recon/final/ (extend STAGING_MAP if these are deliverables):`);
      for (const f of unmapped) console.warn(`    ${f}`);
    }
  } else {
    console.warn(`\n  NOTE: ${path.relative(repoRoot, FINAL_DIR)}/ does not exist yet — the finalization agent is filling it.`);
  }

  // ---- world GLBs (from ~/Game — read-only source, proven v1 step) --------
  if (SCENE_ARG && SCENE_ARG !== 'neighborhood') {
    // scene-scoped run that doesn't own the world models — skip them
  } else if (existsSync(GAME_MODELS)) {
    mkdirSync(OUT_MODELS, { recursive: true });
    let copied = 0;
    let current = 0;
    const missingGlbs = [];
    for (const key of MODEL_KEYS) {
      const src = path.join(GAME_MODELS, `${key}.glb`);
      if (!existsSync(src)) {
        missingGlbs.push(src);
        continue;
      }
      const out = path.join(OUT_MODELS, `${key}.glb`);
      if (!fresh(out, src)) {
        copyFileSync(src, out);
        copied++;
      } else {
        current++;
      }
    }
    if (missingGlbs.length) {
      console.warn(`  WARNING: ${missingGlbs.length} GLB(s) missing from ~/Game (skipped):`);
      for (const m of missingGlbs) console.warn(`    ${m}`);
    }
    console.log(`  models: ${copied} copied, ${current} up to date -> ${path.relative(siteRoot, OUT_MODELS)}`);
  } else {
    missing.push({
      scene: 'neighborhood', kind: 'copy', src: '(~/Game/public/assets/models)',
      out: 'assets/models/*.glb', todo: 'world GLBs — the ~/Game repo is the read-only source',
    });
  }

  // ---- the loud part ------------------------------------------------------
  if (missing.length) {
    console.error(`\nprepare-assets: ${present.length}/${entries.length} staged — MISSING ${missing.length} (TODO by scene, docs/v2-direction.md):`);
    let lastScene = '';
    for (const e of missing) {
      if (e.scene !== lastScene) {
        console.error(`\n  [${e.scene.toUpperCase()}]`);
        lastScene = e.scene;
      }
      console.error(`    .recon/final/${e.src}`);
      console.error(`      -> public/${e.out}${e.todo ? ` — ${e.todo}` : ''}`);
    }
    console.error(
      `\nprepare-assets: FAILING LOUDLY (v2 law — a missing asset is never a silent skip).\n` +
        `The finalization agent is filling .recon/final/; re-run once its deliveries land.`,
    );
    process.exit(1);
  }

  console.log(`prepare-assets: done -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
