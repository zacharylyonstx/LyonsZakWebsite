// The sound layer's master toggle (ship-pass item 1) — default OFF,
// persisted choice, never autoplays anything before the toggle is on. Pure
// store + persistence logic here, unit-tested via an injectable storage
// seam (the scrollTimeline.ts precedent: real browser wiring stays
// swappable for a test double); SoundToggle.tsx and AmbientBedController.tsx
// are the only places that talk to the real window/localStorage.

export const SOUND_STORAGE_KEY = 'lyonszak.sound';

/** Minimal Storage surface this module needs — real localStorage in the
 *  browser, or a plain object double in tests. */
export interface PersistedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Anything other than the exact persisted "on" marker reads as off — a
 *  corrupted/foreign value in the key never accidentally turns sound on. */
export function parseSoundPersisted(raw: string | null): boolean {
  return raw === '1';
}

export function serializeSoundEnabled(enabled: boolean): string {
  return enabled ? '1' : '0';
}

export interface SoundStore {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  toggle(): void;
  /** Returns an unsubscribe function — the ScrollTimeline.onFrame shape
   *  used everywhere else in this codebase. */
  subscribe(cb: (enabled: boolean) => void): () => void;
}

/**
 * `storage=null` (SSR, tests with no persistence) always starts OFF and
 * never persists — the documented default. The persisted value is read
 * once, at construction (ScrollTimeline's own "start settled at wherever it
 * already is" rule — no flash of the wrong state after a reload).
 */
export function createSoundStore(storage: PersistedStorage | null): SoundStore {
  let enabled = false;
  if (storage) {
    try {
      enabled = parseSoundPersisted(storage.getItem(SOUND_STORAGE_KEY));
    } catch {
      enabled = false;
    }
  }
  const subscribers = new Set<(enabled: boolean) => void>();

  function persist(): void {
    if (!storage) return;
    try {
      storage.setItem(SOUND_STORAGE_KEY, serializeSoundEnabled(enabled));
    } catch {
      // Best-effort only (private mode / storage disabled) — the brief's
      // own "wrapped in try/catch" law. The in-memory toggle still works
      // for the rest of this visit even when persistence itself fails.
    }
  }

  const store: SoundStore = {
    isEnabled: () => enabled,
    setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      persist();
      for (const cb of subscribers) cb(enabled);
    },
    toggle() {
      store.setEnabled(!enabled);
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
  return store;
}

let singleton: SoundStore | null = null;

/** Accessing `window.localStorage` can itself throw (some locked-down /
 *  private-mode browser configurations reject the property access, not
 *  just get/setItem) — guarded the same way App.tsx guards its own
 *  sessionStorage use for journey-position restoration. */
function safeLocalStorage(): PersistedStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The real, browser-backed singleton every component shares — created
 *  lazily (not at module load) so importing this module has zero side
 *  effects under vitest's plain `node` environment (no `window` there at
 *  all). */
export function getSoundStore(): SoundStore {
  if (!singleton) {
    singleton = createSoundStore(typeof window === 'undefined' ? null : safeLocalStorage());
  }
  return singleton;
}
