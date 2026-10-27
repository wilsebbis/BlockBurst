/** Zustand persistence backed by IndexedDB (idb-keyval), falling back to localStorage where IndexedDB is missing. */
import { del, get, set } from 'idb-keyval';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const hasIdb = typeof indexedDB !== 'undefined';

const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
};

const memory = new Map<string, string>();
const fallback: StateStorage = {
  getItem: (name) => (typeof localStorage !== 'undefined' ? localStorage.getItem(name) : (memory.get(name) ?? null)),
  setItem: (name, value) => (typeof localStorage !== 'undefined' ? localStorage.setItem(name, value) : void memory.set(name, value)),
  removeItem: (name) => (typeof localStorage !== 'undefined' ? localStorage.removeItem(name) : void memory.delete(name)),
};

export const persistStorage = createJSONStorage(() => (hasIdb ? idbStorage : fallback));
