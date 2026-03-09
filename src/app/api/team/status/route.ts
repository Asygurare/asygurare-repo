import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { parsePermissions, FULL_PERMISSIONS } from "@/src/services/team/permissions"

export const runtime = "edge"

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: ownedTeam } = await supabase
    .from(DATABASE.TABLES.WS_TEAMS)
    .select("id, name, created_at")
    .eq("owner_id", user.id)
    .maybeSingle<{ id: string; name: string; created_at: string }>()

  if (ownedTeam) {
    const admin = getAdminClient()

    const { data: members } = await admin
      .from(DATABASE.TABLES.WS_TEAM_MEMBERS)
      .select("id, user_id, role, permissions, joined_at")
      .eq("team_id", ownedTeam.id)

    type TeamMemberRow = {
      id: string
      user_id: string
      role: string
      permissions: unknown
      joined_at: string | null
    }
    type ProfileRow = { id: string; first_name: string | null; last_name: string | null }
    type InvitationRow = {
      id: string
      email: string
      permissions: unknown
      status: string
      expires_at: string | null
      created_at: string
    }

    const typedMembers = (members || []) as TeamMemberRow[]
    const memberUserIds = typedMembers.map((m) => m.user_id).filter(Boolean)
    const profilesByUserId = new Map<string, { first_name: string | null; last_name: string | null }>()
    if (memberUserIds.length > 0) {
      const { data: profiles } = await admin
        .from(DATABASE.TABLES.PROFILES)
        .select("id, first_name, last_name")
        .in("id", memberUserIds)
      for (const p of (profiles || []) as ProfileRow[]) {
        profilesByUserId.set(p.id, { first_name: p.first_name, last_name: p.last_name })
      }
    }

    const enrichedMembers = typedMembers.map((m) => {
      const profile = profilesByUserId.get(m.user_id)
      return {
        ...m,
        permissions: parsePermissions(m.permissions),
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
      }
    })

    const { data: invitations } = await admin
      .from(DATABASE.TABLES.WS_TEAM_INVITATIONS)
      .select("id, email, permissions, status, expires_at, created_at")
      .eq("team_id", ownedTeam.id)
      .eq("status", "pending")

    return NextResponse.json({
      role: "owner",
      team: ownedTeam,
      members: enrichedMembers,
      invitations: ((invitations || []) as InvitationRow[]).map((inv) => ({
        ...inv,
        permissions: parsePermissions(inv.permissions),
      })),
      permissions: FULL_PERMISSIONS,
    }, { status: 200, headers: { "Cache-Control": "no-store" } })
  }

  const { data: membership } = await supabase
    .from(DATABASE.TABLES.WS_TEAM_MEMBERS)
    .select("id, team_id, role, permissions")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; team_id: string; role: string; permissions: unknown }>()

  if (membership) {
    const admin = getAdminClient()
    const { data: team } = await admin
      .from(DATABASE.TABLES.WS_TEAMS)
      .select("id, name")
      .eq("id", membership.team_id)
      .maybeSingle()

    return NextResponse.json({
      role: "member",
      team: team ?? null,
      members: [],
      invitations: [],
      permissions: parsePermissions(membership.permissions),
    }, { status: 200, headers: { "Cache-Control": "no-store" } })
  }

  return NextResponse.json({
    role: "owner",
    team: null,
    members: [],
    invitations: [],
    permissions: FULL_PERMISSIONS,
  }, { status: 200, headers: { "Cache-Control": "no-store" } })
}
