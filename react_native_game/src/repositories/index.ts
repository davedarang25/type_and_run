import { ApiClient, apiBaseUrl } from '../lib/api';
import { deviceStorage } from '../lib/storage';
import { ApiRepository } from './apiRepository';
import { LocalRepository } from './localRepository';
import type { GameRepository } from './types';

/** The Express API by default; offline (on-device save) only with EXPO_PUBLIC_OFFLINE=true. */
export function createRepository(): GameRepository {
  return apiBaseUrl ? new ApiRepository(new ApiClient(apiBaseUrl, deviceStorage)) : new LocalRepository(deviceStorage);
}

export type * from './types';
