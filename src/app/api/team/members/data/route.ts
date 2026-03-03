import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getAdminClient } from "@/src/lib/supabase/admin"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const url = new URL(request.url)
  const memberUserId = url.searchParams.get("user_id")

  if (!memberUserId) {
    return NextResponse.json({ error: "user_id requerido" }, { status: 400 })
  }

  const { data: team } = await supabase
    .from(DATABASE.TABLES.WS_TEAMS)
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle<{ id: string }>()

  if (!team) {
    return NextResponse.json({ error: "No tienes un equipo" }, { status: 403 })
  }

  const admin = getAdminClient()

  const { data: membership } = await admin
    .from(DATABASE.TABLES.WS_TEAM_MEMBERS)
    .select("id")
    .eq("team_id", team.id)
    .eq("user_id", memberUserId)
    .maybeSingle<{ id: string }>()

  if (!membership) {
    return NextResponse.json({ error: "Este usuario no es miembro de tu equipo" }, { status: 403 })
  }

  const [
    { count: customersCount },
    { count: leadsCount },
    { count: policiesCount },
    { count: tasksOpenCount },
    { count: tasksDoneCount },
  ] = await Promise.all([
    admin.from(DATABASE.TABLES.WS_CUSTOMERS).select("id", { count: "exact", head: true }).eq("user_id", memberUserId),
    admin.from(DATABASE.TABLES.WS_LEADS).select("id", { count: "exact", head: true }).eq("user_id", memberUserId),
    admin.from(DATABASE.TABLES.WS_POLICIES).select("id", { count: "exact", head: true }).eq("user_id", memberUserId),
    admin.from(DATABASE.TABLES.WS_TASKS).select("id", { count: "exact", head: true }).eq("user_id", memberUserId).eq("status", "open"),
    admin.from(DATABASE.TABLES.WS_TASKS).select("id", { count: "exact", head: true }).eq("user_id", memberUserId).eq("status", "done"),
  ])

  const { data: profile } = await admin
    .from(DATABASE.TABLES.PROFILES)
    .select("first_name, last_name, agency_name, city, country")
    .eq("id", memberUserId)
    .maybeSingle<{
      first_name: string | null
      last_name: string | null
      agency_name: string | null
      city: string | null
      country: string | null
    }>()

  return NextResponse.json({
    user_id: memberUserId,
    profile: profile ?? null,
    stats: {
      customers: customersCount ?? 0,
      leads: leadsCount ?? 0,
      policies: policiesCount ?? 0,
      tasks_open: tasksOpenCount ?? 0,
      tasks_done: tasksDoneCount ?? 0,
    },
  }, { status: 200, headers: { "Cache-Control": "no-store" } })
}
