// THE WEIRD ONES's discovery pocket — the site's comedy crown jewel (the
// scene brief's own words). Pure data, no JSX (mirrors lukeClip.ts's own
// split): AlienPrankPocket.tsx is the mountable component WeirdScene.tsx
// drops at the TV's own glint; this module is just the content.
//
// PROVENANCE: two real clips, hard-cut together into ONE delivered file so
// the pocket opens a single continuous payoff rather than juggling two
// players (judged the cleanest per the brief's own "or as a second chapter
// in the same pocket — judge the cleanest").
//
//   Chapter 1 (0.0-7.4s): `fam-alien-prank-kids-watching.mp4`, seconds
//   44.0-51.4 of the real 176s clip — the moment both kids' tinfoil hats
//   read clearly against the TV's own blue glow (verified against
//   `fam-alien-prank-heroframe.jpg`, the recon team's own curated still:
//   the frame at ~48s matches it almost exactly). AUDIO ESSENTIAL (per
//   family-kids.md) — plays WITH sound, not muted.
//
//   Chapter 2 (7.4-12.83s): the EXACT SAME file already used by the
//   arrival-segment pocket (`.recon/final/luke-clip/
//   luke-i-guess-we-have-to-die.mp4` — see lukeClip.ts), Luke's 5.4s
//   real deadpan punchline, byte-identical source, never re-transcoded.
//   See scene6-report.md for the honest flag on reusing this same clip in
//   two scenes for two different narrative jobs.
//
// Hard cut, not a dissolve (comedic timing: the brief asks that "the
// punchline LANDS," and a cross-dissolve between a wide shot and a
// close-up reads as contemplative, not funny — a professional edit cuts
// straight to the joke). A 0.15s fade-in from black opens the pocket; a
// 0.15s fade-out closes it at the true end (12.833s) so the clip never
// just stops on an unfaded frame. Built via ffmpeg concat (filter, not the
// demuxer, so two different source encodes combine cleanly) — see
// scene6-report.md for the exact command.
//
// CAPTIONS: chapter 1 carries no clear speech (silencedetect confirms
// intermittent above-threshold ambient sound in that window, but nothing
// transcribable with confidence — no whisper/ASR pipeline was reachable
// this session, see scene6-report.md) — captioned honestly as a bracketed
// non-speech description, never invented dialogue. Chapter 2 reuses
// public/luke-clip.vtt's own verified transcript verbatim (time-shifted by
// the hard-cut point, +7.4s) — "Guess we have to die." / "We do have to
// die.", the same real audio already verified for the arrival pocket.

export interface AlienPrankContent {
  title: string;
  glintLabel: string;
  videoSrc: string;
  posterSrc: string;
  captionsSrc: string;
  /** The one voice line introducing the payoff to a stranger — ILLUSTRATIVE
   *  until Zak supplies his own wording (CLAUDE.md's standing law). */
  caption: string;
}

export const ALIEN_PRANK_CONTENT: AlienPrankContent = {
  title: 'The real footage',
  glintLabel: 'Look closer — what actually happened',
  videoSrc: '/weird-tinfoil-punchline.mp4',
  posterSrc: '/weird-tinfoil-punchline-poster.jpg',
  captionsSrc: '/weird-tinfoil-punchline.vtt',
  /* ILLUSTRATIVE */
  caption:
    "they wore the hats the whole night. my son's verdict, unprompted, a few minutes in: “guess we have to die.”",
};
