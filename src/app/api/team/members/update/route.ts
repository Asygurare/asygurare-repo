import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"
import { parsePermissions } from "@/src/services/team/permissions"

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
  const memberId = String(body.member_id || "").trim()
  const permissions = parsePermissions(body.permissions)

  if (!memberId) {
    return NextResponse.json({ ok: false, error: "member_id requerido" }, { status: 400 })
  }

  const { data: team } = await supabase
    .from(DATABASE.TABLES.WS_TEAMS)
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle<{ id: string }>()

  if (!team) {
    return NextResponse.json({ ok: false, error: "No tienes un equipo" }, { status: 403 })
  }

  const admin = getAdminClient()
  const { error } = await (admin.from(DATABASE.TABLES.WS_TEAM_MEMBERS) as any)
    .update({ permissions, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("team_id", team.id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
