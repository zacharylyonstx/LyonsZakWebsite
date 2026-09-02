// The mailbox pocket, fully assembled and ready to mount —
// NeighborhoodScene.tsx drops this at the LYONS mailbox glint:
//
//   <RtcInvitePocket ref={handle} glintAt={someAnchor} timeline={timeline} />
//
// It takes "the same Pocket API" (glintAt/timeline/onOpen/onClose) minus
// the parts that are fixed content here (id/label/children) — the scene
// only ever needs to decide WHERE this glints, never how it opens, closes,
// or what's inside. Content itself lives in rtcInvite.ts; this file is
// only the JSX assembly (Pocket + PocketCard), split out for the same
// reason mug.ts stays JSX-free — see that file's header.
//
// Formerly LukeClipPocket.tsx (the Luke "Guess we have to die." clip) —
// retired here per the 2026-08-30 controller ruling: that clip now lives
// only in Scene 6's alien-prank pocket (see AlienPrankPocket.tsx), so it
// never appears in two frames of the film. This pocket's content is the
// invitation to play the real game instead (see rtcInvite.ts).
import { forwardRef } from 'react';
import type { ScrollTimeline } from '../timeline/scrollTimeline';
import { Pocket, type PocketGlintAt, type PocketHandle } from './Pocket';
import { PocketCard } from './PocketCard';
import { RTC_INVITE_CONTENT } from './rtcInvite';

export interface RtcInvitePocketProps {
  glintAt: PocketGlintAt;
  timeline: ScrollTimeline | null;
  onOpen?: () => void;
  onClose?: () => void;
}

export const RtcInvitePocket = forwardRef<PocketHandle, RtcInvitePocketProps>(
  function RtcInvitePocket({ glintAt, timeline, onOpen, onClose }, ref) {
    return (
      <Pocket
        ref={ref}
        id="rtc-invite"
        glintAt={glintAt}
        label={RTC_INVITE_CONTENT.glintLabel}
        timeline={timeline}
        onOpen={onOpen}
        onClose={onClose}
      >
        <PocketCard
          title={RTC_INVITE_CONTENT.title}
          media={
            <img
              src={RTC_INVITE_CONTENT.imageSrc}
              alt={RTC_INVITE_CONTENT.imageAlt}
              loading="lazy"
            />
          }
          caption={RTC_INVITE_CONTENT.caption}
          linkHref={RTC_INVITE_CONTENT.linkHref}
          linkLabel={RTC_INVITE_CONTENT.linkLabel}
        />
      </Pocket>
    );
  },
);
