import { supabase } from '../lib/supabase.ts';
import { LocalRepository } from './localRepository.ts';
import { SupabaseRepository } from './supabaseRepository.ts';
import type { GameRepository } from './types.ts';

/** Supabase when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set, offline otherwise. */
export function createRepository(): GameRepository {
  return supabase ? new SupabaseRepository(supabase) : new LocalRepository();
}

export type * from './types.ts';
