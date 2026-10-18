import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !serviceRoleKey) {
  console.warn('Supabase service role key or URL not set. Server-side Supabase operations will fail until SUPABASE_SERVICE_ROLE_KEY is provided in the environment.')
}

export const supabaseAdmin = createClient(url, serviceRoleKey)
