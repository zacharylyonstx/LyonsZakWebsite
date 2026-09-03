// The Level-2 grammar's shared shell — "stop + interact = optional depth"
// (docs/project-map.md's Experience Grammar #2). ONE component every pocket
// in the site mounts (the mug here, the Luke clip once Task 7 wires the
// arrival segment): a single glint affordance, a click/tap-opened overlay,
// and the close-and-resume behavior grammar rule #2 requires — any scroll
// input while open closes it and lets the journey continue from exactly
// where it was held.
//
// Split, same as scrollTimeline.ts/App.tsx and deskChoreography.ts/
// DeskScene.tsx: pocketController.ts holds every decision as a pure,
// DOM-free function (unit-tested in pocket.test.ts); this file is only the
// wiring — real DOM listeners, React state, the ScrollTimeline, and the
// focus trap walking real elements.
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ScrollTimeline } from '../timeline/scrollTimeline';
import {
  createPocketController,
  focusTrapAction,
  isActivationKey,
  shouldCloseOnSignal,
} from './pocketController';

/** Screen-space position for the glint, as fractions of the viewport (0..1,
 *  origin top-left) — see each content module (mug.ts, rtcInvite.ts) for how
 *  its own coordinates were measured, the same "document the coordinates"
 *  discipline makeMonitorQuad.ts/deskChoreography.ts use for the monitor
 *  quad's corners. */
export interface PocketGlintAt {
  x: number;
  y: number;
}

/** Imperative handle: lets a scene drive the glint's visibility from an
 *  existing per-frame loop (DeskRig/DeskSceneDom already write annotation
 *  opacity straight to a DOM ref every frame rather than through React
 *  state — see DeskScene.tsx — so the glint follows the same zero-re-render
 *  discipline instead of forcing a re-render per frame of its own). Opacity
 *  defaults to 1 (always visible) for callers that don't need a fade
 *  envelope. */
export interface PocketHandle {
  setGlintOpacity(opacity: number): void;
  /** Move the glint (frame fractions, 0..1) — for pockets whose anchor
   *  rides a moving camera (THE BAND's gig frame projects its drum-kit
   *  point every frame; a static `glintAt` would drift off the kit). */
  setGlintPosition(x: number, y: number): void;
  /** Open the pocket from an external control (a labeled pill button)
   *  instead of the glint — the same hold/focus/close grammar applies. */
  open(): void;
  /** Whether the pocket is currently open. */
  isOpen(): boolean;
}

export interface PocketProps {
  /** Unique id, used to build stable DOM ids for the glint/dialog (handy
   *  for QA automation and per-pocket CSS, if ever needed). */
  id: string;
  /** Where the glint sits, in viewport fractions. */
  glintAt: PocketGlintAt;
  /** Accessible name for the glint control, e.g. "Look closer at the mug". */
  label: string;
  /** The journey timeline to hold()/release() — null before it's mounted
   *  (App.tsx's timeline starts null for one frame; see App.tsx), in which
   *  case the pocket still opens/closes, it just has nothing to freeze. */
  timeline: ScrollTimeline | null;
  onOpen?: () => void;
  onClose?: () => void;
  /** The pocket's own content, rendered only while open. */
  children: ReactNode;
}

