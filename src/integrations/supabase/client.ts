// MANUALLY MANAGED — hardcoded to user's personal Supabase project (vlieoxikhjfnaosumvzi)
// Do NOT regenerate from Lovable Cloud env vars.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://vlieoxikhjfnaosumvzi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWVveGlraGpmbmFvc3VtdnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzM0NzIsImV4cCI6MjA5MjcwOTQ3Mn0.K5pvUku-AjxsipqWaPfkbtmUnSD5NmeKu6VrB7hau5w';

function createSupabaseClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import like: import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
