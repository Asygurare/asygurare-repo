import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { parsePermissions } from "@/src/services/team/permissions"
import { randomBase64UrlString } from "@/src/lib/utils/pkce"

export const runtime = "edge"

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || "").trim().toLowerCase()
  const permissions = parsePermissions(body.permissions)

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Email inválido" }, { status: 400 })
  }

  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "No puedes invitarte a ti mismo" }, { status: 400 })
  }

  let team: { id: string } | null = null
  const { data: existingTeam } = await supabase
    .from(DATABASE.TABLES.WS_TEAMS)
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle<{ id: string }>()

  if (existingTeam) {
    team = existingTeam
  } else {
    const { data: profile } = await supabase
      .from(DATABASE.TABLES.PROFILES)
      .select("agency_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle<{ agency_name: string | null; first_name: string | null; last_name: string | null }>()

    const teamName = profile?.agency_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Mi equipo"

    const { data: newTeam, error: createErr } = await supabase
      .from(DATABASE.TABLES.WS_TEAMS)
      .insert({ owner_id: user.id, name: teamName })
      .select("id")
      .single<{ id: string }>()

    if (createErr || !newTeam) {
      return NextResponse.json({ ok: false, error: createErr?.message || "No se pudo crear el equipo" }, { status: 500 })
    }
    team = newTeam
  }

  const admin = getAdminClient()

  const { data: existingInvite } = await admin
    .from(DATABASE.TABLES.WS_TEAM_INVITATIONS)
    .select("id")
    .eq("team_id", team.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle<{ id: string }>()

  if (existingInvite) {
    return NextResponse.json({ ok: false, error: "Ya existe una invitación pendiente para este email" }, { status: 409 })
  }

  const token = randomBase64UrlString(32)

  const { error: inviteErr } = await (admin.from(DATABASE.TABLES.WS_TEAM_INVITATIONS) as any)
    .insert({
      team_id: team.id,
      email,
      permissions,
      token,
      status: "pending",
      invited_by: user.id,
    })

  if (inviteErr) {
    return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const redirectTo = `${origin}/api/auth/callback?next=/dashboard`

  const { error: authInviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      invited_to_team: team.id,
      invitation_token: token,
    },
  })

  if (authInviteErr) {
    if (authInviteErr.message?.includes("already been registered") || authInviteErr.message?.includes("already registered")) {
      return NextResponse.json({ ok: true, note: "El usuario ya tiene cuenta. La invitación queda pendiente y se vinculará al iniciar sesión." })
    }
    await (admin.from(DATABASE.TABLES.WS_TEAM_INVITATIONS) as any)
      .delete()
      .eq("token", token)
    return NextResponse.json({ ok: false, error: "No se pudo enviar la invitación: " + authInviteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
