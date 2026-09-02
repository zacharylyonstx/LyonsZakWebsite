// The end card's postscript reveal (ship-pass item 2c) — pure threshold
// logic, split out so it's unit-testable without mounting KeeperEndCard's
// real DOM (the pocketController.ts / recordPlayer.ts precedent: the
// decision is a plain function, the component only wires it to a click
// count in React state).

/** After this many clicks anywhere on the end card, the postscript reveals
 *  — and stays revealed (monotonic: clicks only ever increase within one
 *  page visit, so once true this can never flip back to false). */
export const POSTSCRIPT_CLICK_THRESHOLD = 3;

export function shouldRevealPostscript(clicks: number): boolean {
  return clicks >= POSTSCRIPT_CLICK_THRESHOLD;
}
