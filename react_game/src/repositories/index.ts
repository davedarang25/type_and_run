import { ApiClient, apiBaseUrl } from '../lib/api.ts';
import { ApiRepository } from './apiRepository.ts';
import { LocalRepository } from './localRepository.ts';
import type { GameRepository } from './types.ts';

/** The Express API by default; offline (localStorage) only with VITE_OFFLINE=true or the demo build. */
export function createRepository(): GameRepository {
  return apiBaseUrl ? new ApiRepository(new ApiClient(apiBaseUrl)) : new LocalRepository();
}

export type * from './types.ts';
