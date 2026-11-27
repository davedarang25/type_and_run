// Thin REST client for the Express backend (../backend). Stores the login token in localStorage.

const env = import.meta.env;
const offline = env.MODE === 'demo' || env.VITE_OFFLINE === 'true';
const configured = (env.VITE_API_URL as string | undefined)?.trim();

/**
 * Base URL of the backend API, or null for offline play.
 * Default: port 3000 on the same host that serves the game, so
 * http://localhost:5173 → http://localhost:3000/api, and a phone on your Wi-Fi
 * opening http://192.168.1.20:5173 → http://192.168.1.20:3000/api.
 * Override with VITE_API_URL; set VITE_OFFLINE=true (or build:demo) to play without a server.
 */
export const apiBaseUrl: string | null = offline
  ? null
  : (configured || `${location.protocol}//${location.hostname}:3000/api`).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TOKEN_KEY = 'type-to-run:token';

export class ApiClient {
  private token: string | null;

  constructor(private baseUrl: string) {
    this.token = safeGet(TOKEN_KEY);
  }

  get signedIn() {
    return this.token !== null;
  }

  setToken(token: string | null) {
    this.token = token;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: token lives for this page only */
    }
  }

  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, `Can't reach the game server at ${this.baseUrl}. Is the backend running?`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
    return data as T;
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
