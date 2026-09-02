import { describe, expect, it, vi } from 'vitest';
import {
  createSoundStore,
  parseSoundPersisted,
  serializeSoundEnabled,
  SOUND_STORAGE_KEY,
  type PersistedStorage,
} from './soundStore';

function fakeStorage(initial: Record<string, string> = {}): PersistedStorage {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('parseSoundPersisted / serializeSoundEnabled', () => {
  it('only the exact "1" marker reads as on', () => {
    expect(parseSoundPersisted('1')).toBe(true);
    expect(parseSoundPersisted('0')).toBe(false);
    expect(parseSoundPersisted(null)).toBe(false);
    expect(parseSoundPersisted('true')).toBe(false);
    expect(parseSoundPersisted('garbage')).toBe(false);
  });

  it('round-trips through serialize -> parse', () => {
    expect(parseSoundPersisted(serializeSoundEnabled(true))).toBe(true);
    expect(parseSoundPersisted(serializeSoundEnabled(false))).toBe(false);
  });
});

describe('createSoundStore — default OFF, no persistence', () => {
  it('starts disabled with storage=null', () => {
    expect(createSoundStore(null).isEnabled()).toBe(false);
  });

  it('setEnabled/toggle still work in-memory with no storage to throw on', () => {
    const store = createSoundStore(null);
    store.setEnabled(true);
    expect(store.isEnabled()).toBe(true);
    store.toggle();
    expect(store.isEnabled()).toBe(false);
  });
});

describe('createSoundStore — persistence', () => {
  it('reads the persisted value once, at construction', () => {
    const storage = fakeStorage({ [SOUND_STORAGE_KEY]: '1' });
    expect(createSoundStore(storage).isEnabled()).toBe(true);
  });

  it('an unrecognized persisted value starts OFF (never accidentally on)', () => {
    const storage = fakeStorage({ [SOUND_STORAGE_KEY]: 'nonsense' });
    expect(createSoundStore(storage).isEnabled()).toBe(false);
  });

  it('setEnabled writes the persisted marker', () => {
    const storage = fakeStorage();
    const store = createSoundStore(storage);
    store.setEnabled(true);
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe('1');
    store.setEnabled(false);
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe('0');
  });

  it('a storage that throws on every call never crashes construction or setEnabled', () => {
    const throwing: PersistedStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createSoundStore(throwing);
    expect(store.isEnabled()).toBe(false);
    expect(() => store.setEnabled(true)).not.toThrow();
    // The in-memory value still updates even though persistence failed.
    expect(store.isEnabled()).toBe(true);
  });
});

describe('createSoundStore — idempotency + subscriptions', () => {
  it('setEnabled to the same value is a no-op (no notification, no re-persist)', () => {
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const store = createSoundStore(storage);
    const cb = vi.fn();
    store.subscribe(cb);
    store.setEnabled(false); // already false
    expect(cb).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('notifies every subscriber exactly once per real change', () => {
    const store = createSoundStore(null);
    const cb = vi.fn();
    store.subscribe(cb);
    store.setEnabled(true);
    store.toggle();
    expect(cb).toHaveBeenNthCalledWith(1, true);
    expect(cb).toHaveBeenNthCalledWith(2, false);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops further notifications', () => {
    const store = createSoundStore(null);
    const cb = vi.fn();
    const unsubscribe = store.subscribe(cb);
    unsubscribe();
    store.setEnabled(true);
    expect(cb).not.toHaveBeenCalled();
  });
});
