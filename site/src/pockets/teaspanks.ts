// TEASPANKS's pocket — pure content, no JSX (the rtcInvite.ts split);
// TeaspanksScene.tsx assembles it.
//
// PROVENANCE (2026-09-01): "TeaSpanks" is Zak's own upload on his YouTube
// channel (video id cXTfICJXWYY, 2:06) — the produced music video for the
// song he made from Luke's HTeaO drive-through improv. The source master
// (TeaSpanks.MOV, 3840x2158, 125.5s) is in his iCloud Drive; the chapter's
// still + silent loop are cut from it (.recon/final/teaspanks/). Zak's own
// words for the chain: "a music video I made from an ai song that was
// generated out of a funny song my son randomly sang while in the car in
// drive through at hteao." The video's own title cards read BY LUKE & PENNY
// / IN AN H-TEA-O DRIVE THROUGH.

export const TEASPANKS_YOUTUBE_ID = 'cXTfICJXWYY';

export const TEASPANKS_CONTENT = {
  title: 'TeaSpanks — the music video',
  pillLabel: 'Watch TeaSpanks',
  pillSub: '2:06 · sound on',
  ariaLabel: 'Watch TeaSpanks, the two-minute music video (opens a player)',
  embedSrc: `https://www.youtube-nocookie.com/embed/${TEASPANKS_YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
  embedTitle: 'TeaSpanks — the music video by Luke & Penny, produced by Dad',
  /* ILLUSTRATIVE */
  caption:
    'Luke sang the chorus, unprompted, in the HTeaO drive-through. I fed it to an AI and asked for metal; then the three of us spent months on the video. This is the whole thing — sound on.',
  linkHref: `https://www.youtube.com/watch?v=${TEASPANKS_YOUTUBE_ID}`,
  linkLabel: 'OPEN ON YOUTUBE ↗',
  /** The museum label under the frame (portrait gets the short form —
   *  the long one overruns a 390px frame). */
  label: 'TEASPANKS — 2025 · BY LUKE & PENNY · PRODUCED BY DAD',
  labelShort: 'TEASPANKS — 2025 · BY LUKE & PENNY',
} as const;

/** THE LYRIC — the chapter's title card. Luke's line, as he sang it (Zak,
 *  2026-09-03: "he randomly started singing tea spanks, tea spanks, mama
 *  comes out and spanks your butt"); the produced song's own lyric sheet
 *  (Suno, Feb 2025) reads "Tea Spanks — / Tea Spanks — / Momma comes out /
 *  And SPANKS. YOUR. BUTT". Real material, not invented dialogue. */
export const TEASPANKS_LYRIC = {
  eyebrow: 'Luke · HTeaO drive-through · unprompted',
  // A non-breaking space keeps the dash on the first line on a phone.
  lines: ['Tea spanks, tea spanks\u00a0—', 'Momma comes out', 'and spanks your butt.'],
} as const;

/** THE SONG — an 18-second excerpt of the produced track (the first
 *  chorus, ~0:26–0:44; fades baked; public/assets/teaspanks/song-excerpt.m4a,
 *  cut from the master in .recon/final/teaspanks/). The generator's own
 *  genre tag for it was "dark sinister playful" — quoted verbatim. */
export const TEASPANKS_SONG = {
  excerptUrl: '/assets/teaspanks/song-excerpt.m4a',
  pillLabel: 'Hear the song',
  pillLabelPlaying: 'Playing — Tea Spanks',
  pillSub: '18s · tagged “dark, sinister, playful”',
  ariaLabel: 'Hear the song: an eighteen-second excerpt of Tea Spanks, the metal track made from Luke’s line',
  ariaLabelPlaying: 'Stop the song',
} as const;
