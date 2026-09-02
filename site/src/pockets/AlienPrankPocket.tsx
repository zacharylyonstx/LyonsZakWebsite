// THE WEIRD ONES's discovery pocket, fully assembled — WeirdScene.tsx drops
// this at the TV's own glint anchor:
//
//   <AlienPrankPocket ref={handle} glintAt={someAnchor} timeline={timeline} />
//
// Same shape as LukeClipPocket.tsx (glintAt/timeline/onOpen/onClose in,
// content fixed) — content itself lives in alienPrank.ts.
import { forwardRef } from 'react';
import type { ScrollTimeline } from '../timeline/scrollTimeline';
import { Pocket, type PocketGlintAt, type PocketHandle } from './Pocket';
import { PocketCard } from './PocketCard';
import { ALIEN_PRANK_CONTENT } from './alienPrank';

export interface AlienPrankPocketProps {
  glintAt: PocketGlintAt;
  timeline: ScrollTimeline | null;
  onOpen?: () => void;
  onClose?: () => void;
}

export const AlienPrankPocket = forwardRef<PocketHandle, AlienPrankPocketProps>(
  function AlienPrankPocket({ glintAt, timeline, onOpen, onClose }, ref) {
    return (
      <Pocket
        ref={ref}
        id="alien-prank"
        glintAt={glintAt}
        label={ALIEN_PRANK_CONTENT.glintLabel}
        timeline={timeline}
        onOpen={onOpen}
        onClose={onClose}
      >
        <PocketCard
          title={ALIEN_PRANK_CONTENT.title}
          media={
            <video
              src={ALIEN_PRANK_CONTENT.videoSrc}
              poster={ALIEN_PRANK_CONTENT.posterSrc}
              controls
              playsInline
              preload="metadata"
            >
              <track
                kind="captions"
                src={ALIEN_PRANK_CONTENT.captionsSrc}
                srcLang="en"
                label="English"
                default
              />
            </video>
          }
          caption={ALIEN_PRANK_CONTENT.caption}
        />
      </Pocket>
    );
  },
);
