import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { getAdminClient } from '@/src/lib/supabase/admin'
import { DATABASE } from '@/src/config/database'

type PendingInvite = {
  id: string
  team_id: string
  permissions: Record<string, unknown> | null
  token: string
}

async function linkPendingInvitations(userId: string, userEmail: string | undefined) {
  if (!userEmail) return
  const email = userEmail.toLowerCase()

  const admin = getAdminClient()

  const { data: pendingInvites } = await admin
    .from(DATABASE.TABLES.WS_TEAM_INVITATIONS)
    .select('id, team_id, permissions, token')
    .eq('email', email)
    .eq('status', 'pending')

  const invites = (pendingInvites || []) as PendingInvite[]
  if (invites.length === 0) return

  for (const invite of invites) {
    const { data: existingMember } = await admin
      .from(DATABASE.TABLES.WS_TEAM_MEMBERS)
      .select('id')
      .eq('team_id', invite.team_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) continue

    const memberPayload = {
      team_id: invite.team_id,
      user_id: userId,
      role: 'member',
      permissions: invite.permissions ?? {},
    } as unknown as never

    await admin.from(DATABASE.TABLES.WS_TEAM_MEMBERS).insert(memberPayload)

    const invitationUpdatePayload = { status: 'accepted', accepted_by: userId } as unknown as never

    await admin
      .from(DATABASE.TABLES.WS_TEAM_INVITATIONS)
      .update(invitationUpdatePayload)
      .eq('id', invite.id)
  }
}

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
      const userEmail = userData.user?.email ?? undefined

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

        await linkPendingInvitations(userId, userEmail)
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
