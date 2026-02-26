import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getZoomAccessTokenForUser } from "@/src/services/zoom/accessToken"

export const runtime = "edge"

type ZoomMeeting = {
  id?: number
  uuid?: string
  topic?: string
  type?: number
  start_time?: string
  duration?: number
  timezone?: string
  join_url?: string
  status?: string
}

type ZoomMeetingsResponse = {
  meetings?: ZoomMeeting[]
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

  let accessToken: string
  try {
    const token = await getZoomAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error obteniendo token de Zoom" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("type", "upcoming")
  params.set("page_size", String(max))

  const zoomRes = await fetch(`https://api.zoom.us/v2/users/me/meetings?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!zoomRes.ok) {
    const text = await zoomRes.text().catch(() => "")
    return NextResponse.json({ error: "zoom_api_failed", detail: text.slice(0, 600) }, { status: 502 })
  }

  const json = (await zoomRes.json()) as ZoomMeetingsResponse
  const items = (json.meetings || []).map((m) => {
    const endTime = m.start_time && m.duration
      ? new Date(new Date(m.start_time).getTime() + m.duration * 60_000).toISOString()
      : null

    return {
      id: String(m.id || m.uuid || ""),
      status: m.status || "waiting",
      summary: m.topic || "Reunión Zoom",
      start: m.start_time || null,
      end: endTime,
      join_url: m.join_url || null,
    }
  })

  return NextResponse.json({ ok: true, items }, { status: 200, headers: { "Cache-Control": "no-store" } })
}
