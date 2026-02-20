import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getGmailAccessTokenForUser } from "@/src/services/gmail/accessToken"
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
    .from(DATABASE.TABLES.WS_GMAIL_CONNECTIONS)
    .select("scope")
    .eq("user_id", user.id)
    .maybeSingle<{ scope: string | null }>()

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }
  if (!conn || !hasCalendarScope(conn.scope)) {
    return NextResponse.json(
      { error: "calendar_not_connected", detail: "Conecta Google Calendar primero." },
      { status: 400 }
    )
  }

  let accessToken: string
  try {
    const token = await getGmailAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error obteniendo token de Google" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("singleEvents", "true")
  params.set("orderBy", "startTime")
  params.set("timeMin", new Date().toISOString())
  params.set("maxResults", String(max))

  const googleRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!googleRes.ok) {
    const text = await googleRes.text().catch(() => "")
    return NextResponse.json({ error: "calendar_api_failed", detail: text.slice(0, 600) }, { status: 502 })
  }

  const json = (await googleRes.json()) as {
    items?: Array<{
      id?: string
      status?: string
      summary?: string
      description?: string
      htmlLink?: string
      hangoutLink?: string
      start?: { dateTime?: string; date?: string; timeZone?: string }
      end?: { dateTime?: string; date?: string; timeZone?: string }
      attendees?: Array<{ email?: string; responseStatus?: string }>
    }>
  }

  const items = (json.items || []).map((e) => ({
    id: e.id || "",
    status: e.status || "confirmed",
    summary: e.summary || "Sin título",
    description: e.description || null,
    htmlLink: e.htmlLink || null,
    hangoutLink: e.hangoutLink || null,
    start: e.start || null,
    end: e.end || null,
    attendeesCount: Array.isArray(e.attendees) ? e.attendees.length : 0,
  }))

  return NextResponse.json({ ok: true, items }, { status: 200, headers: { "Cache-Control": "no-store" } })
}

