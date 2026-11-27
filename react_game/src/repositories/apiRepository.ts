// Online backend: the Express + MySQL REST API in ../backend.
import { ApiClient, ApiError } from '../lib/api.ts';
import type { ItemQuantities, ItemRow, PlaceContent, UserPlaceProgressRow, UserRow, WordBankRow } from '../types/db.ts';
import type { GameRepository, PlaceCard, PlayerSummary, SessionResultInput } from './types.ts';

interface AuthResponse { token: string; user: Omit<UserRow, 'password'> }

export class ApiRepository implements GameRepository {
  readonly mode = 'api' as const;
  private words: WordBankRow[] | null = null;
  private items: ItemRow[] | null = null;

  constructor(private api: ApiClient) {}

  // ---- auth (USERS) ----
  async login(email: string, password: string) {
    const r = await this.api.request<AuthResponse>('POST', '/users/login', { email, password });
    this.api.setToken(r.token);
  }

  async register(username: string, email: string, password: string) {
    const r = await this.api.request<AuthResponse>('POST', '/users/register', { username, email, password });
    this.api.setToken(r.token);
  }

  logout() {
    this.api.setToken(null);
  }

  async getPlayer(): Promise<PlayerSummary | null> {
    if (!this.api.signedIn) return null;
    try {
      const u = await this.api.request<Omit<UserRow, 'password'>>('GET', '/users/me');
      return { username: u.username, totalPlaytime: u.total_playtime, totalLocationsCompleted: u.total_locations_completed };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this.api.setToken(null); // expired or invalid → show sign-in
        return null;
      }
      throw e;
    }
  }

  // ---- content ----
  async listItems() {
    return (this.items ??= await this.api.request<ItemRow[]>('GET', '/game/items'));
  }

  async getWordBank() {
    return (this.words ??= await this.api.request<WordBankRow[]>('GET', '/game/words'));
  }

  getPlaceContent(placeId: number) {
    return this.api.request<PlaceContent>('GET', `/game/places/${placeId}`);
  }

  // ---- USER_PLACE_PROGRESS ----
  listPlaces() {
    return this.api.request<PlaceCard[]>('GET', '/game/places');
  }

  startPlaceSession(placeId: number) {
    return this.api.request<UserPlaceProgressRow>('POST', `/game/places/${placeId}/start`);
  }

  saveSessionResults(input: SessionResultInput) {
    return this.api.request<UserPlaceProgressRow>('POST', `/game/places/${input.placeId}/results`, {
      outcome: input.outcome,
      wpm: input.wpm,
      accuracy: input.accuracy,
      playtimeSeconds: Math.round(input.playtimeSeconds),
      collected: Object.entries(input.collected).map(([item_id, quantity]) => ({ item_id: Number(item_id), quantity })),
    });
  }

  // ---- USER_INVENTORY ----
  async getInventory(): Promise<ItemQuantities> {
    const rows = await this.api.request<{ item_id: number; quantity: number }[]>('GET', '/users/me/inventory');
    return Object.fromEntries(rows.map((r) => [r.item_id, r.quantity]));
  }
}
