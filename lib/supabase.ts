// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!url || !anonKey) {
  // Allow server side usage without envs during dev; runtime will use fallback to JSON data
  console.warn('Supabase env vars not set. Falling back to local JSON data where applicable.')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
})
