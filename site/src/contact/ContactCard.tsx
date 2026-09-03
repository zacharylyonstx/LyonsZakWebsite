// The contact card (2026-09-03) — the professional headshot's home in the
// film. Opened from the fast lane's identity block (any point in the
// journey) or the end card's medallion; it is the film's one formal frame:
// the suit, the number, and a vCard that puts both in a phone's address
// book in one tap.
//
// Built on the pocket grammar (rule #2, stop + interact): opening holds the
// journey where it is, any scroll input closes it and travel resumes, focus
// is trapped while open and restored after. Same controller, same close
// signals, same focus-trap math as Pocket.tsx — this component only differs
// in what it shows and what opens it (no glint of its own).
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { ScrollTimeline } from '../timeline/scrollTimeline';
import {
  createPocketController,
  focusTrapAction,
  shouldCloseOnSignal,
} from '../pockets/pocketController';
import { getFocusable } from '../pockets/Pocket';
import { CONTACT, displayUrl, mailHref, smsHref, telHref } from './facts';

export interface ContactCardHandle {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export const ContactCard = forwardRef<
  ContactCardHandle,
  { timeline: ScrollTimeline | null }
>(function ContactCard({ timeline }, ref) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const controllerRef = useRef(
    createPocketController({
      hold: () => timelineRef.current?.hold(),
      release: () => timelineRef.current?.release(),
    }),
  );

  const openCard = useCallback(() => {
    if (controllerRef.current.isOpen()) return;
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    controllerRef.current.open();
    setOpen(true);
  }, []);

  const closeCard = useCallback(() => {
    if (!controllerRef.current.isOpen()) return;
    controllerRef.current.close();
    setOpen(false);
    lastFocusedRef.current?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: openCard,
      close: closeCard,
      isOpen: () => controllerRef.current.isOpen(),
    }),
    [openCard, closeCard],
  );

  // Close signals + focus trap — Pocket.tsx's listeners, verbatim in spirit:
  // never preventDefault on a scroll, only react to it.
  useEffect(() => {
    if (!open) return;
    const onWheel = () => {
      if (shouldCloseOnSignal({ kind: 'wheel' })) closeCard();
    };
    const onTouchMove = () => {
      if (shouldCloseOnSignal({ kind: 'touchmove' })) closeCard();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldCloseOnSignal({ kind: 'key', key: e.key })) {
        closeCard();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = getFocusable(dialogRef.current);
        if (focusables.length === 0) return;
        const active = document.activeElement;
        const action = focusTrapAction(
          active === focusables[0],
          active === focusables[focusables.length - 1],
          e.shiftKey,
        );
        if (action) {
          e.preventDefault();
          (action === 'first' ? focusables[0] : focusables[focusables.length - 1]).focus();
        }
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeCard]);

  useEffect(() => {
    if (!open) return;
    // Focus lands on the card itself (not the close button) so a screen
    // reader announces the name first; Tab reaches the rows in order.
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pocket-overlay contact-overlay"
      onClick={() => {
        if (shouldCloseOnSignal({ kind: 'backdrop' })) closeCard();
      }}
    >
      <div
        ref={dialogRef}
        id="contact-card-dialog"
        className="contact-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-card-name"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="pocket-close"
          aria-label="Close"
          onClick={() => {
            if (shouldCloseOnSignal({ kind: 'button' })) closeCard();
          }}
        >
          ×
        </button>

        <div className="contact-card-photo">
          <picture>
            <source srcSet={CONTACT.headshotWebp} type="image/webp" />
            <img
              src={CONTACT.headshot}
              width={900}
              height={1200}
              alt={CONTACT.headshotAlt}
              decoding="async"
            />
          </picture>
        </div>

        <div className="contact-card-body">
          <p className="contact-card-eyebrow">Contact card</p>
          <h2 id="contact-card-name" className="contact-card-name">
            {CONTACT.name}
          </h2>
          <p className="contact-card-role">
            {CONTACT.role} <span aria-hidden="true">·</span> {CONTACT.place}
          </p>
          <p className="contact-card-line">
            Full-stack — Django/Python, React/TypeScript. Seven-plus years
            shipping products end to end. Austin area, remote-friendly.{' '}
            {CONTACT.legalName} on the paperwork.
          </p>

          <dl className="contact-card-rows">
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={telHref()}>{CONTACT.phoneDisplay}</a>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={mailHref()}>{CONTACT.email}</a>
              </dd>
            </div>
            <div>
              <dt>GitHub</dt>
              <dd>
                <a href={CONTACT.github} target="_blank" rel="noopener noreferrer">
                  {displayUrl(CONTACT.github)}
                </a>
              </dd>
            </div>
            <div>
              <dt>LinkedIn</dt>
              <dd>
                <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
                  {displayUrl(CONTACT.linkedin)}
                </a>
              </dd>
            </div>
          </dl>

          <div className="contact-card-actions">
            <a className="contact-action contact-action-primary" href={CONTACT.vcard}>
              Save contact
            </a>
            <a className="contact-action" href={smsHref()}>
              Text me
            </a>
            <a className="contact-action" href={CONTACT.resume}>
              Résumé (PDF)
            </a>
          </div>

          <p className="contact-card-foot">
            <a href="/contact">Full contact page &rarr;</a>
          </p>
        </div>
      </div>
    </div>
  );
});
