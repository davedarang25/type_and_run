import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null in offline mode (no env vars, or the single-file demo build). */
export const supabase: SupabaseClient | null =
  url && key && import.meta.env.MODE !== 'demo' ? createClient(url, key) : null;
