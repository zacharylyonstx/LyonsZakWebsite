// The arrival segment's pocket content — THE GAME INVITATION at the LYONS
// mailbox (controller ruling, 2026-08-30: Luke's "Guess we have to die."
// clip appeared in both this pocket and Scene 6's alien-prank pocket,
// violating the film's no-frame-twice rule; the clip belongs to Scene 6,
// whose comedy arc climaxes on it — see scene6-report.md and alienPrank.ts.
// This pocket becomes the invitation to play the real Royal Tara Cove
// instead). Pure data, no JSX (mirrors mug.ts's own split) —
// RtcInvitePocket.tsx is the mountable component NeighborhoodScene.tsx
// drops at the mailbox glint; this module is just the content.
//
// IMAGE PROVENANCE: a clean render of the real Royal Tara Cove game world
// (~/Game, branch cine-mode), captured during the camera-match research for
// the neighborhood crossing (commit 9c05e23, site/experiments/match/ ->
// .recon/final/work-projects/rtc-game-frames/match-path-2.png) — the aerial
// turn over the cul-de-sac from the authored departure path, chosen over
// the tighter street-level frame (path-3.png) and the yard-level matched
// pose (matched-render.png) because it reads as "a whole neighborhood," the
// same claim the mailbox line makes. The source frame carries the cine-mode
// tool's own debug HUD burned into the top-right corner (a dev-tool
// artifact, never shipped); cropped clean (top 140px of 1200, HUD's full
// extent, no scene content lost — plain overcast sky the rest of the way)
// and run through the house grade (scripts/grade.mjs's default RECIPE,
// gradeBuffer(crop) then jpeg q95) so it sits in the film's world instead
// of reading as a raw screenshot — landed at
// .recon/final/work-projects/rtc-game-frames/rtc-invite-graded.jpg. See
// prepare-assets.mjs's `rtc-invite` entry for the staged output.
//
// LINK: the real, currently-live Royal Tara Cove build. Opens in a new tab
// (rel="noopener noreferrer" — see PocketCard.tsx) so leaving never costs
// the visitor their place in the film.

export interface RtcInviteContent {
  title: string;
  glintLabel: string;
  imageSrc: string;
  imageAlt: string;
  /** The one self-introducing voice line: this is a real, playable game,
   *  not a cutscene rendered for the tour. Illustrative until Zak supplies
   *  his own wording — see the project's ILLUSTRATIVE law
   *  (docs/project-map.md). */
  caption: string;
  linkHref: string;
  linkLabel: string;
}

export const RTC_INVITE_CONTENT: RtcInviteContent = {
  title: 'The real game',
  glintLabel: 'Look closer — play the real game',
  imageSrc: '/assets/nbhd/rtc-invite.jpg',
  imageAlt:
    'An aerial view inside the real Royal Tara Cove game: two-story townhouses ringing a cul-de-sac, parked trucks and cars, mailboxes at the curb, and flowering trees along the street — the neighborhood rebuilt in code.',
  /* ILLUSTRATIVE */
  caption:
    "that's not a fly-through for the tour — it's a real game. I rebuilt the whole neighborhood in code, and the kids and I still play it. your turn.",
  linkHref: 'https://royal-tara-cove.netlify.app/',
  linkLabel: 'PLAY ROYAL TARA COVE → royal-tara-cove.netlify.app',
};
