import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { DATABASE } from '@/src/config/database'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/dashboard'
  if (!next.startsWith('/')) {
    next = '/dashboard'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id ?? null

      if (userId) {
        const { data: profile } = await supabase
          .from(DATABASE.TABLES.PROFILES)
          .select('agency_name, city, country')
          .eq('id', userId)
          .maybeSingle<{ agency_name: string | null; city: string | null; country: string | null }>()

        const needsCompletion =
          !profile ||
          !String(profile.agency_name ?? '').trim() ||
          !String(profile.city ?? '').trim() ||
          !String(profile.country ?? '').trim()

        if (needsCompletion) {
          next = '/complete-profile'
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?code=auth_error`)
}
