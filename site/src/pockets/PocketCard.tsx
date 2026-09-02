// Shared presentational shell for a pocket's opened content — every pocket
// (the desk's mug, the arrival segment's Luke clip, and whatever comes
// later) is fundamentally "a title that names what a stranger is looking
// at, the media itself, one voice line, and an optional link out." Kept as
// one small component so that shape — and its styling — stays consistent
// sitewide, the same reasoning as Pocket.tsx's single shared glint.
import type { ReactNode } from 'react';

export interface PocketCardProps {
  /** Plain-language label for what this is — the zero-context-visitor
   *  self-introduction (project-map.md's standing law: "every part of the
   *  site is designed for someone who knows nothing about Zak"). */
  title: string;
  /** The pocket's own media — an <img>, a <video>, or a placeholder block. */
  media: ReactNode;
  /** The one voice line (ILLUSTRATIVE until it's Zak's real words — see
   *  each content module for its own marker/citation). */
  caption: string;
  linkHref?: string;
  linkLabel?: string;
}

export function PocketCard({
  title,
  media,
  caption,
  linkHref,
  linkLabel,
}: PocketCardProps) {
  return (
    <>
      <h2 className="pocket-title">{title}</h2>
      <div className="pocket-media">{media}</div>
      <p className="pocket-caption">{caption}</p>
      {linkHref && (
        <a
          className="pocket-link"
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkLabel ?? linkHref}
        </a>
      )}
    </>
  );
}

/** An embedded player as a pocket's media — a YouTube or Spotify iframe.
 *  Loaded ONLY while the pocket is open (the pocket unmounts its children
 *  on close), so the scroll film never carries a third-party frame; the
 *  film's determinism sweeps never see one either. `title` is the iframe's
 *  accessible name. */
export function PocketEmbed({
  src,
  title,
  kind,
}: {
  src: string;
  title: string;
  kind: 'video' | 'spotify';
}) {
  return (
    <div className={`pocket-embed pocket-embed--${kind}`}>
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

/** The mug's placeholder media block — visually distinct from a real photo
 *  on purpose (dashed border, explicit text) so it can never be mistaken
 *  for shipped content; see mug.ts's header comment and
 *  docs/production-requests.md#mug-photo. */
export function PocketPlaceholderMedia({ alt }: { alt: string }) {
  return (
    <div className="pocket-media-placeholder" role="img" aria-label={alt}>
      photo pending
    </div>
  );
}
