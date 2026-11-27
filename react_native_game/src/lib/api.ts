// REST client for the Express backend (../backend). Same API as react_game/src/lib/api.ts.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { KeyValueStore } from './storage';

/**
 * Where the backend is. Override with EXPO_PUBLIC_API_URL in react_native_game/.env,
 * or play without a server with EXPO_PUBLIC_OFFLINE=true.
 *   Phone in Expo Go → the computer running `npx expo start` (from Expo's hostUri), port 3000
 *   Web              → the host serving the page, port 3000
 *   Fallback         → Android emulator 10.0.2.2, otherwise localhost
 */
function defaultApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3000/api`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  // In --tunnel mode the host is an exp.direct address that can't reach your backend.
  if (host && !host.endsWith('.exp.direct')) return `http://${host}:3000/api`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
}

const offline = process.env.EXPO_PUBLIC_OFFLINE === 'true';
const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

/** Base URL of the backend API, or null for offline play. */
export const apiBaseUrl: string | null = offline
  ? null
  : 'https://type-to-run-api.onrender.com/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TOKEN_KEY = 'type-to-run:token';

export class ApiClient {
  constructor(private baseUrl: string, private storage: KeyValueStore) {}

  get signedIn() {
    return this.storage.getItem(TOKEN_KEY) !== null;
  }

  setToken(token: string | null) {
    if (token) this.storage.setItem(TOKEN_KEY, token);
    else this.storage.removeItem(TOKEN_KEY);
  }

  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = this.storage.getItem(TOKEN_KEY);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, `Can't reach the game server at ${this.baseUrl}. Is the backend running, and is this device on the same Wi-Fi?`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
    return data as T;
  }
}
