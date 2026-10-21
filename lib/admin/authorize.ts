import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type AdminAuthorization =
  | { authorized: true; supabase: SupabaseClient<Database>; userId: string }
  | { authorized: false; response: NextResponse }

export async function requireAdmin(): Promise<AdminAuthorization> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Admin service is not configured.' }, { status: 503 }),
    }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    }
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unable to verify admin access.' }, { status: 500 }),
    }
  }
  if (!admin) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }),
    }
  }

  return { authorized: true, supabase, userId: user.id }
}

export function requireSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 })
  }
  return null
}
