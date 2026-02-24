import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/src/lib/supabase/server"
import { getCalComAccessTokenForUser } from "@/src/services/calcom/accessToken"
import { DATABASE } from "@/src/config"

export const runtime = "edge"

type CalComBooking = {
  id?: number
  uid?: string
  title?: string
  status?: string
  start?: string
  end?: string
  location?: string
  meetingUrl?: string
}

type CalComBookingsResponse = {
  status?: string
  data?: CalComBooking[]
  pagination?: { total?: number }
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
    .from(DATABASE.TABLES.WS_CALCOM_CONNECTIONS)
    .select("provider_email")
    .eq("user_id", user.id)
    .maybeSingle<{ provider_email: string | null }>()

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 })
  }
  if (!conn) {
    return NextResponse.json({ error: "calcom_not_connected" }, { status: 400 })
  }

  let accessToken: string
  try {
    const token = await getCalComAccessTokenForUser(supabase, user.id)
    accessToken = token.accessToken
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error obteniendo token de Cal.com" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams()
  params.set("afterStart", new Date().toISOString())
  params.set("take", String(max))
  params.set("sortStart", "asc")

  const calcomRes = await fetch(
    `https://api.cal.com/v2/bookings?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "cal-api-version": "2024-08-13",
      },
      cache: "no-store",
    }
  )

  if (!calcomRes.ok) {
    const text = await calcomRes.text().catch(() => "")
    return NextResponse.json(
      { error: "calcom_api_failed", detail: text.slice(0, 600) },
      { status: 502 }
    )
  }

  const json = (await calcomRes.json()) as CalComBookingsResponse
  const bookings = json.data ?? []
  const items = bookings.map((b) => ({
    id: b.uid ?? String(b.id ?? ""),
    status: b.status ?? "accepted",
    summary: b.title ?? "Evento Cal.com",
    start: b.start ?? null,
    end: b.end ?? null,
    htmlLink: b.location ?? b.meetingUrl ?? null,
    location: b.location ?? b.meetingUrl ?? null,
  }))

  return NextResponse.json(
    { ok: true, items },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}