/** Elements the focus trap cycles between — the same practical selector
 *  every accessible-dialog implementation converges on. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export const Pocket = forwardRef<PocketHandle, PocketProps>(function Pocket(
  { id, glintAt, label, timeline, onOpen, onClose, children },
  ref,
) {
  const [open, setOpen] = useState(false);
  const glintRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // The controller instance is stable for the component's lifetime — its
  // hold/release/onOpen/onClose deps are read fresh each render via refs so
  // callers can pass fresh closures every render without recreating it.
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const controllerRef = useRef(
    createPocketController({
      hold: () => timelineRef.current?.hold(),
      release: () => timelineRef.current?.release(),
      onOpen: () => onOpenRef.current?.(),
      onClose: () => onCloseRef.current?.(),
    }),
  );

  // Refs the imperative handle reads through (the handle is created once —
  // empty deps — so it must never close over a stale `open` or callback).
  const openRef = useRef<() => void>(() => {});
  const openStateRef = useRef(false);
  openStateRef.current = open;

  useImperativeHandle(
    ref,
    () => ({
      setGlintOpacity(opacity: number) {
        const el = glintRef.current;
        if (!el) return;
        el.style.opacity = String(opacity);
        // Below the threshold: not just invisible but genuinely inert — an
        // ignored pocket must cost nothing, including "an invisible click
        // target intercepting the pointer" (brief: "ignoring costs
        // nothing"). Also pulled out of tab order so a barely-visible glint
        // never eats a Tab stop before it has faded meaningfully in.
        const inert = opacity <= 0.05;
        el.style.pointerEvents = inert ? 'none' : 'auto';
        el.tabIndex = inert ? -1 : 0;
        el.setAttribute('aria-hidden', inert ? 'true' : 'false');
      },
      setGlintPosition(x: number, y: number) {
        const el = glintRef.current;
        if (!el) return;
        el.style.left = `${(x * 100).toFixed(3)}%`;
        el.style.top = `${(y * 100).toFixed(3)}%`;
      },
      open() {
        if (!openStateRef.current) openRef.current();
      },
      isOpen() {
        return openStateRef.current;
      },
    }),
    [],
  );

  // React state mirrors the controller purely for rendering (whether the
  // overlay is in the DOM at all) — the controller itself stays the single
  // source of truth for hold/release and onOpen/onClose idempotency, so
  // calling either of these twice in a row is always safe.
  const openAndRender = useCallback(() => {
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    controllerRef.current.open();
    setOpen(true);
  }, []);
  openRef.current = openAndRender;

  const closeAndRender = useCallback(() => {
    controllerRef.current.close();
    setOpen(false);
    // Focus restoration (brief: "focus returns on close"). Falls back to
    // the glint itself if whatever was focused before is gone (e.g. it was
    // removed from the DOM while the pocket was open).
    const target = lastFocusedRef.current ?? glintRef.current;
    target?.focus();
  }, []);

  // Grammar rule #2: ANY scroll input while open closes it, and — critical
  // per the brief — we do NOT preventDefault or intercept the event itself;
  // the native scroll (or Tab/Escape) just proceeds as it already would,
  // we only react to it. This is also why hold() never needs to lock body
  // scroll: nothing here ever stops the browser from scrolling.
  useEffect(() => {
    if (!open) return;
    const onWheel = () => {
      if (shouldCloseOnSignal({ kind: 'wheel' })) closeAndRender();
    };
    const onTouchMove = () => {
      if (shouldCloseOnSignal({ kind: 'touchmove' })) closeAndRender();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldCloseOnSignal({ kind: 'key', key: e.key })) {
        closeAndRender();
        return;
      }
      // Focus trap: only the two wrap-around edges need help — everything
      // else is the browser's own Tab order (see focusTrapAction's doc
      // comment).
      if (e.key === 'Tab') {
        const focusables = getFocusable(dialogRef.current);
        if (focusables.length === 0) return;
        const active = document.activeElement;
        const isFirst = active === focusables[0];
        const isLast = active === focusables[focusables.length - 1];
        const action = focusTrapAction(isFirst, isLast, e.shiftKey);
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
  }, [open, closeAndRender]);

  // Move focus into the dialog the moment it mounts (brief: "focus trap
  // while open") — the close button, so Escape/Tab/scroll are all reachable
  // immediately without an extra Tab press.
  useEffect(() => {
    if (!open) return;
    const focusables = getFocusable(dialogRef.current);
    (focusables[0] ?? dialogRef.current)?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={glintRef}
        id={`pocket-${id}-glint`}
        type="button"
        className="pocket-glint"
        style={{ left: `${glintAt.x * 100}%`, top: `${glintAt.y * 100}%` }}
        tabIndex={-1}
        aria-hidden="true"
        aria-label={label}
        onClick={openAndRender}
        onKeyDown={(e) => {
          if (isActivationKey(e.key)) {
            e.preventDefault();
            openAndRender();
          }
        }}
      />
      {open && (
        <div
          className="pocket-overlay"
          onClick={() => {
            if (shouldCloseOnSignal({ kind: 'backdrop' })) closeAndRender();
          }}
        >
          <div
            ref={dialogRef}
            id={`pocket-${id}-dialog`}
            className="pocket-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pocket-close"
              aria-label="Close"
              onClick={() => {
                if (shouldCloseOnSignal({ kind: 'button' })) closeAndRender();
              }}
            >
              ×
            </button>
            <div className="pocket-dialog-content">{children}</div>
          </div>
        </div>
      )}
    </>
  );
});
