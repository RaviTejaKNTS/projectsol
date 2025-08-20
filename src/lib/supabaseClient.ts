/* src/lib/supabaseClient.ts */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
// import type { Database } from '../types/supabase' // if you generated types

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DEV } = import.meta.env

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  // Do not log secrets. Keep message generic.
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// Preserve a single client between HMR reloads in dev
const globalForSupabase = globalThis as unknown as { supabase?: SupabaseClient /*<Database>*/ }

export const supabase =
  globalForSupabase.supabase ??
  createClient/*<Database>*/(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // keep true if using OAuth redirects
      storage: window.localStorage,
      storageKey: 'sb-pulsar-auth', // avoid collisions across apps
    },
    // global: { headers: { 'x-client-info': 'pulsar-web@1.0.0' } }, // optional trace
  })

if (DEV) {
  globalForSupabase.supabase = supabase
  console.info('[supabase] client initialized')
}
