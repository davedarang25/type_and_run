// Device storage for the login token and the offline save.
// AsyncStorage is async-only, but the game reads these synchronously, so the keys are
// loaded into memory once at startup (initStorage) and every write goes to both.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = ['type-to-run:save:v1', 'type-to-run:token'];

const cache = new Map<string, string>();

/** Call once before the game starts (App.tsx). */
export async function initStorage(): Promise<void> {
  try {
    const pairs = await AsyncStorage.multiGet(STORAGE_KEYS);
    for (const [key, value] of pairs) if (value != null) cache.set(key, value);
  } catch {
    /* storage unavailable: play with in-memory data */
  }
}

export const deviceStorage: KeyValueStore = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => {
    cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(() => {});
  },
  removeItem: (key) => {
    cache.delete(key);
    AsyncStorage.removeItem(key).catch(() => {});
  },
};
