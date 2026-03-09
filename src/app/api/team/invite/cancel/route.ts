import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"

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
  const invitationId = String(body.invitation_id || "").trim()

  if (!invitationId) {
    return NextResponse.json({ ok: false, error: "invitation_id requerido" }, { status: 400 })
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
  const { error } = await admin
    .from(DATABASE.TABLES.WS_TEAM_INVITATIONS)
    .update({ status: "expired" } as unknown as never)
    .eq("id", invitationId)
    .eq("team_id", team.id)
    .eq("status", "pending")

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
