import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

function hasCalendarScope(scope: string | null | undefined) {
  if (!scope) return false
  return (
    scope.includes("https://www.googleapis.com/auth/calendar") ||
    scope.includes("https://www.googleapis.com/auth/calendar.readonly") ||
    scope.includes("https://www.googleapis.com/auth/calendar.events")
  )
}

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ connected: false, has_google_connection: false }, { status: 200 })
  }

  const { data, error } = await supabase
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .select("provider_email, scope, updated_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle<{
      provider_email: string | null
      scope: string | null
      updated_at: string | null
      created_at: string | null
    }>()

  if (error) {
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ connected: false, has_google_connection: false }, { status: 200 })
  }

  const connected = hasCalendarScope(data.scope)
  return NextResponse.json(
    {
      connected,
      has_google_connection: true,
      needs_reconnect: !connected,
      email: data.provider_email ?? null,
      scope: data.scope ?? null,
      updated_at: data.updated_at ?? null,
      created_at: data.created_at ?? null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}

