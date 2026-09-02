// THE BAND's two pockets — pure content, no JSX (the mug.ts / rtcInvite.ts
// split): BandScene.tsx assembles them.
//
// PROVENANCE (2026-09-01, verified this pass — .recon/reports/round2-
// archaeology.md + docs/superpowers/specs/2026-09-01-v2-continuity-recut-
// design.md):
//   · "One Song Town - Law By The Gun" is the band's own upload on their
//     YouTube channel (LawbytheGunMusic, video id fAbHQ_58eyc, 5:13) — the
//     same produced music video the gig frame is a still from.
//   · Lost in Austin (2016) is on Spotify: album 02eHpr1PLE2UBzq5Ygv6hL,
//     artist 2x3JINVlGZHFiamYAQFsTm — the record Zak drummed on; the
//     pocket embeds that one (the later 2021 releases aren't his to claim).
// Embeds load only while a pocket is open (PocketEmbed) — never during the
// scroll film.

export const OST_YOUTUBE_ID = 'fAbHQ_58eyc';
export const LOST_IN_AUSTIN_SPOTIFY_ALBUM = '02eHpr1PLE2UBzq5Ygv6hL';
export const LAW_BY_THE_GUN_SPOTIFY_ARTIST = '2x3JINVlGZHFiamYAQFsTm';

export interface EmbedPocketContent {
  title: string;
  glintLabel: string;
  embedSrc: string;
  embedTitle: string;
  caption: string;
  linkHref: string;
  linkLabel: string;
}

export const OST_VIDEO_CONTENT: EmbedPocketContent = {
  title: 'The music video — One Song Town',
  glintLabel: 'Look closer — watch the One Song Town music video',
  embedSrc: `https://www.youtube-nocookie.com/embed/${OST_YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
  embedTitle: 'One Song Town — Law By The Gun (music video)',
  /* ILLUSTRATIVE */
  caption:
    "that barn-porch frame is from this — the video we shot for One Song Town. that's me on the kit, the one you never quite see.",
  linkHref: `https://www.youtube.com/watch?v=${OST_YOUTUBE_ID}`,
  linkLabel: 'OPEN ON YOUTUBE ↗',
};

export const JUKEBOX_CONTENT: EmbedPocketContent = {
  title: 'The jukebox — Lost in Austin, 2016',
  glintLabel: 'Play the whole record — Lost in Austin on Spotify',
  embedSrc: `https://open.spotify.com/embed/album/${LOST_IN_AUSTIN_SPOTIFY_ALBUM}?utm_source=generator&theme=0`,
  embedTitle: 'Lost in Austin — Law By The Gun, on Spotify',
  /* ILLUSTRATIVE */
  caption:
    "twelve songs, one record, four friends in a San Marcos garage turned Austin. pick any of them — that's me on drums, all twelve.",
  linkHref: `https://open.spotify.com/album/${LOST_IN_AUSTIN_SPOTIFY_ALBUM}`,
  linkLabel: 'OPEN IN SPOTIFY ↗',
};
