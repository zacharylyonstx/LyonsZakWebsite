// The film's viewport — one answer to "how tall is the frame?" for every
// scene, and the phone-specific tuning the scroll film needs.
//
// WHY THIS EXISTS (the mobile scroll pass, 2026-09-03). On phones the
// browser's toolbar collapses and expands as you scroll, and every time it
// does, `window.innerHeight` changes by ~80-100px. Before this module the
// film read innerHeight in two places that mattered:
//
//   1. the scroll timeline's target = scrollY / (scrollHeight − innerHeight)
//      — so the toolbar toggling MOVED THE FILM (~85px of travel from
//      nothing), a lurch the damped follower then chased;
//   2. every fixed `inset: 0` layer, including the three WebGL canvases,
//      resized with it — a drawing-buffer reallocation per toggle, right in
//      the middle of a scroll. That's a dropped-frames hitch by design.
//
// The fix is one idea: the film lives in the LARGE viewport (CSS `100lvh`,
// what the frame is when the toolbar is collapsed) and never re-sizes as
// the toolbar moves. A probe element sized `100lvh` is measured on resize;
// `filmHeight()` is what every scene's projection math reads instead of
// innerHeight, so the DOM labels and the canvases agree by construction.
// On desktop the large viewport IS innerHeight — nothing changes there.
//
// Also here: the touch-specific tuning (tighter damping, a lower pixel-
// ratio cap) as pure functions, tested in filmViewport.test.ts.

/** Critically damped follower stiffness (per second). The wheel's cinematic
 *  glide stays as tuned; a finger on glass wants the picture closer to the
 *  finger — 9/s lags a flick by ~220ms and settles in ~0.6s, instead of
 *  ~400ms and ~1s. Still damped: frames stay smooth in both directions. */
export const DAMPING_POINTER_FINE = 5;
export const DAMPING_POINTER_COARSE = 9;

/** Renderer pixel-ratio caps. Phones ship DPR 3 and a GPU that is not a
 *  desktop's; 1.5 on a 390px-wide screen is 585px of texture across — the
 *  photographs are 2048 wide, the depth meshes are resolution-independent,
 *  and the frame rate is what a visitor actually feels. */
export const DPR_MAX_POINTER_FINE = 2;
export const DPR_MAX_POINTER_COARSE = 1.5;

export function dampingFor(coarsePointer: boolean): number {
  return coarsePointer ? DAMPING_POINTER_COARSE : DAMPING_POINTER_FINE;
}

export function dprMaxFor(coarsePointer: boolean): number {
  return coarsePointer ? DPR_MAX_POINTER_COARSE : DPR_MAX_POINTER_FINE;
}

/** True on devices whose primary pointer is a finger (phones, tablets). */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

// ---- The large-viewport probe ------------------------------------------------

let probe: HTMLElement | null = null;
let cachedHeight = 0;

function ensureProbe(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (probe && probe.isConnected) return probe;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-film-viewport-probe', '');
  // 100vh first (every browser), 100lvh where supported — on iOS/Android
  // 100vh already means the large viewport, so the pair is belt and braces.
  el.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;' +
    'visibility:hidden;pointer-events:none;z-index:-1;';
  document.body.appendChild(el);
  probe = el;
  return el;
}

function measure(): number {
  const el = ensureProbe();
  const h = el ? el.offsetHeight : 0;
  // A probe that hasn't laid out yet (0) falls back to innerHeight — the
  // large viewport is never smaller than the current one.
  cachedHeight = Math.max(h, typeof window !== 'undefined' ? window.innerHeight : 0);
  return cachedHeight;
}

if (typeof window !== 'undefined') {
  // Registered at module load — before any scene mounts its own resize
  // listener — so a scene's handler always reads a fresh value.
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
}

/** The film frame's height in CSS px: the large viewport (see header). */
export function filmHeight(): number {
  if (cachedHeight > 0) return cachedHeight;
  return measure();
}

/** The film frame's width. Widths don't move with toolbars; this exists so
 *  scenes read both dimensions from one place. */
export function filmWidth(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 0;
}

/** Test seam. */
export function _resetFilmViewportForTest(): void {
  probe = null;
  cachedHeight = 0;
}
