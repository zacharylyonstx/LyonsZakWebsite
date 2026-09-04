// THE voice-line inventory — every line the film speaks, in one place.
//
// LAW (CLAUDE.md): all dialogue here is ILLUSTRATIVE until Zak's own pass.
// These strings demonstrate placement and rhythm; the shipped words must come
// from his real phrasing, recordings, and writing — never canonize invented
// lines. Each string is marked /* ILLUSTRATIVE */ to make that impossible to
// forget.
//
// CONTINUITY RE-CUT (2026-09-01, Zak's review notes): every line is now
// written for a visitor who knows nothing about Zak — names before
// pronouns, places named, cause → effect said once, no line that needs the
// previous site to make sense. Facts are checked against the résumé and the
// evidence records (.recon/reports/accuracy-sweep.md, round2-archaeology.md):
//   · "seven years in" — first software-engineering year 2019 (résumé "7+").
//   · The band: brothers Michael + Zak Lyons met Dylan Gully and Shawn
//     Clampitt at Texas State in 2012 (the band's own bio); Zak drummed on
//     Lost in Austin (2016) and still drums for them — his own words
//     (2026-09-01): "I'm the drummer still" — so the film says so, present
//     tense, with no dates on it.
//   · TeaSpanks: Zak's own words — "a music video I made from an ai song
//     that was generated out of a funny song my son randomly sang while in
//     the car in drive through at hteao"; months of work; the kids star.
//   · The finale pair: Penny's delivery room, 2017 → the three of them now.
//
// Windows are JOURNEY-absolute [start, end] on the 0..1 timeline, written as
// the owning segment's start + a PIXEL offset (segments.ts's px()) so they
// ride with the pixel-weighted map instead of rotting as bare fractions.
// They must be sorted and non-overlapping — voice.test.ts enforces both. The
// fade envelope is computed in Subtitle.tsx as a pure function of journey
// position.
import { SEGMENTS, px } from '../timeline/segments';

export interface VoiceLine {
  /** The spoken line, first person, film-subtitle register. */
  text: string;
  /** Journey window [start, end] during which the line is on screen. */
  window: readonly [number, number];
}

/** A window inside a segment: [start + a px, start + b px]. */
function at(seg: readonly [number, number], a: number, b: number): readonly [number, number] {
  return [seg[0] + px(a), seg[0] + px(b)];
}

const S = SEGMENTS;

