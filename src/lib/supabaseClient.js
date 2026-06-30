import { createClient } from '@supabase/supabase-js';

// These come from Vite env vars (see .env.example). The anon key is safe to
// expose in the browser — access is controlled by Row Level Security.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True once both env vars are present. Until then the app falls back to
// localStorage so nothing breaks before the backend is wired up.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
