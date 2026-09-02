// Owns the ambient bed's whole lifecycle (ship-pass item 1) — no visual
// output, mounted once in App.tsx. Starts/stops on the master toggle,
// ducks on tab blur/return (fades, never a hard cut), and disposes cleanly.
// The bed itself never autoplays: `start()` only ever runs from inside the
// toggle's own click (SoundToggle.tsx) or, on mount, when a PRIOR visit
// already left sound on (a real user gesture, just not this page load's —
// see ambientBed.ts's own resume-on-next-gesture fallback for the browser
// autoplay-policy edge this creates).
import { useEffect, useRef } from 'react';
import { createAmbientBed, type AmbientBed } from './ambientBed';
import { getSoundStore } from './soundStore';

export function AmbientBedController() {
  const bedRef = useRef<AmbientBed | null>(null);

  useEffect(() => {
    const bed = createAmbientBed();
    bedRef.current = bed;
    const store = getSoundStore();
    if (store.isEnabled()) bed.start();
    const unsubscribe = store.subscribe((enabled) => {
      if (enabled) bed.start();
      else bed.stop();
    });
    const onVisibility = () => bed.setDucked(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      bed.dispose();
      bedRef.current = null;
    };
  }, []);

  return null;
}