export const VOICE_LINES: readonly VoiceLine[] = [
  // THE DRUMMER (1500px) — the title frame carries "Senior software
  // engineer. Texas." itself; his voice arrives the moment travel begins.
  // Line 2 plants the band chapter so the drum kit is a promise, not a
  // puzzle.
  {
    text: /* ILLUSTRATIVE */
      "Hi. I'm Zak. I build things — software, mostly. Also everything else.",
    window: at(S.drummer, 150, 720),
  },
  {
    text: /* ILLUSTRATIVE */ "That's me behind the kit. We'll get to the band.",
    window: at(S.drummer, 800, 1250),
  },

  // THE BUILDER (1500px) — two lines that prove real, shipped work. No
  // tech-stack recital; the résumé is one click up.
  {
    text: /* ILLUSTRATIVE */
      "By day I'm a senior software engineer — seven years in. Healthcare, startups, legacy rescues.",
    window: at(S.builder, 187.5, 775.5),
  },
  {
    text: /* ILLUSTRATIVE */
      'Lately: Kaelbot, an AI agent that job-hunts for me — built solo. And MilieuOS, software for treatment centers.',
    window: at(S.builder, 850.5, 1437),
  },

  // THE DAD (1650px) — names first. A stranger now knows who Penny and
  // Luke are before the playhouse, the game, the band practice, or the
  // finale mention them.
  {
    text: /* ILLUSTRATIVE */ 'These two are Penny and Luke. The center of everything.',
    window: at(S.dad, 247.5, 604.5),
  },
  {
    text: /* ILLUSTRATIVE */ 'Most of what I build, I build for them.',
    window: at(S.dad, 990, 1429.5),
  },

  // THE NEIGHBORHOOD (5300px) — the playhouse, then the place NAMED, then
  // the loss, then silence through the crossing (the law: no captions
  // inside [CROSS_P_START_T, CROSS_P_END_T] — the photograph becoming the
  // game speaks for itself), then the why at the street settle, then the
  // invitation — with the PLAY pill on screen beside it.
  {
    text: /* ILLUSTRATIVE */ 'One winter I built them a playhouse in our backyard.',
    window: at(S.neighborhood, 525, 915),
  },
  {
    text: /* ILLUSTRATIVE */
      'This was our street — Royal Tara Cove, Austin. Then we moved away.',
    window: at(S.neighborhood, 1150, 1500),
  },
  {
    text: /* ILLUSTRATIVE */
      'So I rebuilt it as a video game. The whole cul-de-sac, house by house.',
    window: at(S.neighborhood, 4560, 4980),
  },
  {
    text: /* ILLUSTRATIVE */
      "It's real, it's online, and the kids and I still play there. So can you.",
    window: at(S.neighborhood, 5040, 5290),
  },

  // THE BAND (1650px) — who, where, when, what instrument; then the record
  // (the jukebox pill is on screen); then the inheritance.
  {
    text: /* ILLUSTRATIVE */
      "Law By The Gun. Four of us met at Texas State in 2012. I'm the drummer.",
    window: at(S.band, 138, 619.5),
  },
  {
    text: /* ILLUSTRATIVE */ 'We made a record — Lost in Austin, 2016. Go ahead, pick a track.',
    window: at(S.band, 760, 1150),
  },
  {
    text: /* ILLUSTRATIVE */ 'The band never really ended. It just added two members.',
    window: at(S.band, 1375.5, 1623),
  },

  // TEASPANKS (2000px) — three beats (2026-09-03, from Zak's own retelling:
  // "he randomly started singing… then I used AI and turned it into a
  // metal song, and we made a music video to it"): the drive-through (with
  // the lyric itself on screen as the chapter's title card), the AI, the
  // months of shooting. The HEAR and WATCH pills carry the rest.
  {
    text: /* ILLUSTRATIVE */
      'One day, in the HTeaO drive-through, Luke made up a song.',
    window: at(S.teaspanks, 120, 700),
  },
  {
    text: /* ILLUSTRATIVE */
      'So I fed it to an AI and asked for metal. It obliged.',
    window: at(S.teaspanks, 1000, 1400),
  },
  {
    text: /* ILLUSTRATIVE */
      'Then the three of us spent months shooting the music video.',
    window: at(S.teaspanks, 1420, 1700),
  },

  // THE WEIRD ONES (1650px) — unchanged, verified (accuracy-sweep.md #14, #16).
  {
    text: /* ILLUSTRATIVE */
      'For a while I designed and sold ghost-hunting hardware. Real company. Real customers. Real ghosts — unconfirmed.',
    window: at(S.weird, 69, 516),
  },
  {
    text: /* ILLUSTRATIVE */
      'In 2024 I produced a fake emergency broadcast about an alien invasion. The children took it seriously.',
    window: at(S.weird, 769.5, 1410),
  },

  // THE KEEPER (1950px) — the things he keeps; then the finale triptych:
  // day one (2017, the delivery room) → Penny on his shoulders → Luke on
  // his shoulders. Line 3 sits on the held day-one frame; line 4 lands as
  // Penny resolves (CARRY_MIX_1); line 5 as Luke resolves (CARRY_MIX_2) and
  // holds into the end card — keeperRig.test.ts pins the ordering.
  {
    text: /* ILLUSTRATIVE */ 'I build things you can hold, too.',
    window: at(S.keeper, 126, 282),
  },
  {
    text: /* ILLUSTRATIVE */
      'I carve notes to my kids. I digitize the family tapes. I keep things.',
    window: at(S.keeper, 690, 1017),
  },
  {
    text: /* ILLUSTRATIVE */ 'That was day one.',
    window: at(S.keeper, 1120, 1270),
  },
  {
    text: /* ILLUSTRATIVE */ 'This is now.',
    window: at(S.keeper, 1310, 1420),
  },
  {
    text: /* ILLUSTRATIVE */ 'Still the whole point.',
    window: at(S.keeper, 1460, 1610),
  },
];
