// The ship-pass sound layer's master control (item 1) — a quiet mono label
// in the fast lane, styled like every other point of light in the film
// (record-affordance, pocket-glint's own restraint), never a nagging
// modal or a first-visit prompt. Default OFF; the persisted choice lives in
// soundStore.ts. A real <button> — keyboard-reachable for free, no extra
// wiring needed.
import { useEffect, useState } from 'react';
import { getSoundStore } from './soundStore';

export function SoundToggle() {
  const [enabled, setEnabledState] = useState(() => getSoundStore().isEnabled());

  useEffect(() => getSoundStore().subscribe(setEnabledState), []);

  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={enabled}
      aria-describedby="sound-toggle-desc"
      onClick={() => getSoundStore().toggle()}
    >
      {/* The accessible name comes from this VISIBLE text (no aria-label
          override) — a Lighthouse a11y audit correctly flags a mismatch
          between visible label content and the accessible name (voice-
          control visitors say what they see). The fuller explanation rides
          as a description instead (aria-describedby), announced after the
          name/role/state, never replacing them. */}
      <span className="sound-toggle-label">Sound</span>
      <span className="sound-toggle-state">{enabled ? 'On' : 'Off'}</span>
      <span id="sound-toggle-desc" className="sr-only">
        {enabled
          ? 'Ambient sound and the film’s hidden sounds are on.'
          : 'Turns on a quiet ambient bed and the film’s hidden sounds.'}
      </span>
    </button>
  );
}
