// MANUALLY MANAGED — hardcoded to user's personal Supabase project (vlieoxikhjfnaosumvzi)
// Service role key is read from the MY_SUPABASE_SERVICE_ROLE_KEY secret at runtime.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://vlieoxikhjfnaosumvzi.supabase.co';

function createSupabaseAdminClient() {
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.MY_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing MY_SUPABASE_SERVICE_ROLE_KEY. Add it as a secret in your project.'
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// SECURITY: Only use this for trusted server-side operations, never expose to client code.
// Import like: import { supabaseAdmin } from "@/integrations/supabase/client.server";
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
