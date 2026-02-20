import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getCalendlyAccessTokenForUser } from "@/src/services/calendly/accessToken"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type CalendlyEventsResponse = {
  collection?: Array<{
    uri?: string
    name?: string
    status?: string
    start_time?: string
    end_time?: string
    event_type?: string
    location?: {
      type?: string
      location?: string
      join_url?: string
      status?: string
    }
  }>
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url)
  const max = Math.max(1, Math.min(50, Number(reqUrl.searchParams.get("max") || 10)))

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: conn, error: connError } = await supabase
    .from(DATABASE.TABLES.WS_CALENDLY_CONNECTIONS)
    .select("calendly_user_uri, organization_uri")
    .eq("user_id", user.id)
    .maybeSingle<{ calendly_user_uri: string | null; organization_uri: string | null }>()

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }
  if (!conn) {
    return NextResponse.json({ error: "calendly_not_connected" }, { status: 400 })
  }

  let accessToken: string
  let calendlyUserUri: string | null
  try {
    const token = await getCalendlyAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
    calendlyUserUri = token.calendlyUserUri ?? conn.calendly_user_uri
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error obteniendo token de Calendly" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("min_start_time", new Date().toISOString())
  params.set("count", String(max))
  params.set("sort", "start_time:asc")
  if (calendlyUserUri) params.set("user", calendlyUserUri)
  else if (conn.organization_uri) params.set("organization", conn.organization_uri)

  const calendlyRes = await fetch(`https://api.calendly.com/scheduled_events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!calendlyRes.ok) {
    const text = await calendlyRes.text().catch(() => "")
    return NextResponse.json({ error: "calendly_api_failed", detail: text.slice(0, 600) }, { status: 502 })
  }

  const json = (await calendlyRes.json()) as CalendlyEventsResponse
  const items = (json.collection || []).map((e) => ({
    id: e.uri || "",
    status: e.status || "active",
    summary: e.name || "Evento Calendly",
    start: e.start_time || null,
    end: e.end_time || null,
    htmlLink: e.uri || null,
    location: e.location || null,
  }))

  return NextResponse.json({ ok: true, items }, { status: 200, headers: { "Cache-Control": "no-store" } })
}

