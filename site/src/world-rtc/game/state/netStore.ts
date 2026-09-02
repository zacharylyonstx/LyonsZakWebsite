// STUB for the a2-crossing sandbox (replaces ~/Game src/state/netStore.ts).
// The crossing experiment renders a static world with no multiplayer; only
// `myCharacterId` is ever read (systems/distance.ts, props/Cat, props/Basketball).
import { create } from 'zustand';
import type { CharacterId } from '../types';

interface NetStoreStub {
  myCharacterId: CharacterId | null;
}

export const useNetStore = create<NetStoreStub>(() => ({
  myCharacterId: null,
}));
