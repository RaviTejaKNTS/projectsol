
/* src/lib/supabaseClient.ts */
import { createClient } from '@supabase/supabase-js'

// Extend ImportMeta interface for Vite env variables
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_SUPABASE_URL: string
      readonly VITE_SUPABASE_ANON_KEY: string
    }
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
  console.error('Please check your .env file or environment configuration')
  console.error('Current values:', { supabaseUrl, supabaseAnonKey })
  throw new Error('Supabase configuration is missing. Please check your environment variables.')
}

console.log('Supabase client initialized successfully')

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
